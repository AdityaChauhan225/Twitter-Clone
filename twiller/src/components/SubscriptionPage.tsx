"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import {
  Crown,
  Zap,
  Star,
  Gem,
  Check,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import axiosInstance from "@/lib/axiosInstance";

interface PlanInfo {
  id: string;
  name: string;
  price: number;
  tweetLimit: string | number;
}

interface SubStatus {
  plan: string;
  planName: string;
  tweetCount: number;
  tweetLimit: string | number;
  remaining: string | number;
  startDate?: string;
  endDate?: string;
}

const planIcons: Record<string, React.ReactNode> = {
  free: <Zap className="h-8 w-8" />,
  bronze: <Star className="h-8 w-8" />,
  silver: <Gem className="h-8 w-8" />,
  gold: <Crown className="h-8 w-8" />,
};

const planGradients: Record<string, string> = {
  free: "from-gray-700 to-gray-900",
  bronze: "from-amber-700 to-amber-900",
  silver: "from-slate-400 to-slate-600",
  gold: "from-yellow-500 to-amber-600",
};

const planBorders: Record<string, string> = {
  free: "border-gray-700",
  bronze: "border-amber-600",
  silver: "border-slate-400",
  gold: "border-yellow-500",
};

const planGlow: Record<string, string> = {
  free: "",
  bronze: "shadow-amber-500/20",
  silver: "shadow-slate-400/20",
  gold: "shadow-yellow-500/30",
};

export default function SubscriptionPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const [paymentWindowOpen, setPaymentWindowOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();

    // Check for return from PhonePe redirect
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get("status");
    const txnId = urlParams.get("txnId");
    if (status === "success" && txnId) {
      verifyPayment(txnId);
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plansRes, statusRes] = await Promise.all([
        axiosInstance.get("/subscription/plans"),
        axiosInstance.get(`/subscription/status/${user?.email}`),
      ]);
      setPlans(plansRes.data.plans);
      setPaymentWindowOpen(plansRes.data.paymentWindowOpen);
      setSubStatus(statusRes.data);
    } catch (err) {
      console.error("Failed to load subscription data:", err);
    } finally {
      setLoading(false);
    }
  };

  const verifyPayment = async (txnId: string) => {
    try {
      setProcessingPlan("verifying");
      const res = await axiosInstance.post("/subscription/verify-status", {
        merchantTransactionId: txnId,
      });
      if (res.data.success) {
        setMessage({
          type: "success",
          text: "🎉 Payment successful! Your subscription is now active. Check your email for the invoice.",
        });
        fetchData();
      } else {
        setMessage({
          type: "error",
          text: "Payment verification failed. Please contact support.",
        });
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Payment verification failed.",
      });
    } finally {
      setProcessingPlan(null);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!user || planId === "free") return;

    setProcessingPlan(planId);
    setMessage(null);

    try {
      const res = await axiosInstance.post("/subscription/create-order", {
        email: user.email,
        plan: planId,
      });

      if (res.data.success && res.data.redirectUrl) {
        // Redirect to PhonePe checkout
        window.location.href = res.data.redirectUrl;
      } else {
        setMessage({ type: "error", text: "Failed to create payment order." });
      }
    } catch (err: any) {
      const errData = err.response?.data;
      if (errData?.timeRestricted) {
        setMessage({
          type: "error",
          text: "⏰ Payments are only accepted between 10:00 AM and 11:00 AM IST. Please try again during this window.",
        });
      } else {
        setMessage({
          type: "error",
          text: errData?.error || "Something went wrong.",
        });
      }
    } finally {
      setProcessingPlan(null);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  const currentPlan = subStatus?.plan || "free";

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 z-10 px-4 py-3">
        <h1 className="text-xl font-bold text-white">Premium Plans</h1>
        <p className="text-sm text-gray-400 mt-1">
          Upgrade your tweeting experience
        </p>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto">
        {/* Current plan status */}
        {subStatus && (
          <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-800/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Current Plan</p>
                <p className="text-lg font-bold text-white flex items-center gap-2">
                  {planIcons[currentPlan]}
                  {subStatus.planName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Tweets Used</p>
                <p className="text-lg font-bold text-white">
                  {subStatus.tweetCount} /{" "}
                  {subStatus.tweetLimit === "unlimited"
                    ? "∞"
                    : subStatus.tweetLimit}
                </p>
              </div>
            </div>
            {subStatus.remaining !== "unlimited" &&
              typeof subStatus.remaining === "number" &&
              subStatus.remaining <= 1 && (
                <div className="mt-3 flex items-center gap-2 text-amber-400 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  {subStatus.remaining === 0
                    ? "You've reached your tweet limit! Upgrade to post more."
                    : "You have only 1 tweet remaining this month."}
                </div>
              )}
            {subStatus.endDate && (
              <p className="text-xs text-gray-500 mt-2">
                Renews: {new Date(subStatus.endDate).toLocaleDateString("en-IN")}
              </p>
            )}
          </div>
        )}

        {/* Time window notice */}
        <div
          className={`mb-6 p-3 rounded-lg flex items-center gap-3 text-sm ${
            paymentWindowOpen
              ? "bg-green-900/30 border border-green-700/50 text-green-300"
              : "bg-red-900/30 border border-red-700/50 text-red-300"
          }`}
        >
          <Clock className="h-5 w-5 flex-shrink-0" />
          <div>
            <p className="font-semibold">
              {paymentWindowOpen
                ? "✅ Payment window is OPEN"
                : "🔒 Payment window is CLOSED"}
            </p>
            <p className="text-xs opacity-80 mt-0.5">
              Payments are accepted only between 10:00 AM – 11:00 AM IST daily
            </p>
          </div>
        </div>

        {/* Success/Error message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg text-sm ${
              message.type === "success"
                ? "bg-green-900/30 border border-green-700/50 text-green-300"
                : "bg-red-900/30 border border-red-700/50 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.id;
            const isUpgrade =
              ["bronze", "silver", "gold"].indexOf(plan.id) >
              ["bronze", "silver", "gold"].indexOf(currentPlan);
            const canSubscribe =
              plan.id !== "free" && !isCurrentPlan && paymentWindowOpen;

            return (
              <Card
                key={plan.id}
                className={`relative overflow-hidden border-2 transition-all duration-300 hover:scale-[1.02] ${
                  isCurrentPlan
                    ? `${planBorders[plan.id]} shadow-lg ${planGlow[plan.id]}`
                    : "border-gray-800 hover:border-gray-700"
                } bg-black`}
              >
                {/* Gradient header */}
                <div
                  className={`bg-gradient-to-br ${planGradients[plan.id]} p-4 text-center`}
                >
                  <div className="text-white mb-1">{planIcons[plan.id]}</div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  {isCurrentPlan && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs font-bold rounded-full bg-white/20 text-white">
                      CURRENT
                    </span>
                  )}
                </div>

                <CardContent className="p-4">
                  {/* Price */}
                  <div className="text-center mb-4">
                    {plan.price === 0 ? (
                      <p className="text-2xl font-bold text-white">Free</p>
                    ) : (
                      <div>
                        <span className="text-3xl font-bold text-white">
                          ₹{plan.price}
                        </span>
                        <span className="text-gray-400 text-sm">/month</span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-4">
                    <li className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                      {plan.tweetLimit === "unlimited"
                        ? "Unlimited tweets"
                        : `${plan.tweetLimit} tweet${Number(plan.tweetLimit) > 1 ? "s" : ""} per month`}
                    </li>
                    {plan.id !== "free" && (
                      <li className="flex items-center gap-2 text-sm text-gray-300">
                        <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                        Email invoice on subscription
                      </li>
                    )}
                    {plan.id === "gold" && (
                      <li className="flex items-center gap-2 text-sm text-gray-300">
                        <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
                        Priority support
                      </li>
                    )}
                  </ul>

                  {/* CTA Button */}
                  {plan.id === "free" ? (
                    <Button
                      disabled
                      className="w-full bg-gray-800 text-gray-400 rounded-full"
                    >
                      {isCurrentPlan ? "Current Plan" : "Default"}
                    </Button>
                  ) : isCurrentPlan ? (
                    <Button
                      disabled
                      className="w-full bg-gray-800 text-gray-400 rounded-full"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Active
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={!canSubscribe || processingPlan !== null}
                      className={`w-full rounded-full font-semibold transition-all ${
                        canSubscribe
                          ? `bg-gradient-to-r ${planGradients[plan.id]} hover:opacity-90 text-white`
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {processingPlan === plan.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {processingPlan === plan.id
                        ? "Processing..."
                        : !paymentWindowOpen
                          ? "Window Closed"
                          : isUpgrade
                            ? "Upgrade"
                            : "Subscribe"}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info footer */}
        <div className="mt-8 p-4 rounded-lg bg-gray-900/50 border border-gray-800">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">
            How it works
          </h4>
          <ul className="text-xs text-gray-500 space-y-1.5">
            <li>• Free plan users can post 1 tweet per month</li>
            <li>• Paid plans unlock more tweets with monthly billing</li>
            <li>• Payments are processed securely via PhonePe</li>
            <li>• Payment window: 10:00 AM – 11:00 AM IST daily</li>
            <li>• Invoice emailed upon successful subscription</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
