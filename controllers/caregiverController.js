const bcrypt = require('bcrypt')
const User = require('../models/caregiverSchema');
const userValid = require("../validation/caregiverValidation");
const newPasswordValid = require("../validation/ResetPasswordValidation");
const jwt=require('jsonwebtoken');
const notificationSender = require('../services/notificationSender');
const nodemailer = require('nodemailer');
const Request = require("../models/requestSchema");
const cloudinary = require("../services/cloudinaryConfig")
const sendSMS = require('../services/Send_SMS');
const editProfileValidation=require("../validation/editProfileValidation")
const crypto = require('crypto');
const publicRequest = require("../models/publicRequest");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Patient=require('../models/PatientSchema')
const { exec } = require('child_process'); 


// API endpoint for SignUP
const extractBiography = (text) => {
    return new Promise((resolve, reject) => {
        exec(`python analyzeBiography.py "${text}"`, (error, stdout, stderr) => {
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

// Your signup function
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
    let patientEmailValidation = await Patient.findOne({ email: { $regex: new RegExp('^' + email + '$', 'i') } });
    if (patientEmailValidation) {
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
        const biographyText = req.body.biography;
        const extractedDetails = await extractBiography(biographyText);

        // Create a new user object with hashed passwords
        const newUser = new User({
            userName: req.body.userName,
            email: req.body.email,
            dateOfBirth: req.body.dateOfBirth,
            phone: req.body.phone,
            gender: req.body.gender,
            password: req.body.password,
            re_password: req.body.re_password,
            availability: req.body.availability,
            doYouSmoke: req.body.doYouSmoke,
            canYouDrive: req.body.canYouDrive,
            biography: biographyText,
            extractedDetails: {
                
                diseases: extractedDetails.diseases
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
        const token = jwt.sign(tokenPayload, process.env.privateKey, { expiresIn: '100d' });

        // Send response with user data and token
        res.status(201).json({
            UserData: {
                _id : savedUser._id,
                userName: savedUser.userName,
                email: savedUser.email,
                dateOfBirth: savedUser.dateOfBirth,
                phone: savedUser.phone,
                gender: savedUser.gender,
                password: savedUser.password,
                re_password: savedUser.re_password,
                availability: savedUser.availability,
                doYouSmoke: savedUser.doYouSmoke,
                canYouDrive: savedUser.canYouDrive,
                biography: savedUser.biography,
                extractedDetails: savedUser.extractedDetails,
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
        const token = jwt.sign(tokenPayload, process.env.privateKey, { expiresIn: '100d' });

        // Send response with user data and token
        return res.json({
            UserData: {
                _id : user._id,
                userName: user.userName,
                email: user.email,
                dateOfBirth: user.dateOfBirth,
                phone: user.phone,
                gender: user.gender,
                password: user.password,
                re_password: user.re_password,
                PricePerDayForSpecialRequest: user.PricePerDayForSpecialRequest,
                availability: user.availability,
                doYouSmoke: user.doYouSmoke,
                canYouDrive: user.canYouDrive,
                biography: user.biography,
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


const editCaregiverProfile = async (req, res) => {
    const { id } = req.params;
    const { userName, email, dateOfBirth, phone, doYouSmoke, canYouDrive, gender, availability,biography,PricePerDayForSpecialRequest } = req.body;

    // Validate input
    if (!editProfileValidation(req.body)) {
        return res.status(400).json({ message: 'Invalid input' });
    }
    
    try {
        // Find the caregiver by ID
        let caregiver = await User.findById(id);

        if (!caregiver) {
            return res.status(404).json({ message: 'Caregiver not found' });
        }

        let photoUrl = caregiver.profilePhoto;

        // Check if file is uploaded
        if (req.file && req.file.path) {
            // Upload image to Cloudinary
            const result = await cloudinary.uploader.upload(req.file.path);
            photoUrl = result.secure_url;
        }

        // Update caregiver's profile with provided data
        caregiver.profilePhoto = photoUrl;
        caregiver.userName = userName || caregiver.userName;
        caregiver.email = email || caregiver.email;
        caregiver.dateOfBirth = dateOfBirth || caregiver.dateOfBirth;
        caregiver.phone = phone || caregiver.phone;
        caregiver.gender = gender || caregiver.gender;
        caregiver.availability = availability || caregiver.availability;
        caregiver.canYouDrive = canYouDrive || caregiver.canYouDrive;    
        caregiver.doYouSmoke = doYouSmoke || caregiver.doYouSmoke;
        caregiver.biography=biography||caregiver.biography;
        caregiver.PricePerDayForSpecialRequest=PricePerDayForSpecialRequest||caregiver.PricePerDayForSpecialRequest;

        // Save the updated caregiver
        await caregiver.save();

        res.json({ message: 'Caregiver profile updated successfully', data: caregiver });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
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



const getRequestsForCaregiverWithRole = async (req, res) => {
    try {
        const caregiverId = req.params.caregiverId;

        // Find all pending requests for the specific caregiver from both models
        const requestsFromRequestModel = await Request.find({ caregiver: caregiverId, status: 'pending' });
        const requestsFromPublicRequestModel = await publicRequest.find({ status: 'pending' });
console.log(requestsFromPublicRequestModel)
        // Filter public requests to include only those with the caregiver in the caregivers array
        const filteredPublicRequests = requestsFromPublicRequestModel.filter(publicRequest =>
            publicRequest.caregivers.includes(caregiverId)
        );

        // Add a role property to each request to specify the source model
        const requestsWithRoles = [
            ...requestsFromRequestModel.map(request => ({ ...request._doc, role: 'specific' })),
            ...filteredPublicRequests.map(publicRequest => ({ ...publicRequest._doc, role: 'public' }))
        ];

        // Check if any requests were found
        // if (requestsWithRoles.length === 0) {
        //     return res.status(404).json({ message: "No pending requests found for this caregiver" });
        // }

        // Respond with the requests with roles
        res.json(requestsWithRoles);
    } catch (error) {
        console.error("Error retrieving requests:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
// API endpoint to display All Caregivers
const displayAllCaregiversAndNurses=async function(req, res) {
    try {
      
        const caregivers = await User.find();

        res.status(200).json(caregivers);
    } catch (error) {
        console.error("Error while fetching caregivers:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const approveRequest = async (req, res) => {
    try {
      const requestId = req.params.requestId;
      const request = await Request.findById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
  
      if (request.status === 'approved') {
        return res.status(400).json({ message: "Request has already been approved" });
      }
      if (request.status === 'rejected') {
        return res.status(400).json({ message: "Request has already been rejected and cannot be approved" });
      }
  
      // Update request status and caregiver information
      request.status = 'approved';
      request.caregiver = req.user._id;
      request.caregiverEmail = req.user.email;
      request.caregiverPhone = req.user.phone;
  
      await request.save();
  
      // Send notifications
      await notificationSender(request.userEmail, 'Request Approved', 'Your request has been approved!(Patient)');
      await notificationSender(request.caregiverEmail, 'Request Approved', `You accepted the request from ${request.userNamePatient}!(caregiver)`);
      await sendSMS(process.env.SMS_API_KEY, 'Relief', '+2' + request.patientPhone, 'Your request has been approved!(Patient)');
      await sendSMS(process.env.SMS_API_KEY, 'Relief', '+2' + request.caregiverPhone, `You accepted the request from ${request.userNamePatient}!(caregiver)`);
  
      // Calculate appointment and end times
      const appointmentDateTime = new Date(
        new Date().getFullYear(),
        request.appointmentDateTime.month - 1,
        request.appointmentDateTime.day,
        request.appointmentDateTime.hours,
        request.appointmentDateTime.minutes
      );
  
      let endDateTime = new Date(appointmentDateTime);
  
      if (request.determineThePeriodOfService.unit === 'day') {
        endDateTime.setDate(appointmentDateTime.getDate() + request.determineThePeriodOfService.amount);
      } else if (request.determineThePeriodOfService.unit === 'month') {
        endDateTime.setMonth(appointmentDateTime.getMonth() + request.determineThePeriodOfService.amount);
      }
  
      // Update caregiver availability
      const caregiver = await User.findById(request.caregiver);
      if (caregiver) {
        caregiver.availability = false;
        caregiver.availabilityEndDate = endDateTime;
        await caregiver.save();
  
        // Schedule job to set availability back to true
        const delay = endDateTime.getTime() - Date.now();
        setTimeout(async () => {
          caregiver.availability = true;
          caregiver.availabilityEndDate = null;
          await caregiver.save();
          console.log(`Caregiver ${caregiver.userName} is now available`);
        }, delay);
      }
  
      res.json({ message: "Request approved successfully" });
    } catch (error) {
      console.error("Error approving request:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  
  





const approveSpecificRequest = async (req, res) => {
    try {
      const requestId = req.params.requestId;
      const caregiverId = req.user._id;
  
      const request = await Request.findById(requestId).populate('user');
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
  
      if (request.status === 'approved') {
        return res.status(400).json({ message: "Request has already been approved" });
      }
      if (request.status === 'rejected') {
        return res.status(400).json({ message: "Request has already been rejected and cannot be approved" });
      }
  
      // Check if the caregiver approving the request is the one associated with it
      if (String(request.caregiver) !== String(caregiverId)) {
        return res.status(403).json({ message: "You are not authorized to approve this request" });
      }
  
      // Check caregiver availability
      const caregiver = await User.findById(caregiverId);
      if (!caregiver) {
        return res.status(404).json({ message: "Caregiver not found" });
      }
  
      if (!caregiver.availability) {
        return res.status(400).json({ message: "Caregiver is not available" });
    }
    
      // Approve the request
      request.status = 'approved';
      request.caregiverEmail = req.user.email;
      request.caregiverPhone = req.user.phone;
      request.caregiverName =req.user.userName;
      request.locationCaregiver=req.user.location
      await request.save();
  
      // Calculate appointment and end times
      const appointmentDateTime = new Date(
        new Date().getFullYear(),
        request.appointmentDateTime.month - 1,
        request.appointmentDateTime.day,
        request.appointmentDateTime.hours,
        request.appointmentDateTime.minutes
      );
  
      let endDateTime = new Date(appointmentDateTime);
  
      if (request.determineThePeriodOfService.unit === 'day') {
        endDateTime.setDate(appointmentDateTime.getDate() + request.determineThePeriodOfService.amount);
      } else if (request.determineThePeriodOfService.unit === 'month') {
        endDateTime.setMonth(appointmentDateTime.getMonth() + request.determineThePeriodOfService.amount);
      }
  
      // Update caregiver availability
      caregiver.availability = false;
      caregiver.availabilityEndDate = endDateTime;
      await caregiver.save();
  
      // Schedule job to set availability back to true
      const delay = endDateTime.getTime() - Date.now();
      setTimeout(async () => {
        caregiver.availability = true;
        caregiver.availabilityEndDate = null;
        await caregiver.save();
        console.log(`Caregiver ${caregiver.userName} is now available`);
      }, delay);
  
      const responseData = {
        
        message: "Request approved successfully",
        determineThePeriodOfService:request.determineThePeriodOfService,
        appointmentDateTime: request.appointmentDateTime,
        role: request.role,
        user: {
          _id: request.user._id,
          userName: request.user.userName,
          email: request.user.email,
          dateOfBirth: request.user.dateOfBirth,
          phone: request.user.phone,
          gender: request.user.gender,
          healthRecord: request.user.healthRecord,
          locationPatient:request.user.location
        },
        caregiver: {
          _id: caregiver._id,
          userName: caregiver.userName,
          email: caregiver.email,
          phone: caregiver.phone,
          locationCaregiver:caregiver.location
        },
        status: request.status,
        _id: request._id
      };
  
      res.json(responseData);
  
      await notificationSender(request.userEmail, 'Request Approved', 'Your request has been approved!(Patient)');
      await notificationSender(request.caregiverEmail, 'Request Approved', `You accepted the request from ${request.userNamePatient}!(Caregiver)`);
      await sendSMS(process.env.SMS_API_KEY, 'Relief', '+2' + request.patientPhone, 'Your request has been approved!(Patient)');
      await sendSMS(process.env.SMS_API_KEY, 'Relief', '+2' + request.caregiverPhone, `You accepted the request from ${request.userNamePatient}!(Caregiver)`);
  
      const reminderTime = new Date(appointmentDateTime.getTime() - 5 * 60000);
  
      if (Date.now() < reminderTime.getTime()) {
        setTimeout(async () => {
          await notificationSender(request.userEmail, 'Appointment Reminder', 'Your appointment is starting soon!(Patient)');
          await notificationSender(request.caregiverEmail, 'Appointment Reminder', 'Your appointment is starting soon! (Caregiver)');
          await sendSMS(process.env.SMS_API_KEY, 'Relief', '+2' + request.patientPhone, 'Your appointment is starting soon!(Patient)');
          await sendSMS(process.env.SMS_API_KEY, 'Relief', '+2' + request.caregiverPhone, `Your appointment is starting soon! (Caregiver)`);
        }, reminderTime.getTime() - Date.now());
      } else {
        await notificationSender(request.userEmail, 'Appointment Reminder', 'Your appointment is starting soon!(Patient)');
        await notificationSender(request.caregiverEmail, 'Appointment Reminder', 'Your appointment is starting soon! (Caregiver)');
        await sendSMS(process.env.SMS_API_KEY, 'Relief', '+2' + request.patientPhone, 'Your appointment is starting soon!(Patient)');
        await sendSMS(process.env.SMS_API_KEY, 'Relief', '+2' + request.caregiverPhone, `Your appointment is starting soon! (Caregiver)`);
      }
    } catch (error) {
      console.error("Error approving request:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

const rejectRequest = async (req, res) => {
    try {
        const requestId = req.params.requestId;

        // Find the request by ID
        const request = await Request.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }
        if (request.status === 'rejected') {
            return res.status(400).json({ message: "Request has already been rejected" });
        }
        if (request.status === 'approved') {
            return res.status(400).json({ message: "Request has already been approved and cannot be rejected" });
        }
        // Update the request status to 'rejected'
        request.status = 'rejected';
        
        request.caregiver = req.user._id;
        request.caregiverEmail=req.user.email;
        request.caregiverPhone=req.user.phone;
        await request.save();


         //availability
        //  const caregiver = await User.findById(request.caregiver);
        //  if (!caregiver) {
        //      return res.status(404).json({ message: "Caregiver not found" });
        //  }
        //  if (caregiver.availability === true) {
        //     return res.status(400).json({ message: "Caregiver is already available" });
        // }
 
        //  caregiver.availability='true';
        //  await caregiver.save();
        
        // Send response
        res.json({ message: "Request rejected successfully" });
        await notificationSender(request.userEmail, 'Request Rejected', 'Your request has been Rejected!(Patient)');
        await notificationSender(request.caregiverEmail, 'Request Rejected', `You Reject the request from ${request.userNamePatient}!(caregiver)`);
        await sendSMS(process.env.SMS_API_KEY,'Relief','+2'+request.patientPhone, 'Your request has been Rejected!(Patient)');
        await sendSMS(process.env.SMS_API_KEY,'Relief','+2'+request.caregiverPhone, `You Reject the request from ${request.userNamePatient}!(caregiver)`);
 

    } catch (error) {
        console.error("Error rejecting request:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
const rejectSpecificRequest = async (req, res) => {
    try {
      const requestId = req.params.requestId;
      const caregiverId = req.user._id; 
  
      const request = await Request.findById(requestId).populate('user');
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
  
      if (request.status === 'approved') {
        return res.status(400).json({ message: "Request has already been approved and cannot be rejected" });
      }
      if (request.status === 'rejected') {
        return res.status(400).json({ message: "Request has already been rejected" });
      }
  
      // Check if the caregiver rejecting the request is the one associated with it
      if (String(request.caregiver) !== String(caregiverId)) {
        return res.status(403).json({ message: "You are not authorized to reject this request" });
      }
  
      request.status = 'rejected';
  
      await request.save();
  
      const caregiver = await User.findById(caregiverId);
      if (!caregiver) {
        return res.status(404).json({ message: "Caregiver not found" });
      }
  
      const responseData = {
        message: "Request rejected successfully" ,
        determineThePeriodOfService:request.determineThePeriodOfService,
        appointmentDateTime: request.appointmentDateTime,
        role:request.role,
        user: {
          _id: request.user._id,
          userName: request.user.userName,
          email: request.user.email,
          dateOfBirth: request.user.dateOfBirth,
          phone: request.user.phone,
          gender: request.user.gender,
          healthRecord: request.user.healthRecord
        },
        caregiver: {
          _id: caregiver._id,
          userName: caregiver.userName,
          email: caregiver.email,
          phone: caregiver.phone
        },
        status: request.status,
        _id: request._id
      };
  
      res.json(responseData);
  
      await notificationSender(request.userEmail, 'Request Rejected', 'Your request has been rejected.(Patient)');
      await notificationSender(request.caregiverEmail, 'Request Rejected', `You rejected the request from ${request.userNamePatient}.(Caregiver)`);
      await sendSMS(process.env.SMS_API_KEY, 'Relief', '+2' + request.patientPhone, 'Your request has been rejected.(Patient)');
      await sendSMS(process.env.SMS_API_KEY, 'Relief', '+2' + request.caregiverPhone, `You rejected the request from ${request.userNamePatient}.(Caregiver)`);
  
    } catch (error) {
      console.error("Error rejecting request:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  



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


// API endpoint to make rating
const MakeRating=async (req, res) => {
    const requestId = req.params.requestId;
    const { rating,messageRating } = req.body;
    const currentUserId = req.user.id;
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    try {
        const request = await Request.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }
        if (request.status !== 'approved') {
            return res.status(400).json({ message: "Cannot rate a request that is not approved" });
        }


          // Check if the current user is the same as the user who made the request
          if (request.user.toString() !== currentUserId) {
            return res.status(403).json({ message: "You are not authorized to rate this request" });
        }
        if (request.rating) {
            return res.status(400).json({ message: "Request has already been rated" });
        }

        // Update request with rating
        request.rating = rating;
        request.messageRating=messageRating
        await request.save();

        // Update caregiver's rating
        const caregiver = await User.findById(request.caregiver);
        if (!caregiver) {
            return res.status(404).json({ message: "Caregiver not found" });
        }

        caregiver.ratings.push(rating);                  //accumulator+current,The initial value of the accumulator is set to 0.
        caregiver.averageRating = caregiver.ratings.reduce((acc, curr) => acc + curr, 0) / caregiver.ratings.length;
        await caregiver.save();

        res.status(200).json({ message: "Rating submitted successfully",Request:request});
    } catch (error) {
        console.error("Error submitting rating:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// API endpoint to make rating
const MakeRatingForPubicRequest=async (req, res) => {
    const requestId = req.params.requestId;
    const { rating,messageRating } = req.body;
    const currentUserId = req.user.id;

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    try {
        const request = await publicRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        } 

        if (request.status !== 'approved') {
            return res.status(400).json({ message: "Cannot rate a request that is not approved" });
        }

        // Check if the current user is the same as the user who made the request
        if (request.user.toString() !== currentUserId) {
          return res.status(403).json({ message: "You are not authorized to rate this request" });
      }
        if (request.rating) {
            return res.status(400).json({ message: "Request has already been rated" });
        }

        // Update request with rating
        request.rating = rating;
        request.messageRating=messageRating
        await request.save();

        // Update caregiver's rating
        const caregiver = await User.findById(request.caregiver);
        if (!caregiver) {
            return res.status(404).json({ message: "Caregiver not found" });
        }

        caregiver.ratings.push(rating);                  //accumulator+current,The initial value of the accumulator is set to 0.
        caregiver.averageRating = caregiver.ratings.reduce((acc, curr) => acc + curr, 0) / caregiver.ratings.length;
        await caregiver.save();

        res.status(200).json({ message: "Rating submitted successfully",Request:request});
    } catch (error) {
        console.error("Error submitting rating:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}

// API endpoint to display Caregivers By Rating
const displayCaregiversByRating = async (req, res) => {
    try {
        const caregivers = await User.find({ availability: true }).sort({ averageRating: -1 });
        // Send response with sorted caregivers
        res.json(caregivers);
    } catch (error) {
        console.error("Error fetching caregivers:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};





// API endpoint to display Caregivers
const displayCaregivers = async (req, res) => {
    try {
        const caregivers = await User.find({ availability: true  });
        // Send response with sorted caregivers
        res.json(caregivers);
    } catch (error) {
        console.error("Error fetching caregivers:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const getMessageRatingsForCaregiver = async (req, res) => {
    try {
        const caregiverId = req.params.caregiverId;

        // Find all requests for the specific caregiver from both models
        const requestsFromRequestModel = await Request.find({ caregiver: caregiverId })
            .select('messageRating rating user userEmail healthRecordPatient userNamePatient patientPhone locationPatient');

        const requestsFromPublicRequestModel = await publicRequest.find({ caregiver: caregiverId })
            .select('messageRating rating user userEmail healthRecordPatient userNamePatient patientPhone locationPatient');

        // Combine and format the requests from both models
        let formattedRequests = [];

        // Function to filter out requests without messageRating or rating
        const filterRequests = (requests) => {
            return requests.filter(request => {
                return (request.messageRating !== undefined || request.rating !== undefined);
            });
        };

        formattedRequests = [
            ...filterRequests(requestsFromRequestModel),
            ...filterRequests(requestsFromPublicRequestModel)
        ].map(request => ({
            PatientData: {
                user: request.user,
                userEmail: request.userEmail,
                healthRecordPatient: request.healthRecordPatient,
                userNamePatient: request.userNamePatient,
                patientPhone: request.patientPhone,
                locationPatient:request.locationPatient,

            },
            Info: {
                messageRating: request.messageRating,
                rating: request.rating
            }
        }));

        // Check if any requests were found
        // if (formattedRequests.length === 0) {
        //     return res.status(404).json({ message: "No requests found for this caregiver Or No Rating found for this caregiver" });
        // }

        // Respond with the formatted data
        res.json(formattedRequests);
    } catch (error) {
        console.error("Error retrieving message ratings:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const getRequestsForCaregiver = async (req, res) => {
    try {
        const caregiverId = req.params.caregiverId;

        // Find all requests for the specific caregiver from both models
        const requestsFromRequestModel = await Request.find({ caregiver: caregiverId });

        const requestsFromPublicRequestModel = await publicRequest.find({ caregiver: caregiverId });

        // Combine requests from both models
        const combinedRequests = [...requestsFromRequestModel, ...requestsFromPublicRequestModel];

        // Filter requests to only include those with an approved status
        const approvedRequests = combinedRequests.filter(request => request.status === 'approved');

        // Check if any approved requests were found
        // if (approvedRequests.length === 0) {
        //     return res.status(404).json({ message: "No approved requests found for this caregiver" });
        // }

        // Respond with the approved requests
        res.json(approvedRequests);
    } catch (error) {
        console.error("Error retrieving requests:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


const getCaregiverById = async (req, res) => {
    const { id } = req.params;

    try {
        // Find the caregiver by ID
        let caregiver = await User.findById(id);

        if (!caregiver) {
            return res.status(404).json({ message: 'Caregiver not found' });
        }

        // Return the caregiver data
        res.json({ message: 'Caregiver found', data: caregiver });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server Error' });
    }
};



const approvepubicRequest = async (req, res) => {
    try {
      const { requestId } = req.params;
      const caregiverId = req.user._id;
  
      // Find the request
      const request = await publicRequest.findById(requestId);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }
      if (request.status === 'approved') {
        return res.status(400).json({ message: "Request has already been approved" });
      }
      if (request.status === 'rejected') {
        return res.status(400).json({ message: "Request has already been rejected and cannot be approved" });
      }
      // Check if the caregiver is in the list of caregivers for this request
      if (!request.caregivers.includes(caregiverId)) {
        return res.status(403).json({ message: "You are not authorized to approve this request" });
      }
  
      // Check caregiver availability
      const caregiver = await User.findById(caregiverId);
      if (!caregiver) {
        return res.status(404).json({ message: "Caregiver not found" });
      }
      if (!caregiver.availability) {
        return res.status(400).json({ message: "Caregiver is not available" });
      }
  
      // Approve the request
      request.status = 'approved';
      request.caregiver = caregiverId;
      request.caregiverEmail = req.user.email;
      request.caregiverPhone = req.user.phone;
      request.caregiverName =req.user.userName;
      request.locationCaregiver=req.user.location
      await request.save();
  
      // Calculate appointment and end times
      const appointmentDateTime = new Date(
        new Date().getFullYear(),
        request.appointmentDateTime.month - 1,
        request.appointmentDateTime.day,
        request.appointmentDateTime.hours,
        request.appointmentDateTime.minutes
      );
  
      let endDateTime = new Date(appointmentDateTime);
  
      if (request.determineThePeriodOfService.unit === 'day') {
        endDateTime.setDate(appointmentDateTime.getDate() + request.determineThePeriodOfService.amount);
      } else if (request.determineThePeriodOfService.unit === 'month') {
        endDateTime.setMonth(appointmentDateTime.getMonth() + request.determineThePeriodOfService.amount);
      }
  
      // Update caregiver availability
      caregiver.availability = false;
      caregiver.availabilityEndDate = endDateTime;
      await caregiver.save();
  
      // Schedule job to set availability back to true
      const delay = endDateTime.getTime() - Date.now();
      setTimeout(async () => {
        caregiver.availability = true;
        caregiver.availabilityEndDate = null;
        await caregiver.save();
        console.log(`Caregiver ${caregiver.userName} is now available`);
      }, delay);
  
      // Delete the request for other caregivers
      await publicRequest.deleteMany({ _id: { $ne: requestId }, caregivers: caregiverId });
  
      await notificationSender(request.userEmail, 'Request Approved', `Your request has been approved!(Patient) from ${request.caregiverEmail}`);
      await notificationSender(request.caregiverEmail, 'Request Approved', `You accepted the request from ${request.userNamePatient}!(caregiver)`);
  
      res.status(200).json({ message: "Request approved successfully" });
    } catch (error) {
      console.error("Error approving request:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
const rejectPublicRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const caregiverId = req.user._id;

        // Find the request
        const request = await publicRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }
        
        // Check if the caregiver is in the list of caregivers for this request
        if (!request.caregivers.includes(caregiverId)) {
            return res.status(403).json({ message: "You are not authorized to reject this request" });
        }
        if (request.status === 'rejected') {
            return res.status(400).json({ message: "Request has already been rejected" });
        }
        if (request.status === 'approved') {
            return res.status(400).json({ message: "Request has already been approved and cannot be rejected" });
        }

        // Remove the caregiver from the request
        request.caregivers = request.caregivers.filter(id => id.toString() !== caregiverId.toString());
        
        // Check if there are no caregivers left in the request
        if (request.caregivers.length === 0) {
            request.status = 'rejected';
        }
        request.caregiverEmail=req.user.email;
        
        await request.save();

        // Notify the user about the rejection
        await notificationSender(request.userEmail, 'Request Rejected', `Your request has been rejected by the caregiver from ${request.caregiverEmail}.`);
        // Optionally notify the caregiver
        // await notificationSender(req.user.email, 'Request Rejected', `You have rejected the request from ${request.userNamePatient}.`);

        res.status(200).json({ message: "Request rejected successfully" });
    } catch (error) {
        console.error("Error rejecting request:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
const calculatePrice = (periods) => {
    console.log('Calculating price for periods:', periods); // Log the periods
    let totalPrice = 0;
    periods.forEach(period => {
        if (period.unit === 'day') {
            totalPrice += period.amount * 200;
        } else if (period.unit === 'month') {
            totalPrice += period.amount * 2000;
        }
    });
    return totalPrice;
};

const getPriceForSpecialRequest = async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const request = await Request.findById(requestId); 
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        console.log('Request found:', request); 

        // Ensure determineThePeriodOfService is an array
        const periods = Array.isArray(request.determineThePeriodOfService) ? request.determineThePeriodOfService : [request.determineThePeriodOfService];
        console.log('Periods to calculate price for:', periods); 

        const price = calculatePrice(periods);
        res.json({ price });
    } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};



const getPriceForPublicRequest = async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const request = await publicRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        console.log('Request found:', request); // Log the found request

        // Ensure determineThePeriodOfService is an array
        const periods = Array.isArray(request.determineThePeriodOfService) ? request.determineThePeriodOfService : [request.determineThePeriodOfService];
        console.log('Periods to calculate price for:', periods); // Log the periods array

        const price = calculatePrice(periods);
        res.json({ price });
    } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const createPaymentIntentForSpecialRequest = async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const request = await Request.findById(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Check if the request status is approved
        if (request.status !== 'approved') {
            return res.status(400).json({ error: 'Request is not approved' });
        }

        // Ensure determineThePeriodOfService is an array
        const periods = Array.isArray(request.determineThePeriodOfService) ? request.determineThePeriodOfService : [request.determineThePeriodOfService];
        const price = calculatePrice(periods);

        // Create a Checkout Session with Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: 'Special Service Payment',
                            description: 'Payment for approved special request',
                        },
                        unit_amount: price * 100, // Stripe expects the amount in pence
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `http://localhost:8000/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `http://localhost:8000/cancel`,
            metadata: { requestId: requestId },
        });

        res.status(201).json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const createPaymentIntentForPublicRequest = async (req, res) => {
    try {
        const requestId = req.params.requestId;
        const request = await publicRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Check if the request status is approved
        if (request.status !== 'approved') {
            return res.status(400).json({ error: 'Request is not approved' });
        }

        // Ensure determineThePeriodOfService is an array
        const periods = Array.isArray(request.determineThePeriodOfService) ? request.determineThePeriodOfService : [request.determineThePeriodOfService];
        const price = calculatePrice(periods);

        // Create a Checkout Session with Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'gbp',
                        product_data: {
                            name: 'Service Payment',
                            description: 'Payment for approved service request',
                        },
                        unit_amount: price * 100, // Stripe expects the amount in pence
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `http://localhost:8000/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `http://localhost:8000/cancel`,
            metadata: { requestId: requestId },
        });

        res.status(201).json({ id: session.id });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};



const getCaregiverByToken = async function(req, res) {
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

        // Find the caregiver by decoded token payload
        const caregiver = await User.findById(decoded._id);
        if (!caregiver) {
            return res.status(404).json({ message: "Caregiver not found" });
        }

        // Ensure that only caregiver-related information is sent
        return res.json({
            UserData: {
                _id:caregiver._id,
                userName: caregiver.userName,
                email: caregiver.email,
                dateOfBirth: caregiver.dateOfBirth,
                phone: caregiver.phone,
                gender: caregiver.gender,
                // PricePerDayForSpecialRequest: caregiver.PricePerDayForSpecialRequest,
                availability: caregiver.availability,
                doYouSmoke: caregiver.doYouSmoke,
                canYouDrive: caregiver.canYouDrive,
                biography: caregiver.biography,
                location: caregiver.location,
                profilePhoto:caregiver.profilePhoto
            }
        });
    } catch (error) {
        console.error("Error retrieving caregiver by token:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};




module.exports = {SignUP,SignIN,displayAllCaregiversAndNurses,approveRequest,rejectRequest,forgetPassword,getRequestsForCaregiverWithRole,verifyCode,resetPassword,MakeRating,displayCaregiversByRating,displayCaregivers,changePassword,editCaregiverProfile,getMessageRatingsForCaregiver,getRequestsForCaregiver,getCaregiverById,approvepubicRequest,rejectPublicRequest,approveSpecificRequest,rejectSpecificRequest,MakeRatingForPubicRequest,getPriceForSpecialRequest,getPriceForPublicRequest,createPaymentIntentForSpecialRequest,createPaymentIntentForPublicRequest,getCaregiverByToken}; 




