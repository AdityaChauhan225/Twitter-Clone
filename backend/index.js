import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./models/user.js";
import Tweet from "./models/tweet.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Mount subscription routes
app.use("/subscription", subscriptionRoutes);

app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

const port = process.env.PORT || 5000;
const url = process.env.MONOGDB_URL;

mongoose
  .connect(url)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

//Register
app.post("/register", async (req, res) => {
  try {
    const existinguser = await User.findOne({ email: req.body.email });
    if (existinguser) {
      return res.status(200).send(existinguser);
    }
    const newUser = new User(req.body);
    await newUser.save();
    return res.status(201).send(newUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// loggedinuser
app.get("/loggedinuser", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ error: "Email required" });
    }
    const user = await User.findOne({ email: email });
    return res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// update Profile
app.patch("/userupdate/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const updated = await User.findOneAndUpdate(
      { email },
      { $set: req.body },
      { new: true, upsert: false }
    );
    return res.status(200).send(updated);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// Tweet API

// Plan tweet limits
const PLAN_LIMITS = { free: 1, bronze: 3, silver: 5, gold: Infinity };

// POST (with tweet limit enforcement)
app.post("/post", async (req, res) => {
  try {
    // Check tweet limit
    const user = await User.findById(req.body.author);
    if (!user) return res.status(404).send({ error: "User not found" });

    const plan = user.subscription?.plan || "free";
    const limit = PLAN_LIMITS[plan] || 1;

    // Check if subscription expired
    if (plan !== "free" && user.subscription?.endDate) {
      if (new Date() > new Date(user.subscription.endDate)) {
        user.subscription.plan = "free";
        user.tweetCount = 0;
        await user.save();
        // Re-check with free limit
        if (user.tweetCount >= PLAN_LIMITS.free) {
          return res.status(403).send({
            error: "Tweet limit reached. Your subscription has expired. Please upgrade.",
            limitReached: true,
            plan: "free",
          });
        }
      }
    }

    // Reset tweet count if past reset date
    if (user.tweetCountResetDate && new Date() > new Date(user.tweetCountResetDate)) {
      user.tweetCount = 0;
      const newResetDate = new Date();
      newResetDate.setMonth(newResetDate.getMonth() + 1);
      user.tweetCountResetDate = newResetDate;
      await user.save();
    }

    if (limit !== Infinity && user.tweetCount >= limit) {
      return res.status(403).send({
        error: `Tweet limit reached for ${plan} plan (${limit} tweets/month). Upgrade to post more!`,
        limitReached: true,
        plan,
        tweetCount: user.tweetCount,
        tweetLimit: limit,
      });
    }

    const tweet = new Tweet(req.body);
    await tweet.save();

    // Increment tweet count
    user.tweetCount = (user.tweetCount || 0) + 1;
    if (!user.tweetCountResetDate) {
      const resetDate = new Date();
      resetDate.setMonth(resetDate.getMonth() + 1);
      user.tweetCountResetDate = resetDate;
    }
    await user.save();

    return res.status(201).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// get all tweet
app.get("/post", async (req, res) => {
  try {
    const tweet = await Tweet.find().sort({ timestamp: -1 }).populate("author");
    return res.status(200).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
//  LIKE TWEET
app.post("/like/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (tweet.likedBy.includes(userId)) {
      // Unlike
      tweet.likes = Math.max(0, tweet.likes - 1);
      tweet.likedBy = tweet.likedBy.filter((id) => id.toString() !== userId.toString());
    } else {
      // Like
      tweet.likes += 1;
      tweet.likedBy.push(userId);
    }
    await tweet.save();
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// retweet 
app.post("/retweet/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (tweet.retweetedBy.includes(userId)) {
      // Unretweet
      tweet.retweets = Math.max(0, tweet.retweets - 1);
      tweet.retweetedBy = tweet.retweetedBy.filter((id) => id.toString() !== userId.toString());
    } else {
      // Retweet
      tweet.retweets += 1;
      tweet.retweetedBy.push(userId);
    }
    await tweet.save();
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});