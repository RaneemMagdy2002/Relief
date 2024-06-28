const mongoose = require('mongoose'); 
var valid = require("validator");

const PateintSchema = new mongoose.Schema({
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

    dateOfBirth : {type:Date,required:true}, 
    phone:{
        type: String,
        unique: true
    },
    healthRecordText: {type: String},
    healthRecord: {
        medicines: [{ type: String }],
        diseases: [{ type: String }]
    },
    resetPasswordVerificationCode: Number,
    resetPasswordVerificationExpires: Date,
    resetPasswordVerificationToken:String,
    gender: { type: String, enum: ['male', 'female'] },
    
    location: {
        type: { type: String, default: "Point" },
        coordinates: [Number], // [longitude, latitude]
    },
    
    
})

const Pateintmodel =  mongoose.model('Patient', PateintSchema)

module.exports=Pateintmodel