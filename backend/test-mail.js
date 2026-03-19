import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const mailOptions = {
  from: `"Twiller Test" <${process.env.EMAIL_USER}>`,
  to: "aadichauhan2356@gmail.com", // sends to yourself
  subject: "✅ Twiller — Test Email",
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #15202b; color: #fff; border-radius: 12px; padding: 32px;">
      <h2 style="color: #1d9bf0;">✅ Email is working!</h2>
      <p style="color: #8899a6;">This is a test email from your Twiller backend.</p>
      <p style="color: #8899a6;">Sent at: <strong style="color:#fff">${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</strong></p>
      <p style="color: #8899a6;">From: <strong style="color:#fff">${process.env.EMAIL_USER}</strong></p>
    </div>
  `,
};

console.log("📧 Sending test email to:", process.env.EMAIL_USER);

transporter.sendMail(mailOptions, (err, info) => {
  if (err) {
    console.error("❌ Failed to send email:", err.message);
    process.exit(1);
  } else {
    console.log("✅ Email sent successfully!");
    console.log("   Message ID:", info.messageId);
    process.exit(0);
  }
});
