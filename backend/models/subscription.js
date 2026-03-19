import mongoose from "mongoose";

const SubscriptionSchema = mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  email: { type: String, required: true },
  plan: {
    type: String,
    enum: ["free", "bronze", "silver", "gold"],
    required: true,
  },
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  merchantTransactionId: { type: String, required: true, unique: true },
  phonepeTransactionId: { type: String, default: null },
  status: {
    type: String,
    enum: ["created", "paid", "failed"],
    default: "created",
  },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Subscription", SubscriptionSchema);
