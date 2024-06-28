const Ajv = require("ajv").default;
var ajv = new Ajv();
PatientSchema = {
    "type":"object",
    "properties":{
        "userName":{"type":"string","pattern":"^(?=.*[A-Z])[a-zA-Z0-9_ ]+$"},
        "email": {"type":"string","pattern":"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"},
        "password":{"type":"string","pattern":"^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!#?%$@]).{8,}$"},
        "re_password":{"type":"string","pattern":"^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!#?%$@]).{8,}$"},
        
        "phone":{"type":"string"},
        "healthRecord": {
            "type": "object",
            "properties": {
                "medicines": { "type": "array", "items": { "type": "string" } },
                "diseases": { "type": "array", "items": { "type": "string" } }
            },
            "required": ["medicines", "diseases"]
        }
      

    },
    "required":["userName","email","password","re_password","phone","healthRecord"]
}


module.exports = ajv.compile(PatientSchema);




