const mongoose = require('mongoose');


    const requestSchema = new mongoose.Schema({

      role: { type: String, default: 'public' },


        HowManyPeopleAreYouArrangingCareFor:{ type: Number, enum: [1,2] , required: true},
        HowManyWeeksOfCareAreRequired:{ type: String, enum: ['1-3 weeks','4-8 weeks','ongoing'] , required: true},
        WhenWouldYouLikeTheCareToStart:{ type: String, enum: ['Immediately','within a week','1-3 month'] , required: true},
        DoesThePropertyHaveAPrivateBedroomForTheCarer:{ type: String, enum: ['yes', 'no'] , required: true},
        DoYouHaveAnyPreferenceOnTheGenderOfTheirCarer:{ type: String, enum: ['male', 'female', 'no preference'] , required: true},
        WouldYouAcceptACarerWhoSmokes:{ type: String, enum: ['yes', 'no'] , required: true},
        DoYouNeedACarerThatCanDrive:{ type: String, enum: ['yes', 'no'] , required: true},
        determineThePeriodOfService: {
          amount: { type: Number, required: true },
          unit: { type: String, enum: ['day', 'month'], required: true },
        
      },

      appointmentDateTime: {
        day: { type: Number, required: true },
        month: { type: Number, required: true },
       
        hours: { type: Number, required: true },
        minutes: { type: Number, required: true },
      
    },
  
  


        user: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }, // Status of the request
        userEmail:{ type: String,required: true},
        healthRecordPatient: {
          medicines: [{ type: String }],
          diseases: [{ type: String }]
        },
        locationPatient: {
          type: { type: String, default: "Point" },
          coordinates: [Number], // [longitude, latitude]
      },
        caregiver: { type: mongoose.Schema.Types.ObjectId, ref: 'Caregiver' }, // Store caregiver's ID
        caregiverEmail:{ type: String},
        caregiverName:{type: String },
        locationCaregiver: {
          type: { type: String, default: "Point" },
          coordinates: [Number], // [longitude, latitude]
      },
        userNamePatient:{ type: String},
       
        rating: { type: Number, min: 0, max: 5 },
        messageRating:{type:String,required:false},
        caregiverPhone:{ type: String},
        patientPhone:{ type: String},
        caregivers:[]

      });


module.exports = mongoose.model('publicRequest', requestSchema);