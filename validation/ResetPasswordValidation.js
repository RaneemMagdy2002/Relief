const Ajv = require("ajv").default;
const ajv = new Ajv();

const PatientSchema = {
    "type": "object",
    "properties": {
        "newPassword": {"type": "string", "pattern": "^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!#?%$@]).{8,}$"} 
    },
    "required": [ "newPassword"] 
};

module.exports = ajv.compile(PatientSchema);
