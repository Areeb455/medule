import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import { Menu, X, Activity, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageTranslator from "@/components/LanguageTranslator";
import WebAppConversionModal from "@/components/WebAppConversionModal";

const ALLOWED_EMAILS = [
  "yusufusmani910@gmail.com",
  "areebimam466@gmail.com",
  "omsh0401@gmail.com",
  "areebimam455@gmail.com"
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [webAppModalOpen, setWebAppModalOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useUser();

  const userEmail = user?.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
  const isAllowed = ALLOWED_EMAILS.includes(userEmail);

  const NAV_LINKS = [
    { href: "/medical-report",  label: "Medical Report" },
    { href: "/analyze", label: "Food AI" },
    { href: "/diagnose", label: "Disease AI" },
    { href: "/habits", label: "Habits" },
    { href: "/recommendations", label: "Recommendations" },
    { href: "/dashboard", label: "Digital Twin" },
    ...(isAllowed ? [{ href: "/patients", label: "Patients" }] : []),
  ];

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <Activity className="h-5 w-5 text-primary" />
            <span className="gradient-text">Medule</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                to={link.href}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${pathname === link.href
                    ? "gradient-bg text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Language Translator, Web App CTA & Auth */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Web App Conversion Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWebAppModalOpen(true)}
              className="hidden lg:flex items-center gap-1.5 rounded-full text-xs font-semibold border-primary/30 hover:border-primary/60 text-primary bg-primary/5 hover:bg-primary/10 shadow-sm"
              title="Install or convert Medule to Web App"
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Web App</span>
            </Button>

            <div className="hidden sm:block">
              <LanguageTranslator />
            </div>

            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <Link to="/sign-in">
                <Button className="gradient-bg rounded-full px-5 text-sm">Sign In</Button>
              </Link>
            </SignedOut>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(!open)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden glass border-t border-border/50 px-6 py-4 space-y-3">
            <div className="pb-2 border-b border-border/40 flex items-center justify-between">
              <LanguageTranslator />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  setWebAppModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-full text-xs border-primary/40 text-primary"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Install Web App
              </Button>
            </div>
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${pathname === link.href
                    ? "gradient-bg text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Web App Conversion Modal */}
      <WebAppConversionModal
        isOpen={webAppModalOpen}
        onClose={() => setWebAppModalOpen(false)}
      />
    </>
  );
}
