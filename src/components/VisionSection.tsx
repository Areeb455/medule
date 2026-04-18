import { useEffect, useRef, useState } from "react";

const HeartbeatLine = () => (
  <svg viewBox="0 0 800 60" className="w-full max-w-2xl mx-auto h-12 opacity-30" preserveAspectRatio="none">
    <polyline
      points="0,30 150,30 180,30 200,10 220,50 240,20 260,40 280,30 400,30 800,30"
      fill="none"
      stroke="hsl(174, 62%, 40%)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray="1000"
      className="animate-pulse-line"
    />
  </svg>
);

const VisionSection = () => {
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
    <section id="expansion" className="py-24 hero-gradient">
      <div
        ref={ref}
        className={`container mx-auto px-6 text-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
      >
        <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">Expansion Plan</h2>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-10">
          Currently, we are seeking government and global grants to deploy the solutions in medically under-served regions in the country (India) and then globally.
        </p>
        <HeartbeatLine />
      </div>
    </section>
  );
};

export default VisionSection;
