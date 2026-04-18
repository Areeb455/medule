import { useEffect, useRef, useState } from "react";
import { FileText, UtensilsCrossed, Stethoscope, CalendarCheck, Building2, Fingerprint, Lightbulb } from "lucide-react";

const features = [
  { icon: FileText, title: "PDF Parser", text: "Extracts data from medical reports and documents." },
  { icon: UtensilsCrossed, title: "Food Recognition Model", text: "Analyzes dietary intake." },
  { icon: Stethoscope, title: "Disease Recognition Model", text: "Identifies potential conditions from data." },
  { icon: CalendarCheck, title: "Habit Tracker", text: "Monitors and logs daily health habits." },
  { icon: Building2, title: "Patient Management System", text: "A tool for clinics to manage patient records." },
  { icon: Fingerprint, title: "Digital Twin / Real-Time Health Profile", text: "An automatically updating profile of the user's health status." },
  { icon: Lightbulb, title: "Smart Insights & Recommendations", text: "Personalized advice for better health spending and wellness decisions." },
];

const FeaturesSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" className="py-24 hero-gradient">
      <div ref={ref} className="container mx-auto px-6">
        <div className={`text-center mb-16 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Key Features</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Powerful AI-driven tools designed to transform how you manage and understand your health data.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`group bg-card rounded-2xl p-6 card-shadow hover:card-shadow-hover transition-all duration-300 hover:-translate-y-1 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: visible ? `${i * 80}ms` : "0ms" }}
            >
              <div className="mb-4 inline-flex p-3 rounded-xl bg-primary/10 group-hover:gradient-bg group-hover:text-primary-foreground transition-colors duration-300">
                <feature.icon className="h-6 w-6 text-primary group-hover:text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
