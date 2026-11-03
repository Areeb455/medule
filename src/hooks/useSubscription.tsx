import { useState, useEffect, createContext, useContext, ReactNode, useMemo } from "react";
import { useUser } from "@clerk/clerk-react";

export const EXEMPT_FREE_EMAILS = [
  "yusufusmani910@gmail.com",
  "usmaniyusuf69@gmail.com",
  "areebimam466@gmail.com",
];

export interface SubscriptionStatus {
  isSubscribed: boolean;
  plan: string;
  pricePaid?: number;
  currency?: string;
  activatedAt?: string;
  features: string[];
  isExempt?: boolean;
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
  isExempt: boolean;
}

const DEFAULT_SUB: SubscriptionStatus = {
  isSubscribed: false,
  plan: "free",
  features: [],
};

const EXEMPT_PRO_SUB: SubscriptionStatus = {
  isSubscribed: true,
  plan: "pro_pass",
  pricePaid: 0,
  currency: "USD",
  features: ["save_data", "digital_twin", "recommendations"],
  isExempt: true,
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const API = import.meta.env.VITE_API_URL || "https://medule-3ix4.onrender.com";

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();

  // Determine if current authenticated user has an exempt email
  const userEmails = useMemo(() => {
    if (!user) return [];
    const emails: string[] = [];
    if (user.primaryEmailAddress?.emailAddress) {
      emails.push(user.primaryEmailAddress.emailAddress.toLowerCase().trim());
    }
    if (user.emailAddresses) {
      for (const e of user.emailAddresses) {
        if (e.emailAddress) {
          emails.push(e.emailAddress.toLowerCase().trim());
        }
      }
    }
    return emails;
  }, [user]);

  const isExempt = useMemo(() => {
    return userEmails.some((email) => EXEMPT_FREE_EMAILS.includes(email));
  }, [userEmails]);

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

    if (isExempt) {
      const activeExemptSub: SubscriptionStatus = {
        ...EXEMPT_PRO_SUB,
        activatedAt: new Date().toISOString(),
      };
      setSubscription(activeExemptSub);
      localStorage.setItem("medule_subscription", JSON.stringify(activeExemptSub));

      // Synchronize exempt Pro status with backend so DB records Pro
      try {
        const primaryEmail = userEmails[0] || "";
        await fetch(`${API}/subscription-status/${userId}?email=${encodeURIComponent(primaryEmail)}`);
      } catch (e) {
        // network warning ignored for exempt users
      }
      return;
    }

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
  }, [isLoaded, userId, isExempt]);

  const effectiveSubscription: SubscriptionStatus = isExempt
    ? { ...EXEMPT_PRO_SUB, activatedAt: subscription.activatedAt || new Date().toISOString() }
    : subscription;

  const openPricing = (gateReason?: string) => {
    if (isExempt) return; // Exempt emails have full free access
    setActiveFeatureGate(gateReason || null);
    setPricingModalOpen(true);
  };

  const closePricing = () => {
    setPricingModalOpen(false);
    setActiveFeatureGate(null);
  };

  const openPayment = (gateReason?: string) => {
    if (isExempt) return; // Exempt emails have full free access
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
    if (isExempt) return true; // Unconditional free access to all features
    if (effectiveSubscription.isSubscribed) return true;
    return effectiveSubscription.features.includes(feature);
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription: effectiveSubscription,
        loading,
        pricingModalOpen: isExempt ? false : pricingModalOpen,
        paymentModalOpen: isExempt ? false : paymentModalOpen,
        activeFeatureGate,
        openPricing,
        closePricing,
        openPayment,
        closePayment,
        activateProSubscription,
        hasFeature,
        refreshSubscription,
        isExempt,
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

