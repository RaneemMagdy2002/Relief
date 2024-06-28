const axios = require('axios');

// Function to send SMS using Infobip API
async function sendSMS(apiKey, sender, phoneNumber, text) {
    try {
        const response = await axios.post(
            'https://api.infobip.com/sms/1/text/single',
            {
                from: sender,
                to: phoneNumber,
                text: text
            },
            {
                headers: {
                    'Authorization': `App ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        console.log('SMS sent successfully:', response.data);
    } catch (error) {
        console.error('Error sending SMS:', error.response.data);
    }
}

module.exports = sendSMS;


