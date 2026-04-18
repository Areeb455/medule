import { Activity } from "lucide-react";

const FooterSection = () => {
  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg gradient-bg">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-lg text-foreground">Medule</span>
              <p className="text-xs text-muted-foreground">Your Real-Time Digital Health Twin</p>
            </div>
          </div>

          <nav className="flex items-center gap-8">
            {[
              { label: "Home", href: "#" },
              { label: "About", href: "#overview" },
              { label: "Features", href: "#features" },
              { label: "Expansion", href: "#expansion" },
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <div className="text-center mb-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Contact Us</h3>
            <p className="text-sm text-muted-foreground">
              Yusuf Usmani - <a href="tel:+919214350924" className="text-primary hover:underline">+91 92143 50924</a>
            </p>
            <p className="text-sm text-muted-foreground">
              <a href="mailto:usmaniyusuf69@gmail.com" className="text-primary hover:underline">usmaniyusuf69@gmail.com</a>
            </p>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © 2026 Medule. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
