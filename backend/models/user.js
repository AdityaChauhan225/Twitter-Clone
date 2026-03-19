import mongoose from "mongoose";
const UserSchema = mongoose.Schema({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  bio: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  joinedDate: { type: Date, default: Date.now },
  subscription: {
    plan: { type: String, enum: ["free", "bronze", "silver", "gold"], default: "free" },
    orderId: { type: String, default: null },
    paymentId: { type: String, default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  tweetCount: { type: Number, default: 0 },
  tweetCountResetDate: { type: Date, default: null },
});

export default mongoose.model("User", UserSchema);
