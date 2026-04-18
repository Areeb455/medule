import { Heart, Activity, Brain, Pill, Shield } from "lucide-react";
import heroImage from "@/assets/hero-health.jpg";

const FloatingIcon = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`absolute rounded-xl glass p-3 card-shadow animate-float ${className}`}>
    {children}
  </div>
);

const HeroSection = () => {
  return (
    <section className="relative min-h-screen hero-gradient overflow-hidden flex items-center">
      {/* Floating Icons */}
      <FloatingIcon className="top-[15%] left-[8%] hidden lg:block">
        <Heart className="h-5 w-5 text-primary" />
      </FloatingIcon>
      <FloatingIcon className="top-[25%] right-[10%] hidden lg:block animate-float-slow">
        <Activity className="h-5 w-5 text-accent" />
      </FloatingIcon>
      <FloatingIcon className="bottom-[30%] left-[5%] hidden lg:block animate-float-slow">
        <Brain className="h-5 w-5 text-primary" />
      </FloatingIcon>
      <FloatingIcon className="top-[60%] right-[6%] hidden lg:block">
        <Pill className="h-5 w-5 text-accent" />
      </FloatingIcon>
      <FloatingIcon className="top-[10%] right-[30%] hidden lg:block animate-float-slow">
        <Shield className="h-5 w-5 text-primary" />
      </FloatingIcon>

      <div className="container mx-auto px-6 py-20 lg:py-0">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-6 opacity-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground">
              <Activity className="h-4 w-4" />
              AI-Powered Health Platform
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
              Medule – AI-Powered{" "}
              <span className="gradient-text">Digital Health Twin</span>{" "}
              Platform
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
              Your Real-Time Digital Health Twin for Smarter Healthcare Decisions
            </p>
          </div>

          {/* Right Image */}
          <div className="opacity-0 animate-fade-in-up hidden lg:block" style={{ animationDelay: "0.3s" }}>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-primary/5 blur-2xl" />
              <img
                src={heroImage}
                alt="Medule Digital Health Twin Dashboard"
                className="relative rounded-2xl card-shadow w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
