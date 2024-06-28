const Ajv = require("ajv").default;
var ajv = new Ajv();
caregiverSchema = {
    "type":"object",
    "properties":{
        "userName":{"type":"string","pattern":"^(?=.*[A-Z])[a-zA-Z0-9_ ]+$"},
        "email": {"type":"string","pattern":"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"},
        "password":{"type":"string","pattern":"^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!#?%$@]).{8,}$"},
        "re_password":{"type":"string","pattern":"^(?=.*[A-Za-z])(?=.*[0-9])(?=.*[!#?%$@]).{8,}$"},
       
        
        "phone":{"type":"string"},
        
        
    },
    "required":["userName","email","password","re_password","phone"]
}


module.exports = ajv.compile(caregiverSchema);



//username
// ^: Asserts the start of the string.
// (?=.*[A-Z]): Positive lookahead to ensure at least one uppercase letter.
// (?=.*_): Positive lookahead to ensure at least one underscore.
// [a-zA-Z0-9_]+: Matches one or more alphanumeric characters or underscores.
// $: Asserts the end of the string.


//password
// ^: Start of the string
// (?=.*[%#$!@]): Positive lookahead to ensure at least one special character from the set %#$!@ is present
// (?=.*[0-9]): Positive lookahead to ensure at least one digit is present
// (?=.*[a-zA-Z]): Positive lookahead to ensure at least one letter (uppercase or lowercase) is present
// .{8,}: Match any character (including special characters, digits, and letters) at least 8 times
// $: End of the string


//phone
// ^: This indicates the beginning of the string.
// (002)?: This part matches "002" optionally. The ? means zero or one occurrence of the preceding element, in this case, "002".
//(010|011|015|012)
// [0-9]{8}: This part matches exactly 8 digits from 0 to 9.