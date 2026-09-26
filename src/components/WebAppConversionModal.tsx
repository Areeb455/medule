import { useState, useEffect } from "react";
import {
  Smartphone, Monitor, Download, CheckCircle2,
  ExternalLink, Sparkles, ArrowRight, X, ShieldCheck,
  Zap, Share2, PlusSquare, Globe, Laptop
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface WebAppConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WebAppConversionModal({ isOpen, onClose }: WebAppConversionModalProps) {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<"desktop" | "ios" | "android">("desktop");

  useEffect(() => {
    // Check if running as installed PWA
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone ||
        document.referrer.includes("android-app://");
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();
    window.matchMedia("(display-mode: standalone)").addEventListener("change", checkStandalone);

    // Detect OS
    const userAgent = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform("ios");
    } else if (/android/.test(userAgent)) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    // Capture beforeinstallprompt
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any)._meduleInstallPrompt = e;
    };

    if ((window as any)._meduleInstallPrompt) {
      setDeferredPrompt((window as any)._meduleInstallPrompt);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          toast({
            title: "Installation Started",
            description: "Medule is installing as a standalone Web App.",
          });
          setDeferredPrompt(null);
          (window as any)._meduleInstallPrompt = null;
        }
      } catch (err) {
        console.error("Install prompt error:", err);
      }
    } else if (platform === "desktop") {
      // Launch popup window emulation if native prompt not triggered
      window.open(
        window.location.origin,
        "MeduleWebApp",
        "popup=yes,width=1280,height=850,menubar=no,toolbar=no,location=no,status=no"
      );
      toast({
        title: "Launched Standalone Window",
        description: "Medule opened in app window mode. You can also click the install icon (⊕) in your browser address bar.",
      });
    } else {
      toast({
        title: "Manual Installation",
        description: "Follow the simple on-screen steps below to add Medule to your home screen.",
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-card border border-border/80 rounded-3xl p-6 sm:p-8 card-shadow shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                Web App Provision
              </span>
              {isStandalone ? (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Running in Web App Mode
                </span>
              ) : (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Ready to Convert
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-foreground mt-1">
              Convert Medule to <span className="gradient-text">Web App (PWA)</span>
            </h2>
          </div>
        </div>

        <p className="text-muted-foreground text-xs sm:text-sm mt-1 mb-6 leading-relaxed">
          Transform Medule from a browser tab into a high-performance, standalone desktop or mobile Web Application. Enjoy instant launch, offline digital twin access, and zero address-bar clutter.
        </p>

        {/* Core Value Props Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/40 text-center space-y-1">
            <Zap className="h-4 w-4 text-amber-400 mx-auto" />
            <p className="font-semibold text-foreground text-xs">Instant Launch</p>
            <p className="text-[10px] text-muted-foreground">1-Tap from desktop or home screen</p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/40 text-center space-y-1">
            <Monitor className="h-4 w-4 text-cyan-400 mx-auto" />
            <p className="font-semibold text-foreground text-xs">Standalone UI</p>
            <p className="text-[10px] text-muted-foreground">Clean app window without browser tabs</p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/40 text-center space-y-1">
            <ShieldCheck className="h-4 w-4 text-emerald-400 mx-auto" />
            <p className="font-semibold text-foreground text-xs">Offline Cache</p>
            <p className="text-[10px] text-muted-foreground">View saved twin & reports offline</p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/30 border border-border/40 text-center space-y-1">
            <Globe className="h-4 w-4 text-purple-400 mx-auto" />
            <p className="font-semibold text-foreground text-xs">Cross Platform</p>
            <p className="text-[10px] text-muted-foreground">Windows, Mac, iOS, & Android</p>
          </div>
        </div>

        {/* Platform Selection Tabs */}
        <div className="space-y-4">
          <div className="flex border-b border-border/60 pb-2 gap-2 text-xs">
            <button
              onClick={() => setPlatform("desktop")}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                platform === "desktop"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Laptop className="h-3.5 w-3.5 inline mr-1.5" />
              Desktop (Chrome / Edge / Mac)
            </button>
            <button
              onClick={() => setPlatform("ios")}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                platform === "ios"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 inline mr-1.5" />
              iPhone & iPad (Safari)
            </button>
            <button
              onClick={() => setPlatform("android")}
              className={`px-3.5 py-1.5 rounded-lg font-medium transition-all ${
                platform === "android"
                  ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              <Smartphone className="h-3.5 w-3.5 inline mr-1.5" />
              Android
            </button>
          </div>

          {/* Platform Instructions */}
          <div className="bg-secondary/20 border border-border/50 rounded-2xl p-4 text-xs space-y-2.5">
            {platform === "desktop" && (
              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</div>
                  <p className="text-muted-foreground">
                    Click the <strong className="text-foreground font-semibold">"Install Medule Web App"</strong> button below or look for the <strong className="text-foreground font-semibold">Install icon (⊕)</strong> on the right side of your browser address bar.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</div>
                  <p className="text-muted-foreground">
                    Select <strong className="text-foreground font-semibold">"Install"</strong> in the prompt. Medule will create a desktop icon and open in its dedicated app frame.
                  </p>
                </div>
              </div>
            )}

            {platform === "ios" && (
              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <Share2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">
                    Tap the <strong className="text-foreground font-semibold">Share</strong> button in Safari's bottom toolbar.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <PlusSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">
                    Scroll down and tap <strong className="text-foreground font-semibold">"Add to Home Screen"</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">
                    Tap <strong className="text-foreground font-semibold">"Add"</strong> in top-right corner. Medule will now appear alongside your native apps!
                  </p>
                </div>
              </div>
            )}

            {platform === "android" && (
              <div className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</div>
                  <p className="text-muted-foreground">
                    Tap the <strong className="text-foreground font-semibold">"Install Medule Web App"</strong> button below or tap the Chrome menu (<strong className="text-foreground font-semibold">⋮</strong>).
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</div>
                  <p className="text-muted-foreground">
                    Select <strong className="text-foreground font-semibold">"Install App"</strong> or <strong className="text-foreground font-semibold">"Add to Home screen"</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action CTA */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/50">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            PWA Manifest & Service Worker Active
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-full px-4 text-xs w-1/2 sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInstallApp}
              className="gradient-bg rounded-full px-6 text-xs font-semibold shadow-md hover:opacity-95 w-1/2 sm:w-auto"
            >
              <Download className="h-3.5 w-3.5 mr-2" />
              {deferredPrompt ? "Install Web App Now" : "Install / Open Standalone"}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
