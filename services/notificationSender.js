const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: 'reliefappemail@gmail.com',
    pass: 'qbax aoca gdgt gtrx'
  }
});

async function sendNotification(recipient, subject, message) {
  const info = await transporter.sendMail({
    from: 'reliefappemail@gmail.com',
    to: recipient,
    subject,
    text: message
  });

  console.log('Notification sent:', info.response);
}

module.exports = sendNotification;