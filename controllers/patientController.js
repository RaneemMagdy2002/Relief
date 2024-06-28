const bcrypt = require('bcrypt')
const User = require('../models/PatientSchema');
const Caregiver = require('../models/caregiverSchema');
const userValid = require("../validation/patientValidation");
const cloudinary = require("../services/cloudinaryConfig")
const editProfileValidation=require("../validation/editProfileValidation")
const jwt=require('jsonwebtoken');
const Request = require("../models/requestSchema");
const publicRequest = require("../models/publicRequest");
const { exec } = require('child_process'); 
const nodemailer = require('nodemailer');
const newPasswordValid = require("../validation/ResetPasswordValidation");
const crypto = require('crypto');

// API endpoint for SignUP


const extractHealthRecord = (text) => {
    return new Promise((resolve, reject) => {
        exec(`python analyze.py "${text}"`, (error, stdout, stderr) => {
            if (error) {
                console.error("Error executing Python script:", error);
                console.error("stderr:", stderr);
                return reject(error);
            }
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (parseError) {
                console.error("Error parsing JSON:", parseError);
                console.error("stdout:", stdout); 
                reject(parseError);
            }
        });
    });
};

const SignUP = async function(req, res) {
    if (!req.body.email) {
        return res.status(400).json({ "message": "email is required" });
    }
    let email = req.body.email.toLowerCase();

    // Find the user by email (case-insensitive)
    let emailValidation = await User.findOne({ email: { $regex: new RegExp('^' + email.toLowerCase() + '$', 'i') } });

    if (emailValidation) {
        return res.status(400).json({ message: "Email already exists" });
    }
    let careGiverEmailValidation = await Caregiver.findOne({ email: { $regex: new RegExp('^' + email + '$', 'i') } });
    if (careGiverEmailValidation) {
        return res.status(400).json({ message: "Email already exists" });
    }
    let phoneValidation = await User.findOne({ phone: req.body.phone });

    if (phoneValidation) {
        return res.status(400).json({ message: "phone already exists" });
    }

    if (req.body.password !== req.body.re_password) {
        return res.status(400).json({ "message": "passwords do not match" });
    }

    try {


        const healthRecordText = req.body.healthRecordText;

        const healthRecord = await extractHealthRecord(healthRecordText);
        // Create a new user object without hashed passwords
        const newUser = new User({
            userName: req.body.userName,
            email: req.body.email,
            dateOfBirth: req.body.dateOfBirth,
            phone: req.body.phone,
            gender: req.body.gender,
            password: req.body.password,
            re_password: req.body.re_password,
            healthRecordText: healthRecordText,
            healthRecord: {
                medicines: healthRecord.medications,  
                diseases: healthRecord.diseases
            },
            location: {
                type: "Point",
                coordinates: [req.body.longitude, req.body.latitude]
            }
        });

        // Validate the user object
        const valid = userValid(newUser);
        if (!valid) {
            return res.status(400).json({ message: "Invalid user data" });
        }

        // Hash the passwords
        const salt = await bcrypt.genSalt(10);
        newUser.password = await bcrypt.hash(req.body.password, salt);
        newUser.re_password = await bcrypt.hash(req.body.re_password, salt);

        // Save user to database
        const savedUser = await newUser.save();

        // Generate JWT token
        const tokenPayload = {
            _id: savedUser._id,
            email: savedUser.email
        };
        const token = jwt.sign(tokenPayload, process.env.privateKey, { expiresIn: '200d' });

        // Send response with user data and token
        res.status(201).json({
            UserData: {
                _id : savedUser._id,
                userName: savedUser.userName,
                email: savedUser.email,
                dateOfBirth: savedUser.dateOfBirth,
                phone: savedUser.phone,
                gender: savedUser.gender,
                healthRecordText: savedUser.healthRecordText,
                healthRecord: savedUser.healthRecord,
                location: savedUser.location
            },
            token: token
        });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};



// API endpoint for SignIN
const SignIN = async function(req, res) {
    try {
        let user = await User.findOne({ email: { $regex: new RegExp(`^${req.body.email}$`), $options: 'i' } });
        if (!user) {
            return res.status(401).json({ message: "email or password is incorrect" });
        }

        // Compare passwords
        let isPasswordValid = await bcrypt.compare(req.body.password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "email or password is incorrect" });
        }
        const tokenPayload = {
            _id: user._id,
                email: user.email
        };
        // Generate JWT token
        const token = jwt.sign(tokenPayload, process.env.privateKey, { expiresIn: '200d' });

        // Send response with user data and token
        return res.json({
            UserData: {
                _id : user._id,
                userName: user.userName,
                email: user.email,
                dateOfBirth: user.dateOfBirth,
                phone: user.phone,
                gender:user.gender,
                password: user.password,
                re_password: user.re_password,
                healthRecord: user.healthRecord,
                location: user.location,
                profilePhoto:user.profilePhoto
            },
            token: token
        });
    } catch (error) {
        console.error("Error during sign in:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};




// API endpoint for Change Password
const changePassword =async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    

    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            throw new Error("User not found");
        }
        // Check if the current password matches
        const passwordMatch = await bcrypt.compare(currentPassword, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Check if the new password and confirm password match
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'New password and confirm password do not match' });
        }
        const valid = newPasswordValid(req.body);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid request body', errors:newPasswordValid.errors });
        }
        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update user's password
        user.password = hashedPassword;
        user.re_password=hashedPassword;
        // Save user to database
        await user.save();

        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error during password change:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}


const editProfile = async (req, res) => {
    const { id } = req.params;
    const { profilePhoto, userName, email, dateOfBirth, phone, healthRecord, gender } = req.body;
    if (!editProfileValidation(req.body)) {
        return res.status(400).json({ message: 'Invalid input'});
    }
    try {
        // Find the patient by ID
        let patient = await User.findById(id);

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        let photoUrl = patient.profilePhoto;

        // Check if file is uploaded
        if (req.file && req.file.path) {
            // Upload image to Cloudinary
            const result = await cloudinary.uploader.upload(req.file.path);
            photoUrl = result.secure_url;
        }

        // Update patient's profile with provided data
        patient.profilePhoto = photoUrl;
        patient.userName = userName || patient.userName;
        patient.email = email || patient.email;
        patient.dateOfBirth = dateOfBirth || patient.dateOfBirth;
        patient.phone = phone || patient.phone;
        patient.healthRecord = healthRecord || patient.healthRecord;
        patient.gender = gender || patient.gender;

        // Save the updated patient
        await patient.save();

        res.json({ message: 'Patient profile updated successfully', data: patient });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};





const createRequest = async (req, res) => {
    try {
      const { appointmentDateTime,determineThePeriodOfService  } = req.body;
      const { month, day, hours, minutes } = appointmentDateTime;
      const{amount,unit}=determineThePeriodOfService
      const appointmentDate = new Date(new Date().getFullYear(), month - 1, day, hours, minutes);
  
      if (appointmentDate < new Date()) {
        return res.status(400).json({ message: "Appointment date must be in the future" });
      }
  
      const user = await User.findById(req.user._id);
      if (!user) {
        throw new Error("User not found");
      }
  
      const newRequest = new Request({
        appointmentDateTime: { month, day, hours, minutes },
        determineThePeriodOfService:{amount,unit},
        user: req.user._id,
        userEmail: req.user.email,
        userNamePatient: req.user.userName,
        patientPhone: req.user.phone,
        healthRecordPatient: req.user.healthRecord
      });
  
      await newRequest.save();
  
      const responseData = {
        appointmentDateTime: newRequest.appointmentDateTime,
        determineThePeriodOfService:newRequest.determineThePeriodOfService,
        user: {
          _id: user._id,
          userName: user.userName,
          email: user.email,
          dateOfBirth: user.dateOfBirth,
          phone: user.phone,
          gender: user.gender,
          healthRecord: user.healthRecord
        },
        status: newRequest.status,
        _id: newRequest._id
      };
  
      res.status(201).json(responseData);
    } catch (error) {
      console.error("Error creating request:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  

  const createSpecificRequest = async (req, res) => {
    try {
      const caregiverId = req.params.caregiverId;
      const { appointmentDateTime,determineThePeriodOfService } = req.body;
      const { month, day, hours, minutes } = appointmentDateTime;
      const{amount,unit}=determineThePeriodOfService
      const appointmentDate = new Date(new Date().getFullYear(), month - 1, day, hours, minutes);
  
      if (appointmentDate < new Date()) {
        return res.status(400).json({ message: "Appointment date must be in the future" });
      }
  
      const user = await User.findById(req.user._id);
      if (!user) {
        throw new Error("User not found");
      }
  
      const caregiver = await Caregiver.findById(caregiverId);
      if (!caregiver) {
        return res.status(404).json({ message: "Caregiver not found" });
      }
  
      const newRequest = new Request({
        appointmentDateTime: { month, day, hours, minutes },
        determineThePeriodOfService:{amount,unit},
        user: req.user._id,
        userEmail: req.user.email,
        userNamePatient: req.user.userName,
        patientPhone: req.user.phone,
        healthRecordPatient: req.user.healthRecord,
        locationPatient:req.user.location,
        caregiver: caregiverId,
        caregiverEmail: caregiver.email,
        caregiverPhone: caregiver.phone,
        locationCaregiver:caregiver.location,
        role: 'specific'
      });
  
      await newRequest.save();
  
      const responseData = {
        role:newRequest.role,
        appointmentDateTime: newRequest.appointmentDateTime,
        determineThePeriodOfService:newRequest.determineThePeriodOfService,
        
        user: {
          _id: user._id,
          userName: user.userName,
          email: user.email,
          dateOfBirth: user.dateOfBirth,
          phone: user.phone,
          gender: user.gender,
          healthRecord: user.healthRecord,
          locationPatient:user.location,
        },
        caregiver: {
          _id: caregiver._id,
          userName: caregiver.userName,
          email: caregiver.email,
          phone: caregiver.phone,
          locationCaregiver:caregiver.location,
        },
        status: newRequest.status,
        _id: newRequest._id
      };
  
      res.status(201).json(responseData);
    } catch (error) {
      console.error("Error creating request:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

const createPublicRequest = async (req, res) => {
    try {
        const {
            HowManyPeopleAreYouArrangingCareFor,
            HowManyWeeksOfCareAreRequired,
            WhenWouldYouLikeTheCareToStart,
            DoesThePropertyHaveAPrivateBedroomForTheCarer,
            DoYouHaveAnyPreferenceOnTheGenderOfTheirCarer,
            WouldYouAcceptACarerWhoSmokes,
            DoYouNeedACarerThatCanDrive,
            determineThePeriodOfService,
            appointmentDateTime
        } = req.body;
         // Validate appointmentDateTime is in the future
         const { day, month, hours, minutes } = appointmentDateTime;
         const appointmentDate = new Date();
         appointmentDate.setDate(day);
         appointmentDate.setMonth(month - 1); // JavaScript months are 0-based
         appointmentDate.setHours(hours);
         appointmentDate.setMinutes(minutes);
         appointmentDate.setSeconds(0);
         appointmentDate.setMilliseconds(0);
 
         const currentDate = new Date();
         if (appointmentDate <= currentDate) {
             return res.status(400).json({ message: "Appointment date must be in the future" });
         }
        // Fetch user information
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Create new request
        const newRequest = new publicRequest({
            HowManyPeopleAreYouArrangingCareFor,
            HowManyWeeksOfCareAreRequired,
            WhenWouldYouLikeTheCareToStart,
            DoesThePropertyHaveAPrivateBedroomForTheCarer,
            DoYouHaveAnyPreferenceOnTheGenderOfTheirCarer,
            WouldYouAcceptACarerWhoSmokes,
            DoYouNeedACarerThatCanDrive,
            determineThePeriodOfService,
            appointmentDateTime,
            user: req.user._id,
            userEmail: user.email,
            userNamePatient: user.userName,
            patientPhone: user.phone,
            healthRecordPatient: user.healthRecord,
            locationPatient:user.location,
        });

        // Save request to database
        await newRequest.save();

        // Filter caregivers based on the criteria
        const caregiverCriteria = {
            availability: true
        };

        if (DoYouHaveAnyPreferenceOnTheGenderOfTheirCarer !== 'no preference') {
            caregiverCriteria.gender = DoYouHaveAnyPreferenceOnTheGenderOfTheirCarer.toLowerCase();
        }

        if (WouldYouAcceptACarerWhoSmokes.toLowerCase() === 'no') {
            caregiverCriteria.doYouSmoke = { $in: ['no', 'false'] };
        } else if (WouldYouAcceptACarerWhoSmokes.toLowerCase() === 'yes') {
            caregiverCriteria.doYouSmoke = { $in: ['yes', 'true'] };
        }

        if (DoYouNeedACarerThatCanDrive.toLowerCase() === 'yes') {
            caregiverCriteria.canYouDrive = { $in: ['yes', 'true'] };
        } else if (DoYouNeedACarerThatCanDrive.toLowerCase() === 'no') {
            caregiverCriteria.canYouDrive = { $in: ['no', 'false'] };
        }

        const caregivers = await Caregiver.find(caregiverCriteria);

        // Add caregivers to the request and send notification to them
        newRequest.caregivers = caregivers.map(caregiver => caregiver._id);
        await newRequest.save();

        

        // Prepare response data with user information and filtered caregivers
        const responseData = {
            role:newRequest.role,
            _id: newRequest._id,
            HowManyPeopleAreYouArrangingCareFor: newRequest.HowManyPeopleAreYouArrangingCareFor,
            HowManyWeeksOfCareAreRequired: newRequest.HowManyWeeksOfCareAreRequired,
            WhenWouldYouLikeTheCareToStart: newRequest.WhenWouldYouLikeTheCareToStart,
            DoesThePropertyHaveAPrivateBedroomForTheCarer: newRequest.DoesThePropertyHaveAPrivateBedroomForTheCarer,
            DoYouHaveAnyPreferenceOnTheGenderOfTheirCarer: newRequest.DoYouHaveAnyPreferenceOnTheGenderOfTheirCarer,
            WouldYouAcceptACarerWhoSmokes: newRequest.WouldYouAcceptACarerWhoSmokes,
            DoYouNeedACarerThatCanDrive: newRequest.DoYouNeedACarerThatCanDrive,
            determineThePeriodOfService: newRequest.determineThePeriodOfService,
            appointmentDateTime: newRequest.appointmentDateTime,
            status: newRequest.status,
            user: {
                _id: user._id,
                userName: user.userName,
                email: user.email,
                dateOfBirth: user.dateOfBirth,
                phone: user.phone,
                gender: user.gender,
                healthRecord: user.healthRecord,
                location:user.location
            },
            caregivers
        };

        // Send response with new request data and filtered caregivers
        res.status(201).json(responseData);
    } catch (error) {
        console.error("Error creating request:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};



// Function to generate a random token
const generateToken = () => {
    return crypto.randomBytes(20).toString('hex');
};

const forgetPassword = async (req, res) => {
    const { email } = req.body;

    try {
        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate verification code and token
        const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
        const token = generateToken();
        user.resetPasswordVerificationCode = verificationCode;
        user.resetPasswordVerificationToken = token;
        user.resetPasswordVerificationExpires = Date.now() + 300000; // 5 minutes
        await user.save();

        // Send reset email with verification code and token
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: 'reliefappemail@gmail.com', 
                pass: 'qbax aoca gdgt gtrx'
            }
        });

        const mailOptions = {
            from: 'reliefappemail@gmail.com',
            to: email,
            subject: 'Reset your password',
            html: `<p>You are receiving this email because you (or someone else) have requested the reset of the password for your account.</p>
                   <p>Your verification code is: <strong style="background-color: #874CCC; font-weight: bold;color:white">${verificationCode}</strong></p>
                   <p>Your reset token is: <strong>${token}</strong></p>
                   <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>`
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ error: 'Error sending email' });
            }
            console.log('Email sent: ' + info.response);
            res.status(200).json({ message: 'Verification code sent successfully' ,token});
        });
    } catch (error) {
        console.error("Error sending verification code:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};



const verifyCode = async (req, res) => {
    const { token } = req.params;
    const { verificationCode } = req.body;

    try {
        // Find user by token and check verification code
        const user = await User.findOne({
            resetPasswordVerificationToken: token,
            resetPasswordVerificationCode: verificationCode,
            resetPasswordVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        res.status(200).json({ message: 'Verification code verified successfully' });
    } catch (error) {
        console.error("Error verifying code:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { newPassword, confirmPassword } = req.body;

    try {
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: 'Passwords do not match' });
        }

        // Validate the new password (implement newPasswordValid function as needed)
        const valid = newPasswordValid(req.body);
        if (!valid) {
            return res.status(400).json({ message: 'Invalid request body', errors: newPasswordValid.errors });
        }

        // Find user by token
        const user = await User.findOne({ resetPasswordVerificationToken: token });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Hash new password and update user
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
        user.re_password = hashedPassword;
        user.resetPasswordVerificationCode = undefined;
        user.resetPasswordVerificationToken = undefined;
        user.resetPasswordVerificationExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successful' });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};





const getAllRatingsMessageForPateint = async (req, res) => {
    try {
        const patientId = req.params.patientId;

        // Find all requests for the specific patient from both models
        const requestsFromRequestModel = await Request.find({ user: patientId }).select('messageRating rating caregiver caregiverEmail caregiverPhone');

        const requestsFromPublicRequestModel = await publicRequest.find({ user: patientId }).select('messageRating rating caregiver caregiverEmail caregiverPhone');

        // Combine requests from both models
        const combinedRequests = [...requestsFromRequestModel, ...requestsFromPublicRequestModel];

        // Check if any requests were found
        // if (combinedRequests.length === 0) {
        //     return res.status(404).json({ message: "No requests found for this patient" });
        // }

        // Format the response to include caregiver data, message ratings, and ratings
        const ratings = combinedRequests.reduce((accumulator, request) => {
            const requestInfo = {
                caregiverData: {
                    caregiver: request.caregiver,
                    caregiverEmail: request.caregiverEmail,
                    caregiverPhone: request.caregiverPhone
                },
                Info: {}
            };

            if (request.messageRating) {
                requestInfo.Info.messageRating = request.messageRating;
            }

            if (request.rating) {
                requestInfo.Info.rating = request.rating;
            }

            // Only include if either messageRating or rating exists
            if (Object.keys(requestInfo.Info).length > 0) {
                accumulator.push(requestInfo);
            }

            return accumulator;
        }, []);

        res.json(ratings);
    } catch (error) {
        console.error("Error retrieving message ratings for patient:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getAllRequestsForPatient = async (req, res) => {
    try {
        const patientId = req.params.patientId;

        // Find all requests for the specific patient from both models
        const requestsFromRequestModel = await Request.find({ user: patientId });

        const requestsFromPublicRequestModel = await publicRequest.find({ user: patientId });

        // Combine requests from both models
        const combinedRequests = [...requestsFromRequestModel, ...requestsFromPublicRequestModel];

        // Filter requests to only include those with an approved status
        const approvedRequests = combinedRequests.filter(request => request.status === 'approved');

        // Check if any approved requests were found
        // if (approvedRequests.length === 0) {
        //     return res.status(404).json({ message: "No approved requests found for this patient" });
        // }

        // Respond with the approved requests
        res.json(approvedRequests);
    } catch (error) {
        console.error("Error retrieving requests for patient:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const getNearCareGivers = async (req, res) => {
    const user = req.user
    const coordinates = [user.location.coordinates[0], user.location.coordinates[1]]
    const maxDistance = 1 * req.query.km * 1000 // 50 kilometers in meters
    const caregiver = await Caregiver.find({
        location: {
            $near: {
                $geometry: {
                    type: "Point",
                    coordinates: [coordinates[0], coordinates[1]],
                },
                $maxDistance: maxDistance,
            },
        },
    })
    res.status(200).json({
        results: caregiver.length,
        caregiver,
    })
}
const getPatientById = async (req, res) => {
    const { id } = req.params;

    try {
        // Find the patient by ID
        let patient = await User.findById(id);

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Return the patient data
        res.json({ message: 'Patient found', data: patient });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};
const getPatientByToken = async function(req, res) {
    try {
        const token = req.params.token;
        if (!token) {
            return res.status(400).json({ message: "Token is required" });
        }

        // Verify and decode the token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.privateKey);
        } catch (error) {
            return res.status(401).json({ message: "Invalid token" });
        }

        // Find the user by decoded token payload
        const user = await User.findById(decoded._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Send response with user data
        return res.json({
            UserData: {
                _id:user._id,
                userName: user.userName,
                email: user.email,
                dateOfBirth: user.dateOfBirth,
                phone: user.phone,
                gender: user.gender,
                password: user.password,
                re_password: user.re_password,
                healthRecord: user.healthRecord,
                location: user.location,
                profilePhoto:user.profilePhoto
            }
        });
    } catch (error) {
        console.error("Error retrieving patient by token:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const getAllMyReviews = async (req, res) => {
    try {
        const caregiverId = req.params.caregiverId;
        const patientId = req.user._id; // Get patient ID from the token

        const user = await User.findById(patientId);
        if (!user) {
            throw new Error("User not found");
        }

        // Find all requests for the specific patient and caregiver from both models
        const requestsFromRequestModel = await Request.find({ user: patientId, caregiver: caregiverId }).select('messageRating rating caregiver caregiverEmail caregiverPhone');

        const requestsFromPublicRequestModel = await publicRequest.find({ user: patientId, caregiver: caregiverId }).select('messageRating rating caregiver caregiverEmail caregiverPhone');

        // Combine requests from both models
        const combinedRequests = [...requestsFromRequestModel, ...requestsFromPublicRequestModel];

        

        // Format the response to include caregiver data, message ratings, and ratings
        const ratings = combinedRequests.reduce((accumulator, request) => {
            const requestInfo = {
                caregiverData: {
                    caregiver: request.caregiver,
                    caregiverEmail: request.caregiverEmail,
                    caregiverPhone: request.caregiverPhone
                },
                Info: {}
            };

            if (request.messageRating) {
                requestInfo.Info.messageRating = request.messageRating;
            }

            if (request.rating) {
                requestInfo.Info.rating = request.rating;
            }

            // Only include if either messageRating or rating exists
            if (Object.keys(requestInfo.Info).length > 0) {
                accumulator.push(requestInfo);
            }

            return accumulator;
        }, []);

        res.json(ratings);
    } catch (error) {
        console.error("Error retrieving message ratings for patient:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};



const MatchDisease=async (req, res) => {
    try {
        const { patientId } = req.params;

        // Fetch the patient by ID
        const patient = await User.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Fetch all caregivers
        const caregivers = await Caregiver.find();

        // Extract diseases from patient's health record
        const patientDiseases = patient.healthRecord.diseases;

        // Find caregivers with at least one common disease and include common diseases in the response
        const matchingCaregivers = caregivers
            .map(caregiver => {
                const caregiverDiseases = caregiver.extractedDetails.diseases;
                const commonDiseases = patientDiseases.filter(disease => caregiverDiseases.includes(disease));
                if (commonDiseases.length > 0) {
                    return {
                        caregiver,
                        commonDiseases
                    };
                }
                return null;
            })
            .filter(caregiverData => caregiverData !== null);

        // Respond with the matching caregivers and their common diseases
        res.json({ matchingCaregivers });

    } catch (error) {
        console.error("Error matching diseases:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}


module.exports = {SignUP,SignIN,createRequest,forgetPassword,verifyCode,resetPassword,changePassword,editProfile,getAllRatingsMessageForPateint,getAllRequestsForPatient,createPublicRequest,getNearCareGivers,createSpecificRequest,getPatientById,getPatientByToken,getAllMyReviews,MatchDisease}; 