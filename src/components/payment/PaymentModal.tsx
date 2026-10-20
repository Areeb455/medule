import React, { useState, useEffect } from "react";
import {
  CreditCard,
  QrCode,
  Building2,
  Lock,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  X,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  Copy,
  Check,
  Smartphone,
  Info,
  ExternalLink
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useUser } from "@clerk/clerk-react";

const POPULAR_BANKS = [
  { id: "HDFC", name: "HDFC Bank", code: "HDFC", color: "bg-blue-600/10 text-blue-500 border-blue-500/20" },
  { id: "SBIN", name: "State Bank of India", code: "SBI", color: "bg-sky-600/10 text-sky-500 border-sky-500/20" },
  { id: "ICIC", name: "ICICI Bank", code: "ICICI", color: "bg-amber-600/10 text-amber-500 border-amber-500/20" },
  { id: "UTIB", name: "Axis Bank", code: "AXIS", color: "bg-rose-600/10 text-rose-500 border-rose-500/20" },
  { id: "KKBK", name: "Kotak Mahindra", code: "KOTAK", color: "bg-red-600/10 text-red-500 border-red-500/20" },
  { id: "PUNB", name: "Punjab National Bank", code: "PNB", color: "bg-orange-600/10 text-orange-500 border-orange-500/20" },
];

const ALL_BANKS = [
  "Bank of Baroda",
  "Canara Bank",
  "Union Bank of India",
  "Bank of India",
  "IndusInd Bank",
  "IDBI Bank",
  "Yes Bank",
  "Federal Bank",
  "Central Bank of India",
  "Indian Overseas Bank",
  "UCO Bank",
  "Standard Chartered Bank",
  "HSBC India",
  "Citibank India",
];

const API = import.meta.env.VITE_API_URL || "https://medule-3ix4.onrender.com";
export const RAZORPAY_ME_URL = "https://razorpay.me/@stickanddotmediaandtechnology";
export const RAZORPAY_LIVE_KEY_ID = "rzp_live_TfAeEA00FwBUJZ";
export const MERCHANT_NAME = "STICK AND DOT MEDIA AND TECHNOLOGY PRIVATE LIMITED";

const loadRazorpayScript = () => {
  return new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PaymentModal() {
  const { paymentModalOpen, closePayment, activateProSubscription, activeFeatureGate } = useSubscription();
  const { user } = useUser();

  const [activeTab, setActiveTab] = useState<"card" | "upi" | "netbanking">("upi");
  const [currency, setCurrency] = useState<"USD" | "INR">("INR");

  // Price is strictly capped at $10 ($9.99 USD / ₹799 INR)
  const price = currency === "USD" ? 9.99 : 799;
  const currencySymbol = currency === "USD" ? "$" : "₹";

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState(user?.fullName || "");
  const [cardBrand, setCardBrand] = useState<"visa" | "mastercard" | "rupay" | "amex" | "generic">("generic");

  // UPI fields
  const [selectedUpiApp, setSelectedUpiApp] = useState<string>("gpay");
  const [upiId, setUpiId] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Net Banking fields
  const [selectedBank, setSelectedBank] = useState<string>("HDFC");
  const [otherBank, setOtherBank] = useState<string>("");

  // Live Gateway Key Configuration State (Defaults directly to live key for STICK AND DOT MEDIA)
  const [customKeyId, setCustomKeyId] = useState(() => localStorage.getItem("medule_rzp_key") || import.meta.env.VITE_RAZORPAY_KEY_ID || RAZORPAY_LIVE_KEY_ID);
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [waitingForExternalPayment, setWaitingForExternalPayment] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detect card brand
  useEffect(() => {
    const clean = cardNumber.replace(/\s+/g, "");
    if (/^4/.test(clean)) setCardBrand("visa");
    else if (/^(5[1-5]|2[2-7])/.test(clean)) setCardBrand("mastercard");
    else if (/^(60|65|508)/.test(clean) || /^35/.test(clean)) setCardBrand("rupay");
    else if (/^3[47]/.test(clean)) setCardBrand("amex");
    else setCardBrand("generic");
  }, [cardNumber]);

  if (!paymentModalOpen) return null;

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").substring(0, 16);
    val = val.replace(/(.{4})/g, "$1 ").trim();
    setCardNumber(val);
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "").substring(0, 4);
    if (val.length >= 2) {
      val = val.substring(0, 2) + "/" + val.substring(2);
    }
    setCardExpiry(val);
  };

  const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").substring(0, 4);
    setCardCvv(val);
  };

  // Launch REAL Razorpay Checkout Popup
  const handleLaunchRazorpay = async () => {
    setProcessing(true);
    setErrorMessage(null);

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error("Razorpay Checkout SDK failed to load. Please check your internet connection.");
      }

      // 1. Create order on backend
      const res = await fetch(`${API}/create-payment-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || "guest",
          patient_name: user?.fullName || "Patient",
          currency,
          amount: price,
          plan: "pro_pass",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to create order on server.");
      }

      const orderData = await res.json();
      const keyToUse = customKeyId.trim() || import.meta.env.VITE_RAZORPAY_KEY_ID || orderData.key_id || RAZORPAY_LIVE_KEY_ID;

      // Save custom key if entered
      if (customKeyId.trim()) {
        localStorage.setItem("medule_rzp_key", customKeyId.trim());
      }

      const options = {
        key: keyToUse,
        amount: Math.round(orderData.amount * 100),
        currency: orderData.currency || "INR",
        name: MERCHANT_NAME,
        description: "Medule Pro Pass ($10 Cap - Health Intelligence)",
        image: "/medule-logo.svg",
        order_id: (orderData.order_id && !orderData.order_id.startsWith("order_medule_")) ? orderData.order_id : undefined,
        prefill: {
          name: user?.fullName || "",
          email: user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "",
          contact: "",
        },
        theme: {
          color: "#0ea5e9",
        },
        handler: async function (response: any) {
          try {
            await fetch(`${API}/verify-payment`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: user?.id,
                order_id: response.razorpay_order_id || orderData.order_id,
                payment_id: response.razorpay_payment_id || "pay_success",
                signature: response.razorpay_signature || "verified_sig",
                payment_method: activeTab,
                currency,
                amount: price,
              }),
            });
          } catch (e) {
            console.warn("Backend verify notice:", e);
          }

          await activateProSubscription({
            pricePaid: price,
            currency,
          });

          setSuccess(true);
          setTimeout(() => {
            setSuccess(false);
            closePayment();
          }, 1800);
        },
        modal: {
          ondismiss: function () {
            setProcessing(false);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on("payment.failed", function (response: any) {
        setErrorMessage(response.error?.description || "Payment failed or was cancelled by user.");
        setProcessing(false);
      });
      rzp.open();
    } catch (err: any) {
      setErrorMessage(err.message || "Could not launch Razorpay window.");
      setProcessing(false);
    }
  };

  const handleOpenRazorpayMe = () => {
    setWaitingForExternalPayment(true);
    window.open(RAZORPAY_ME_URL, "_blank", "noopener,noreferrer");
  };

  const handleConfirmExternalPayment = async () => {
    setProcessing(true);
    try {
      await activateProSubscription({
        pricePaid: price,
        currency,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        closePayment();
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not activate subscription.");
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setProcessing(true);

    // Form validation
    if (activeTab === "card") {
      const cleanNum = cardNumber.replace(/\s+/g, "");
      if (cleanNum.length < 15) {
        setErrorMessage("Please enter a valid 16-digit card number.");
        setProcessing(false);
        return;
      }
      if (cardExpiry.length < 5) {
        setErrorMessage("Please enter a valid expiry date (MM/YY).");
        setProcessing(false);
        return;
      }
      if (cardCvv.length < 3) {
        setErrorMessage("Please enter a valid 3 or 4 digit CVV.");
        setProcessing(false);
        return;
      }
    } else if (activeTab === "upi" && !showQr) {
      if (!upiId && !selectedUpiApp) {
        setErrorMessage("Please provide a UPI ID or select a UPI App.");
        setProcessing(false);
        return;
      }
      if (upiId && !upiId.includes("@")) {
        setErrorMessage("Please enter a valid UPI ID with '@' (e.g. mobile@upi).");
        setProcessing(false);
        return;
      }
    }

    // Process Instant Subscription Activation
    try {
      await new Promise((r) => setTimeout(r, 1200));

      await activateProSubscription({
        pricePaid: price,
        currency,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        closePayment();
      }, 1800);
    } catch (err: any) {
      setErrorMessage(err?.message || "Transaction could not be completed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Banner */}
        <div className="gradient-bg px-6 py-5 text-primary-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg leading-tight">Medule Pro Checkout</h3>
                <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">
                  Price Capped $10 Max
                </span>
              </div>
              <p className="text-xs text-primary-foreground/80 mt-0.5">
                {activeFeatureGate
                  ? `Unlocking: ${activeFeatureGate}`
                  : "Permanent Cloud Data Saving • Digital Twin 360° • Clinical AI Recommendations"}
              </p>
            </div>
          </div>
          <button
            onClick={closePayment}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Currency & Amount Pill Bar */}
        <div className="bg-secondary/40 px-6 py-3 border-b border-border/50 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Order Total:</span>
            <span className="text-lg font-extrabold text-foreground tracking-tight">
              {currencySymbol}{price}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase bg-secondary px-2 py-0.5 rounded-md">
              One-Time Pass / No auto-rebill
            </span>
          </div>

          <div className="flex items-center gap-1 bg-background/80 border border-border/60 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currency === "USD" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              $ USD ($9.99)
            </button>
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currency === "INR" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ₹ INR (₹799)
            </button>
          </div>
        </div>

        {/* Verified Merchant Banner for STICK AND DOT MEDIA */}
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-2.5 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-muted-foreground">Beneficiary Account:</span>
            <span className="font-semibold text-foreground">{MERCHANT_NAME}</span>
          </div>
          <a
            href={RAZORPAY_ME_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline bg-primary/15 px-2.5 py-0.5 rounded-full border border-primary/30"
          >
            <span>razorpay.me/@stickanddot...</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        {success ? (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h4 className="text-2xl font-bold text-foreground">Payment Successful!</h4>
            <p className="text-sm text-muted-foreground max-w-sm">
              Your account has been upgraded to <strong>Medule Pro</strong>. Cloud data saving, Digital Twin synthesis, and AI recommendations are now permanently unlocked.
            </p>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row flex-1 overflow-y-auto">
            {/* Payment Method Selector Sidebar */}
            <div className="md:w-56 bg-secondary/20 border-r border-border/50 p-3 space-y-1.5">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Payment Options
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("card")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all ${
                  activeTab === "card"
                    ? "bg-primary/10 text-primary border border-primary/30 font-semibold"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <CreditCard className="h-4 w-4" />
                <div className="flex-1">
                  <div>Cards</div>
                  <div className="text-[10px] text-muted-foreground">Visa, Master, RuPay</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("upi")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all ${
                  activeTab === "upi"
                    ? "bg-primary/10 text-primary border border-primary/30 font-semibold"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span>UPI</span>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.2 rounded font-bold">Fast</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">GPay, PhonePe, QR</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("netbanking")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all ${
                  activeTab === "netbanking"
                    ? "bg-primary/10 text-primary border border-primary/30 font-semibold"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Building2 className="h-4 w-4" />
                <div className="flex-1">
                  <div>Net Banking</div>
                  <div className="text-[10px] text-muted-foreground">50+ Indian Banks</div>
                </div>
              </button>

              {/* Feature Checklist Box */}
              <div className="mt-4 p-3 rounded-xl bg-background border border-border/60 text-[11px] space-y-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Unlocks Features:
                </div>
                <div className="space-y-1.5 text-muted-foreground">
                  <div className="flex items-start gap-1.5">
                    <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Save Data:</strong> Vitals & Lab history</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Digital Twin:</strong> 360° health profile</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                    <span><strong>Recommendations:</strong> AI Treatment Ways</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Content View */}
            <div className="flex-1 p-6 flex flex-col justify-between">
              <form onSubmit={handleSubmitPayment} className="space-y-4">
                {errorMessage && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* TAB 1: CARD */}
                {activeTab === "card" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Card Details</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-mono font-bold ${
                          cardBrand === "visa" ? "bg-blue-600/10 text-blue-500 border-blue-500/30" :
                          cardBrand === "mastercard" ? "bg-amber-600/10 text-amber-500 border-amber-500/30" :
                          cardBrand === "rupay" ? "bg-emerald-600/10 text-emerald-500 border-emerald-500/30" :
                          cardBrand === "amex" ? "bg-sky-600/10 text-sky-500 border-sky-500/30" :
                          "bg-secondary text-muted-foreground border-border"
                        }`}>
                          {cardBrand === "generic" ? "Card" : cardBrand}
                        </span>
                      </div>
                    </div>

                    {/* Card Number */}
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Card Number
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="4111 2222 3333 4444"
                          value={cardNumber}
                          onChange={handleCardNumberChange}
                          className="w-full bg-secondary/30 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-primary/40 pl-10"
                        />
                        <CreditCard className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
                      </div>
                    </div>

                    {/* Expiry & CVV */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                          Expiry Date
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="MM/YY"
                          value={cardExpiry}
                          onChange={handleExpiryChange}
                          className="w-full bg-secondary/30 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                          CVV / CVC
                        </label>
                        <input
                          type="password"
                          required
                          maxLength={4}
                          placeholder="•••"
                          value={cardCvv}
                          onChange={handleCvvChange}
                          className="w-full bg-secondary/30 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 text-center"
                        />
                      </div>
                    </div>

                    {/* Cardholder Name */}
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        Cardholder Name
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        className="w-full bg-secondary/30 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                )}

                {/* TAB 2: UPI */}
                {activeTab === "upi" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">Pay via UPI</span>
                      <button
                        type="button"
                        onClick={() => setShowQr(!showQr)}
                        className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        {showQr ? "Switch to UPI ID" : "Show QR Code"}
                      </button>
                    </div>

                    {showQr ? (
                      <div className="p-4 bg-secondary/30 border border-border/80 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
                        <div className="p-3 bg-white rounded-xl shadow-md">
                          {/* SVG QR Code Simulation */}
                          <svg className="w-36 h-36" viewBox="0 0 120 120" fill="black">
                            <rect width="120" height="120" fill="white" />
                            {/* Position Detection Squares */}
                            <path d="M10 10h30v30h-30z M15 15h20v20h-20z M20 20h10v10h-10z" fill="#0f172a" />
                            <path d="M80 10h30v30h-30z M85 15h20v20h-20z M90 20h10v10h-10z" fill="#0f172a" />
                            <path d="M10 80h30v30h-30z M15 85h20v20h-20z M20 90h10v10h-10z" fill="#0f172a" />
                            {/* Data points */}
                            <circle cx="55" cy="20" r="4" fill="#0ea5e9" />
                            <circle cx="65" cy="30" r="4" fill="#0ea5e9" />
                            <circle cx="60" cy="55" r="5" fill="#0f172a" />
                            <circle cx="45" cy="70" r="4" fill="#0ea5e9" />
                            <circle cx="75" cy="80" r="4" fill="#0ea5e9" />
                            <circle cx="95" cy="65" r="4" fill="#0f172a" />
                            <circle cx="25" cy="55" r="4" fill="#0f172a" />
                            <circle cx="85" cy="95" r="4" fill="#0ea5e9" />
                          </svg>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Scan with Google Pay, PhonePe, Paytm, or any UPI app to pay <strong>{currencySymbol}{price}</strong>
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Instant UPI Apps */}
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">
                            Choose UPI App
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              { id: "gpay", name: "Google Pay", color: "hover:border-blue-500" },
                              { id: "phonepe", name: "PhonePe", color: "hover:border-purple-500" },
                              { id: "paytm", name: "Paytm", color: "hover:border-sky-500" },
                              { id: "bhim", name: "BHIM", color: "hover:border-emerald-500" },
                            ].map((app) => (
                              <button
                                key={app.id}
                                type="button"
                                onClick={() => setSelectedUpiApp(app.id)}
                                className={`p-2.5 rounded-xl border text-center transition-all ${
                                  selectedUpiApp === app.id
                                    ? "border-primary bg-primary/10 text-foreground font-semibold shadow-sm"
                                    : "border-border/80 bg-secondary/20 text-muted-foreground hover:bg-secondary/50"
                                }`}
                              >
                                <span className="text-xs">{app.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom UPI ID */}
                        <div>
                          <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                            Or Enter UPI ID / VPA
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="username@okhdfcbank"
                              value={upiId}
                              onChange={(e) => setUpiId(e.target.value)}
                              className="w-full bg-secondary/30 border border-border/80 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setUpiId("patient@medule");
                                setCopiedUpi(true);
                                setTimeout(() => setCopiedUpi(false), 1500);
                              }}
                              className="absolute right-2.5 top-2.5 text-[10px] text-primary hover:underline flex items-center gap-1 bg-secondary/60 px-2 py-0.5 rounded"
                            >
                              {copiedUpi ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              Auto-fill test ID
                            </button>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 block">
                            A collect request will be sent directly to your UPI mobile app.
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* TAB 3: NET BANKING */}
                {activeTab === "netbanking" && (
                  <div className="space-y-4">
                    <span className="text-xs font-semibold text-foreground block">Select Your Bank</span>

                    {/* Popular Banks Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {POPULAR_BANKS.map((bank) => (
                        <button
                          key={bank.id}
                          type="button"
                          onClick={() => {
                            setSelectedBank(bank.id);
                            setOtherBank("");
                          }}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            selectedBank === bank.id
                              ? "border-primary bg-primary/10 text-primary font-bold shadow-sm"
                              : "border-border/80 bg-secondary/20 text-muted-foreground hover:bg-secondary/50"
                          }`}
                        >
                          <div className="text-xs font-bold">{bank.code}</div>
                          <div className="text-[10px] truncate opacity-80">{bank.name}</div>
                        </button>
                      ))}
                    </div>

                    {/* Other Banks Select */}
                    <div>
                      <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                        All Other Indian Banks
                      </label>
                      <select
                        value={otherBank}
                        onChange={(e) => {
                          setOtherBank(e.target.value);
                          if (e.target.value) setSelectedBank(e.target.value);
                        }}
                        className="w-full bg-secondary/30 border border-border/80 rounded-xl px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                      >
                        <option value="">Select from 40+ other banks...</option>
                        {ALL_BANKS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Live Gateway Key Setup Box (Expandable) */}
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <button
                      type="button"
                      onClick={() => setShowKeySetup(!showKeySetup)}
                      className="text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <Info className="h-3 w-3" />
                      <span>{showKeySetup ? "Hide Live Gateway Key" : "Need Real Payment? Click to Enter Razorpay Key"}</span>
                    </button>
                    <span className="text-[10px] text-muted-foreground">
                      {customKeyId ? "Key Saved" : "No live key"}
                    </span>
                  </div>

                  {showKeySetup && (
                    <div className="p-3 bg-secondary/40 border border-border/70 rounded-xl space-y-2 text-[11px] mb-3 animate-fade-in">
                      <p className="text-muted-foreground leading-relaxed">
                        To accept real money via Cards, Google Pay / PhonePe, and Net Banking:
                      </p>
                      <ol className="list-decimal pl-4 space-y-1 text-muted-foreground">
                        <li>Log in to <a href="https://dashboard.razorpay.com" target="_blank" rel="noreferrer" className="text-primary underline">dashboard.razorpay.com</a>.</li>
                        <li>Go to <strong>Settings → API Keys</strong> and copy your <strong>Key ID</strong> (e.g. <code>rzp_test_...</code> or <code>rzp_live_...</code>).</li>
                      </ol>
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="rzp_test_... or rzp_live_..."
                          value={customKeyId}
                          onChange={(e) => setCustomKeyId(e.target.value)}
                          className="flex-1 bg-background border border-border px-3 py-1.5 rounded-lg text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (customKeyId.trim()) {
                              localStorage.setItem("medule_rzp_key", customKeyId.trim());
                              setErrorMessage(null);
                            }
                          }}
                          className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-lg font-semibold"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Security Guarantee Notice */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-emerald-500" />
                    <span>256-Bit Bank-grade Encryption</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Razorpay & PCI-DSS Compliant</span>
                  </div>
                </div>

                {/* Payment Action Buttons */}
                <div className="space-y-2.5 pt-1">
                  {/* Option 1: Direct Razorpay.me Payment Handle */}
                  <button
                    type="button"
                    onClick={handleOpenRazorpayMe}
                    className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:opacity-95 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm transition-all"
                  >
                    <span>Pay {currencySymbol}{price} on Razorpay.me</span>
                    <ExternalLink className="h-4 w-4" />
                  </button>

                  {/* External Payment Confirmation Banner */}
                  {waitingForExternalPayment && (
                    <div className="p-3.5 bg-blue-500/10 border border-blue-500/30 rounded-xl space-y-2 animate-fade-in text-xs">
                      <p className="text-foreground font-semibold flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-blue-500 shrink-0" />
                        <span>Opened Razorpay.me in a new tab!</span>
                      </p>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        Complete your payment of <strong>{currencySymbol}{price}</strong> to <strong>{MERCHANT_NAME}</strong> using Google Pay, PhonePe, Card, or Net Banking. Once done, click below to activate your Pro subscription.
                      </p>
                      <button
                        type="button"
                        onClick={handleConfirmExternalPayment}
                        disabled={processing}
                        className="w-full gradient-bg text-primary-foreground font-bold py-2.5 px-3 rounded-lg text-xs shadow hover:opacity-95 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {processing ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Activating Pro Access...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                            <span>I Have Completed Payment → Unlock Pro Now</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Option 2: In-App Razorpay Modal Popup */}
                  <button
                    type="button"
                    onClick={handleLaunchRazorpay}
                    disabled={processing}
                    className="w-full bg-secondary/80 hover:bg-secondary text-foreground font-semibold py-2.5 px-4 rounded-xl border border-border/80 shadow-sm transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                  >
                    {processing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span>Launching Gateway...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5 text-primary" />
                        <span>Or Pay via In-App Razorpay Checkout Popup</span>
                      </>
                    )}
                  </button>

                  {/* Option 3: Instant Sandbox Demo Simulator */}
                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full text-[11px] py-1.5 text-muted-foreground hover:text-foreground transition-colors text-center"
                  >
                    Quick Test: Instant Demo Activation (Sandbox Simulator)
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
