import express from "express";
import crypto from "crypto";
import axios from "axios";
import nodemailer from "nodemailer";
import User from "../models/user.js";
import Subscription from "../models/subscription.js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// Plan configuration
const PLANS = {
  free: { name: "Free", price: 0, tweetLimit: 1 },
  bronze: { name: "Bronze", price: 100, tweetLimit: 3 },
  silver: { name: "Silver", price: 300, tweetLimit: 5 },
  gold: { name: "Gold", price: 1000, tweetLimit: Infinity },
};

// PhonePe config
const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;
const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;
const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX || "1";
const PHONEPE_ENV = process.env.PHONEPE_ENV || "SANDBOX";

const PHONEPE_BASE_URL =
  PHONEPE_ENV === "PRODUCTION"
    ? "https://api.phonepe.com/apis/hermes"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox";

// Helper: check if current time is within 10:00-11:00 AM IST
function isWithinPaymentWindow() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  const hours = istTime.getHours();
  const minutes = istTime.getMinutes();
  return hours === 10; // 10:00 AM to 10:59 AM IST
}

// Helper: send invoice email
async function sendInvoiceEmail(userEmail, userName, plan, amount, transactionId) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const planDetails = PLANS[plan];
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  const mailOptions = {
    from: `"Twiller Premium" <${process.env.EMAIL_USER}>`,
    to: userEmail,
    subject: `🎉 Twiller Subscription Activated — ${planDetails.name} Plan`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #15202b; color: #ffffff; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1d9bf0, #7856ff); padding: 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; color: #ffffff;">✨ Twiller Premium</h1>
          <p style="margin: 8px 0 0; opacity: 0.9; font-size: 16px;">Subscription Confirmation</p>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 18px; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
          <p style="color: #8899a6; line-height: 1.6;">Your subscription has been successfully activated! Here are your details:</p>
          
          <div style="background: #192734; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <h3 style="color: #1d9bf0; margin-top: 0;">📋 Invoice Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; color: #8899a6;">Plan</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${planDetails.name}</td></tr>
              <tr><td style="padding: 8px 0; color: #8899a6;">Amount</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">₹${amount}</td></tr>
              <tr><td style="padding: 8px 0; color: #8899a6;">Tweet Limit</td><td style="padding: 8px 0; text-align: right; font-weight: bold;">${planDetails.tweetLimit === Infinity ? "Unlimited" : planDetails.tweetLimit + " per month"}</td></tr>
              <tr><td style="padding: 8px 0; color: #8899a6;">Transaction ID</td><td style="padding: 8px 0; text-align: right; font-size: 12px;">${transactionId}</td></tr>
              <tr><td style="padding: 8px 0; color: #8899a6;">Start Date</td><td style="padding: 8px 0; text-align: right;">${startDate.toLocaleDateString("en-IN")}</td></tr>
              <tr><td style="padding: 8px 0; color: #8899a6;">End Date</td><td style="padding: 8px 0; text-align: right;">${endDate.toLocaleDateString("en-IN")}</td></tr>
            </table>
          </div>
          
          <p style="color: #8899a6; font-size: 14px; line-height: 1.6;">Thank you for subscribing to Twiller Premium! Enjoy your enhanced tweeting experience.</p>
        </div>
        <div style="background: #192734; padding: 16px; text-align: center; font-size: 12px; color: #8899a6;">
          © ${new Date().getFullYear()} Twiller. All rights reserved.
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Invoice email sent to:", userEmail);
  } catch (err) {
    console.error("❌ Email sending failed:", err.message);
  }
}

// ==========================================
// POST /subscription/create-order
// ==========================================
router.post("/create-order", async (req, res) => {
  try {
    const { email, plan } = req.body;

    // Validate plan
    if (!plan || !PLANS[plan] || plan === "free") {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    // Time gate: 10:00 AM - 11:00 AM IST only
    if (!isWithinPaymentWindow()) {
      return res.status(403).json({
        error: "Payment is only allowed between 10:00 AM and 11:00 AM IST",
        timeRestricted: true,
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const amount = PLANS[plan].price;
    const merchantTransactionId = `TW_${user._id}_${Date.now()}`;

    // Build PhonePe payload
    const payload = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: user._id.toString(),
      amount: amount * 100, // PhonePe expects amount in paise
      redirectUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/subscription?status=success&txnId=${merchantTransactionId}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${process.env.BACKEND_URL || "http://localhost:5000"}/subscription/callback`,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
    const checksum =
      crypto
        .createHash("sha256")
        .update(base64Payload + "/pg/v1/pay" + PHONEPE_SALT_KEY)
        .digest("hex") +
      "###" +
      PHONEPE_SALT_INDEX;

    // Create subscription record
    await Subscription.create({
      userId: user._id,
      email,
      plan,
      amount,
      merchantTransactionId,
      status: "created",
    });

    // Call PhonePe API
    const response = await axios.post(
      `${PHONEPE_BASE_URL}/pg/v1/pay`,
      { request: base64Payload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": checksum,
        },
      }
    );

    if (response.data.success) {
      const redirectUrl = response.data.data.instrumentResponse.redirectInfo.url;
      return res.status(200).json({
        success: true,
        redirectUrl,
        merchantTransactionId,
      });
    } else {
      return res.status(400).json({ error: "Failed to create PhonePe order" });
    }
  } catch (error) {
    console.error("Create order error:", error?.response?.data || error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// POST /subscription/callback (PhonePe S2S)
// ==========================================
router.post("/callback", async (req, res) => {
  try {
    const { response: phonepeResponse } = req.body;

    if (!phonepeResponse) {
      return res.status(400).json({ error: "Invalid callback data" });
    }

    // Decode the response
    const decodedResponse = JSON.parse(
      Buffer.from(phonepeResponse, "base64").toString("utf-8")
    );

    const { merchantTransactionId } = decodedResponse.data;

    // Verify checksum
    const verifyChecksum =
      crypto
        .createHash("sha256")
        .update(`/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}` + PHONEPE_SALT_KEY)
        .digest("hex") +
      "###" +
      PHONEPE_SALT_INDEX;

    // Check status from PhonePe
    const statusResponse = await axios.get(
      `${PHONEPE_BASE_URL}/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": verifyChecksum,
          "X-MERCHANT-ID": PHONEPE_MERCHANT_ID,
        },
      }
    );

    const paymentData = statusResponse.data;

    if (paymentData.success && paymentData.code === "PAYMENT_SUCCESS") {
      // Find the subscription record
      const subscription = await Subscription.findOne({ merchantTransactionId });
      if (!subscription) {
        return res.status(404).json({ error: "Subscription record not found" });
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      // Update subscription record
      subscription.status = "paid";
      subscription.phonepeTransactionId = paymentData.data?.transactionId || merchantTransactionId;
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      await subscription.save();

      // Update user
      const user = await User.findById(subscription.userId);
      if (user) {
        user.subscription = {
          plan: subscription.plan,
          orderId: merchantTransactionId,
          paymentId: paymentData.data?.transactionId || merchantTransactionId,
          startDate,
          endDate,
        };
        user.tweetCount = 0;
        user.tweetCountResetDate = endDate;
        await user.save();

        // Send invoice email
        await sendInvoiceEmail(
          user.email,
          user.displayName,
          subscription.plan,
          subscription.amount,
          merchantTransactionId
        );
      }

      return res.status(200).json({ success: true, message: "Payment verified" });
    } else {
      // Update subscription as failed
      await Subscription.findOneAndUpdate(
        { merchantTransactionId },
        { status: "failed" }
      );
      return res.status(400).json({ success: false, message: "Payment failed" });
    }
  } catch (error) {
    console.error("Callback error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// POST /subscription/verify-status
// (Frontend calls this after redirect)
// ==========================================
router.post("/verify-status", async (req, res) => {
  try {
    const { merchantTransactionId } = req.body;

    if (!merchantTransactionId) {
      return res.status(400).json({ error: "Transaction ID required" });
    }

    // Check status from PhonePe
    const verifyChecksum =
      crypto
        .createHash("sha256")
        .update(`/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}` + PHONEPE_SALT_KEY)
        .digest("hex") +
      "###" +
      PHONEPE_SALT_INDEX;

    const statusResponse = await axios.get(
      `${PHONEPE_BASE_URL}/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`,
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": verifyChecksum,
          "X-MERCHANT-ID": PHONEPE_MERCHANT_ID,
        },
      }
    );

    const paymentData = statusResponse.data;

    if (paymentData.success && paymentData.code === "PAYMENT_SUCCESS") {
      // Activate subscription if not already done by callback
      const subscription = await Subscription.findOne({ merchantTransactionId });
      if (subscription && subscription.status !== "paid") {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        subscription.status = "paid";
        subscription.phonepeTransactionId = paymentData.data?.transactionId || merchantTransactionId;
        subscription.startDate = startDate;
        subscription.endDate = endDate;
        await subscription.save();

        const user = await User.findById(subscription.userId);
        if (user) {
          user.subscription = {
            plan: subscription.plan,
            orderId: merchantTransactionId,
            paymentId: paymentData.data?.transactionId || merchantTransactionId,
            startDate,
            endDate,
          };
          user.tweetCount = 0;
          user.tweetCountResetDate = endDate;
          await user.save();

          await sendInvoiceEmail(
            user.email,
            user.displayName,
            subscription.plan,
            subscription.amount,
            merchantTransactionId
          );
        }
      }

      return res.status(200).json({ success: true, message: "Payment verified and subscription activated" });
    } else {
      return res.status(400).json({ success: false, message: "Payment not completed" });
    }
  } catch (error) {
    console.error("Verify status error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GET /subscription/status/:email
// ==========================================
router.get("/status/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const plan = user.subscription?.plan || "free";
    const planConfig = PLANS[plan];

    // Check if subscription expired
    if (plan !== "free" && user.subscription?.endDate) {
      if (new Date() > new Date(user.subscription.endDate)) {
        // Subscription expired, reset to free
        user.subscription.plan = "free";
        user.tweetCount = 0;
        await user.save();

        return res.status(200).json({
          plan: "free",
          planName: "Free",
          tweetCount: 0,
          tweetLimit: PLANS.free.tweetLimit,
          remaining: PLANS.free.tweetLimit,
          expired: true,
        });
      }
    }

    // Reset tweet count if past the reset date
    if (user.tweetCountResetDate && new Date() > new Date(user.tweetCountResetDate)) {
      user.tweetCount = 0;
      const newResetDate = new Date();
      newResetDate.setMonth(newResetDate.getMonth() + 1);
      user.tweetCountResetDate = newResetDate;
      await user.save();
    }

    const remaining =
      planConfig.tweetLimit === Infinity
        ? "unlimited"
        : Math.max(0, planConfig.tweetLimit - user.tweetCount);

    return res.status(200).json({
      plan,
      planName: planConfig.name,
      tweetCount: user.tweetCount,
      tweetLimit: planConfig.tweetLimit === Infinity ? "unlimited" : planConfig.tweetLimit,
      remaining,
      startDate: user.subscription?.startDate,
      endDate: user.subscription?.endDate,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// GET /subscription/plans
// ==========================================
router.get("/plans", (req, res) => {
  const plans = Object.entries(PLANS).map(([key, val]) => ({
    id: key,
    name: val.name,
    price: val.price,
    tweetLimit: val.tweetLimit === Infinity ? "unlimited" : val.tweetLimit,
  }));

  // Check payment window
  const paymentWindowOpen = isWithinPaymentWindow();

  return res.status(200).json({ plans, paymentWindowOpen });
});

export default router;
