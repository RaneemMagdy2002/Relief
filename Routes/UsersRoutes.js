const express=require("express")
const Patientcontroller=require("../controllers/patientController")
const caregivercontroller=require("../controllers/caregiverController")
const authenticatePatient = require("../middleware/authenticatePatient");
const authenticateCaregiver = require("../middleware/authenticateCaregiver");
const upload = require("../middleware/multerMiddleware");
const uploadToCloudinary = require("../middleware/cloudinaryMiddleware");
const multer =require('multer');
const { protect } = require("../utils/tokenChecker");

const route=express.Router()
module.exports=route
// Middleware setup
const optionalUpload = (req, res, next) => {
    upload.single('profilePhoto')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ message: 'File upload error' });
        } else if (err) {
            return res.status(500).json({ message: 'Server error during file upload' });
        }
        next();
    });
};
route.post('/patient/signup',Patientcontroller.SignUP)
route.post('/patient/signin',Patientcontroller.SignIN)
route.put('/patient/editProfile/:id',optionalUpload,Patientcontroller.editProfile)

route.post("/patient/requests", authenticatePatient,Patientcontroller.createRequest);
route.post("/patient/Specificrequests/:caregiverId", authenticatePatient,Patientcontroller.createSpecificRequest);

route.post("/patient/publicrequests", authenticatePatient,Patientcontroller.createPublicRequest);

route.post('/patient/forgot-password', Patientcontroller.forgetPassword);
route.post('/patient/verify-code/:token', Patientcontroller.verifyCode);
route.post('/patient/reset-password/:token',Patientcontroller.resetPassword);
route.put('/patient/changePassword',authenticatePatient,Patientcontroller.changePassword)
route.get("/patient/:patientId/Ratings",Patientcontroller.getAllRatingsMessageForPateint)
route.get("/patient/:patientId/requests",Patientcontroller.getAllRequestsForPatient)
route.get('/patient/:id', Patientcontroller.getPatientById);




route.post('/caregiver/signup', upload.single('certificatePath'),caregivercontroller.SignUP)
route.put('/caregiver/changePassword',authenticateCaregiver,caregivercontroller.changePassword)
route.post('/caregiver/signin',caregivercontroller.SignIN)
route.get('/caregiver/displayAllCaregiversAndNurses',caregivercontroller.displayAllCaregiversAndNurses)
route.get('/caregiver/displayAllCaregivers',caregivercontroller.displayCaregivers)




route.put("/caregiver/requests/approve/:requestId", authenticateCaregiver, caregivercontroller.approveRequest);
route.put("/caregiver/requests/reject/:requestId", authenticateCaregiver, caregivercontroller.rejectRequest);
route.post('/caregiver/forgot-password', caregivercontroller.forgetPassword);
route.post('/caregiver/verify-code/:token', caregivercontroller.verifyCode);
route.post('/caregiver/reset-password/:token', caregivercontroller.resetPassword);


route.post('/requests/:requestId/rate',authenticatePatient,caregivercontroller.MakeRating )
route.post('/publicRequests/:requestId/rate',authenticatePatient,caregivercontroller.MakeRatingForPubicRequest)

route.get("/caregivers/displayCaregiversByRating",caregivercontroller.displayCaregiversByRating)
route.get("/caregiver/:caregiverId/messageRatingse",caregivercontroller.getMessageRatingsForCaregiver)
route.get("/caregiver/:caregiverId/requests",caregivercontroller.getRequestsForCaregiver)
route.put('/caregiver/publicrequests/:requestId/approve', authenticateCaregiver, caregivercontroller.approvepubicRequest);
route.put('/caregiver/publicrequests/:requestId/reject', authenticateCaregiver,caregivercontroller.rejectPublicRequest);
route.put('/caregiver/specificRequests/approve/:requestId', authenticateCaregiver, caregivercontroller.approveSpecificRequest);
route.put('/caregiver/specificRequests/reject/:requestId', authenticateCaregiver, caregivercontroller.rejectSpecificRequest);



route.put('/caregiver/editProfile/:id', optionalUpload, caregivercontroller.editCaregiverProfile);
route.get('/caregiver/:id',caregivercontroller .getCaregiverById);

route.get("/nearbyCaregivers",protect,Patientcontroller.getNearCareGivers)
route.get('/calculate-price-SpecialRequest/:requestId', caregivercontroller.getPriceForSpecialRequest);
route.get('/calculate-price-PublicRequest/:requestId', caregivercontroller.getPriceForPublicRequest);
route.post('/requests/special/:requestId/payment-intent',caregivercontroller.createPaymentIntentForSpecialRequest);
route.post('/requests/public/:requestId/payment-intent', caregivercontroller.createPaymentIntentForPublicRequest);
route.get('/patient/getPatientByToken/:token', Patientcontroller.getPatientByToken);
route.get('/caregiver/getCaregiverByToken/:token',caregivercontroller. getCaregiverByToken);
route.get('/caregiver/:caregiverId/pendingrequest',caregivercontroller. getRequestsForCaregiverWithRole);
route.get('/caregiver/:caregiverId/MyReviews',authenticatePatient,Patientcontroller.getAllMyReviews)

route.get('/match-diseases/:patientId',Patientcontroller.MatchDisease)