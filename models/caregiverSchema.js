const mongoose = require('mongoose'); 
const { buffer } = require('stream/consumers');
var valid = require("validator");

const caregiverSchema = new mongoose.Schema({
    profilePhoto: {type:String},
    
    userName :{type:String, required:true, minlength:3, maxlength:20}, 
 
    email : {
        type:String,
        required:true, 
        validate:{
            validator:(val)=>{return valid.isEmail(val)},
            message:"{Email} Not Valid"
        },
        unique : true 
    }, 

    password : {type:String,required:true},
    re_password : {type:String,required:true}, 

    dateOfBirth :  {required:true , type:Date}, 
    phone:{
        type: String,
        unique: true
    },
    // certificatePath: {type:String,required:true},
    resetPasswordVerificationCode: Number,
    resetPasswordVerificationExpires: Date,
    resetPasswordVerificationToken:String,
    ratings: [{ type: Number }], // Array to store ratings
    
    averageRating: { type: Number, default: 0 },
    gender: { type: String,required:true , enum: ['male', 'female'] },
    availability: { type: Boolean, default: true },
 
    
   doYouSmoke :{type:String, required:true, enum: ['yes','no'] },
   canYouDrive : {type:String, required:true, enum: ['yes','no']},

biography:{type:String , required:true },
extractedDetails: {
   
    diseases: [{ type: String }]
},
location: {
    type: { type: String, default: "Point" },
    coordinates: [Number], // [longitude, latitude]
    },
    availabilityEndDate: { type: Date },
})

const caregivermodel =  mongoose.model('Caregiver', caregiverSchema)

module.exports=caregivermodel