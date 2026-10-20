import React from "react";
import {
  X,
  Check,
  Sparkles,
  Shield,
  Zap,
  Activity,
  Database,
  HeartPulse,
  Stethoscope,
  ArrowRight,
  Lock,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

export default function PricingModal() {
  const { pricingModalOpen, closePricing, openPayment, activeFeatureGate } = useSubscription();

  if (!pricingModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-6 pb-4 text-center relative border-b border-border/50 bg-secondary/20">
          <button
            onClick={closePricing}
            className="absolute top-5 right-5 p-1.5 rounded-full hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full gradient-bg text-primary-foreground text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Special Limited Pricing
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
            Unlock Full <span className="gradient-text">Medule Health Intelligence</span>
          </h2>

          <p className="text-xs md:text-sm text-muted-foreground max-w-lg mx-auto mt-1.5">
            {activeFeatureGate ? (
              <span className="text-primary font-medium">
                {activeFeatureGate} requires a Medule Pro Pass.
              </span>
            ) : (
              "Get instant access to cloud data saving, your real-time 360° Digital Twin, and clinical AI recommendations."
            )}
          </p>
        </div>

        {/* Pricing Cards Comparison */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
          {/* FREE PLAN */}
          <div className="rounded-2xl border border-border/60 bg-secondary/10 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-foreground text-lg">Free Tier</h3>
                <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                  Basic
                </span>
              </div>
              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-foreground">$0</span>
                <span className="text-xs text-muted-foreground">/ forever</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Great for on-the-spot AI diagnostics and temporary scanning.
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-2 text-foreground">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Single-session Disease AI diagnosis</span>
                </div>
                <div className="flex items-center gap-2 text-foreground">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Single-session Food calorie scanner</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground opacity-60">
                  <X className="h-4 w-4 text-destructive shrink-0" />
                  <span>Cloud Data Saving (Locked)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground opacity-60">
                  <X className="h-4 w-4 text-destructive shrink-0" />
                  <span>Real-time Digital Twin (Locked)</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground opacity-60">
                  <X className="h-4 w-4 text-destructive shrink-0" />
                  <span>Pharmacologist AI Recommendations (Locked)</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border/50 text-center">
              <span className="text-xs text-muted-foreground">Current Active Mode</span>
            </div>
          </div>

          {/* PRO PLAN - STRICTLY CAPPED AT $10 */}
          <div className="rounded-2xl border-2 border-primary/60 bg-primary/5 p-5 relative flex flex-col justify-between shadow-lg">
            <div className="absolute -top-3 right-6 bg-primary text-primary-foreground text-[10px] uppercase font-bold tracking-wider px-3 py-0.5 rounded-full shadow">
              Capped at $10 Max
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground text-lg">Pro Health Pass</h3>
                  <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                </div>
              </div>

              <div className="flex items-baseline gap-1 my-3">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">$9.99</span>
                <span className="text-xs text-muted-foreground">/ one-time or ₹799 INR</span>
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                Unlock all restricted features with zero recurring hidden charges.
              </p>

              {/* Gated Features Checklist */}
              <div className="space-y-3 text-xs">
                {/* 1. Saving Data */}
                <div className="p-2.5 rounded-xl bg-background/80 border border-primary/20 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Database className="h-4 w-4 text-primary shrink-0" />
                    <span>1. Saving Data & History</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-6">
                    Save vitals, save clinical lab reports, food history, and habit logs securely to MongoDB.
                  </p>
                </div>

                {/* 2. Digital Twin */}
                <div className="p-2.5 rounded-xl bg-background/80 border border-primary/20 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <HeartPulse className="h-4 w-4 text-rose-500 shrink-0" />
                    <span>2. 360° Digital Health Twin</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-6">
                    Synthesize vitals, BMI, disease scans & screen time into an evolving biological profile.
                  </p>
                </div>

                {/* 3. Recommendations */}
                <div className="p-2.5 rounded-xl bg-background/80 border border-primary/20 space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Stethoscope className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>3. Clinical Recommendations</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-6">
                    Get physician-grade treatment roadmaps, supplements & medical device suggestions.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-primary/20 space-y-2">
              <button
                type="button"
                onClick={() => openPayment(activeFeatureGate || "Pro Access")}
                className="w-full gradient-bg text-primary-foreground font-semibold py-2.5 px-4 rounded-xl shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <span>Pay $9.99 via Cards, UPI, or Net Banking</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground text-center">
                <div className="flex items-center gap-1 font-medium text-foreground">
                  <Lock className="h-3 w-3 text-emerald-500" />
                  <span>Razorpay Verified: STICK AND DOT MEDIA AND TECHNOLOGY PRIVATE LIMITED</span>
                </div>
                <span>Direct UPI, Cards & Net Banking • 100% Money-Back Guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
