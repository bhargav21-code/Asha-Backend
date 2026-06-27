const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

exports.sendOTPEmail = async (toEmail, otp, name) => {
  await transporter.sendMail({
    from: `"ASHA Health System" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'Password Reset OTP - ASHA Health System',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: #16a34a; padding: 20px; text-align: center;">
          <h2 style="color: white; margin: 0;">ASHA Health System</h2>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
          <p>Hello <strong>${name}</strong>,</p>
          <p>Your OTP for password reset is:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #16a34a;">
              ${otp}
            </span>
          </div>
          <p style="color: #6b7280; font-size: 14px;">
            This OTP is valid for <strong>10 minutes</strong>. 
            Do not share it with anyone.
          </p>
        </div>
      </div>
    `,
  });
};