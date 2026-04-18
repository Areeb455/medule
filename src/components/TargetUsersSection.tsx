import { useEffect, useRef, useState } from "react";
import { User, Building, HeartPulse } from "lucide-react";

const users = [
  {
    icon: User,
    title: "Individual Patients",
    text: "Seeking organized and accessible health records.",
  },
  {
    icon: Building,
    title: "Clinics & Healthcare Providers",
    text: "Needing efficient patient data management.",
  },
  {
    icon: HeartPulse,
    title: "Health-Conscious Users",
    text: "Aiming for proactive wellness monitoring.",
  },
];

const TargetUsersSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-24 bg-background">
      <div ref={ref} className="container mx-auto px-6">
        <div className={`text-center mb-16 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">Target Users</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Built for everyone who cares about smarter health management.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {users.map((user, i) => (
            <div
              key={i}
              className={`text-center p-8 rounded-2xl bg-card card-shadow hover:card-shadow-hover transition-all duration-300 hover:-translate-y-1 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: visible ? `${i * 120}ms` : "0ms" }}
            >
              <div className="inline-flex p-4 rounded-2xl gradient-bg mb-5">
                <user.icon className="h-7 w-7 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-foreground text-lg mb-2">{user.title}</h3>
              <p className="text-sm text-muted-foreground">{user.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TargetUsersSection;
