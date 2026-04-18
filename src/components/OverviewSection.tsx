import { useEffect, useRef, useState } from "react";

const OverviewSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="overview" className="py-24 bg-background">
      <div
        ref={ref}
        className={`container mx-auto px-6 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">About Medule</h2>
          <p className="text-muted-foreground leading-relaxed text-lg">
            Medule is an AI-powered health tech platform designed to create a real-time digital twin of a user's health by automatically aggregating medical records, reports, and daily habits into a single, intelligent system. By using advanced AI models, Medule extracts meaningful data from medical documents, analyzes lifestyle patterns, and delivers smart, personalized health insights.
          </p>
          <p className="text-muted-foreground leading-relaxed text-lg">
            The platform addresses major healthcare challenges such as fragmented medical data, outdated treatment plans, and inefficient health spending. It is built for both individual users who want a centralized health profile and clinics that require an efficient patient management system.
          </p>
        </div>
      </div>
    </section>
  );
};

export default OverviewSection;
