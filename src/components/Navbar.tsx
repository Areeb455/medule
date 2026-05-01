import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Menu, X, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/analyze",   label: "Food AI" },
  { href: "/diagnose",  label: "Disease AI" },
  { href: "/habits",    label: "Habits" },
  { href: "/dashboard", label: "Digital Twin" },
  { href: "/patients",  label: "Patients" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname }    = useLocation();

  return (
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
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                pathname === link.href
                  ? "gradient-bg text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
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
        <div className="md:hidden glass border-t border-border/50 px-6 py-4 space-y-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              to={link.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                pathname === link.href
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
  );
}