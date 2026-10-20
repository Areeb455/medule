import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";

export interface SubscriptionStatus {
  isSubscribed: boolean;
  plan: string;
  pricePaid?: number;
  currency?: string;
  activatedAt?: string;
  features: string[];
}

interface SubscriptionContextType {
  subscription: SubscriptionStatus;
  loading: boolean;
  pricingModalOpen: boolean;
  paymentModalOpen: boolean;
  activeFeatureGate: string | null;
  openPricing: (gateReason?: string) => void;
  closePricing: () => void;
  openPayment: (gateReason?: string) => void;
  closePayment: () => void;
  activateProSubscription: (details?: Partial<SubscriptionStatus>) => Promise<void>;
  hasFeature: (feature: "save_data" | "digital_twin" | "recommendations") => boolean;
  refreshSubscription: () => Promise<void>;
}

const DEFAULT_SUB: SubscriptionStatus = {
  isSubscribed: false,
  plan: "free",
  features: [],
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const API = import.meta.env.VITE_API_URL || "https://medule-3ix4.onrender.com";

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const [subscription, setSubscription] = useState<SubscriptionStatus>(() => {
    // Check local cache first for instant UI response
    const cached = localStorage.getItem("medule_subscription");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_SUB;
  });

  const [loading, setLoading] = useState(false);
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [activeFeatureGate, setActiveFeatureGate] = useState<string | null>(null);

  const userId = user?.id;

  const refreshSubscription = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await fetch(`${API}/subscription-status/${userId}`);
      if (res.ok) {
        const data = await res.json();
        const updated: SubscriptionStatus = {
          isSubscribed: data.is_premium || false,
          plan: data.plan || "free",
          pricePaid: data.price_paid || 9.99,
          currency: data.currency || "USD",
          activatedAt: data.activated_at,
          features: data.features || (data.is_premium ? ["save_data", "digital_twin", "recommendations"] : []),
        };
        setSubscription(updated);
        localStorage.setItem("medule_subscription", JSON.stringify(updated));
      }
    } catch (err) {
      console.warn("Could not check subscription from server:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && userId) {
      refreshSubscription();
    }
  }, [isLoaded, userId]);

  const openPricing = (gateReason?: string) => {
    setActiveFeatureGate(gateReason || null);
    setPricingModalOpen(true);
  };

  const closePricing = () => {
    setPricingModalOpen(false);
    setActiveFeatureGate(null);
  };

  const openPayment = (gateReason?: string) => {
    if (gateReason) setActiveFeatureGate(gateReason);
    setPricingModalOpen(false);
    setPaymentModalOpen(true);
  };

  const closePayment = () => {
    setPaymentModalOpen(false);
    setActiveFeatureGate(null);
  };

  const activateProSubscription = async (details?: Partial<SubscriptionStatus>) => {
    const updated: SubscriptionStatus = {
      isSubscribed: true,
      plan: "pro_pass",
      pricePaid: details?.pricePaid || 9.99,
      currency: details?.currency || "USD",
      activatedAt: new Date().toISOString(),
      features: ["save_data", "digital_twin", "recommendations"],
      ...details,
    };
    setSubscription(updated);
    localStorage.setItem("medule_subscription", JSON.stringify(updated));

    // Sync to backend if logged in
    if (userId) {
      try {
        await fetch(`${API}/verify-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            order_id: "order_" + Math.random().toString(36).substring(2, 9),
            payment_id: "pay_" + Math.random().toString(36).substring(2, 9),
            signature: "verified_client_sig",
            payment_method: details?.currency === "INR" ? "upi" : "card",
            amount: updated.pricePaid,
            currency: updated.currency,
          }),
        });
      } catch (e) {
        console.warn("Backend sync notice:", e);
      }
    }
  };

  const hasFeature = (feature: "save_data" | "digital_twin" | "recommendations"): boolean => {
    if (subscription.isSubscribed) return true;
    return subscription.features.includes(feature);
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        pricingModalOpen,
        paymentModalOpen,
        activeFeatureGate,
        openPricing,
        closePricing,
        openPayment,
        closePayment,
        activateProSubscription,
        hasFeature,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}
