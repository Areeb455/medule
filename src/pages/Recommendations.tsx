import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePatient } from "@/hooks/usePatient";
import {
  Lightbulb, Pill, Activity, HeartPulse, MonitorSmartphone,
  AlertTriangle, Loader2, FileText, RotateCcw,
  Sparkles, Leaf, Compass, ArrowRight, ShieldAlert,
  ClipboardList, CheckCircle2, Stethoscope, PlusCircle
} from "lucide-react";

interface RecItem {
  name: string;
  reason: string;
  priority: "High" | "Medium" | "Low";
  instructions?: string;
}

interface RecCategory {
  category: string;
  items: RecItem[];
}

interface SourceReport {
  condition_name: string;
  severity: string;
  date: string;
  summary: string;
}

interface RecommendationsData {
  overall_summary: string;
  recommendations: RecCategory[];
  source_reports?: SourceReport[];
}

const priorityBadge = (p: string) => {
  switch (p) {
    case "High":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "Medium":
      return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
    case "Low":
      return "bg-green-500/10 text-green-400 border-green-500/20";
    default:
      return "bg-secondary/40 text-muted-foreground border-border";
  }
};

const categoryIcon = (cat: string) => {
  const c = cat.toLowerCase();
  if (c.includes("natural") || c.includes("remedy") || c.includes("home")) return <Leaf className="h-5 w-5 text-emerald-400" />;
  if (c.includes("otc") || c.includes("medicine") || c.includes("medication")) return <HeartPulse className="h-5 w-5 text-rose-400" />;
  if (c.includes("supplement") || c.includes("nutrient") || c.includes("vitamin")) return <Pill className="h-5 w-5 text-amber-400" />;
  if (c.includes("device") || c.includes("product") || c.includes("monitor")) return <MonitorSmartphone className="h-5 w-5 text-cyan-400" />;
  if (c.includes("care") || c.includes("pathway") || c.includes("plan")) return <Compass className="h-5 w-5 text-purple-400" />;
  return <Lightbulb className="h-5 w-5 text-primary" />;
};

export default function Recommendations() {
  const { userId, authHeaders, API } = usePatient();
  const { toast } = useToast();

  const [data, setData] = useState<RecommendationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const fetchRecommendations = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/recommendations/${userId}`, { headers });

      if (res.status === 404) {
        setError("No medical reports or disease scans found yet. Upload a pathology report or perform a disease scan to generate personalized recommendations.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load recommendations.");

      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchRecommendations();
  }, [userId]);

  const allCategories = data ? ["All", ...data.recommendations.map(r => r.category)] : ["All"];

  const filteredCategories = data?.recommendations.filter(cat =>
    activeCategory === "All" ? true : cat.category === activeCategory
  ) || [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-6xl space-y-8">

          {/* Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in-up">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-3">
                <Sparkles className="h-3.5 w-3.5" /> AI Clinical Intelligence
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                Smart <span className="gradient-text">Insights & Recommendations</span>
              </h1>
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                Personalized treatment strategies, natural remedies, OTC medicines, dietary supplements, and supportive health products derived directly from your uploaded reports and scanned conditions.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={fetchRecommendations} disabled={loading} variant="outline" className="rounded-full px-5">
                <RotateCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button asChild className="gradient-bg rounded-full px-6 shadow-md hover:opacity-95">
                <Link to="/medical-report">
                  <PlusCircle className="h-4 w-4 mr-2" /> Upload Report
                </Link>
              </Button>
            </div>
          </div>

          {/* Disclaimer Banner */}
          <div className="glass border border-yellow-500/20 rounded-2xl p-4 flex items-start gap-3.5 animate-fade-in-up">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="text-yellow-400 font-semibold">Important Clinical & Safety Disclaimer</p>
              <p className="text-muted-foreground leading-relaxed">
                Recommendations are generated by clinical AI models using data from your uploaded pathology reports and scans for educational and self-care guidance.
                These suggestions focus on non-prescription lifestyle remedies, OTC relief, and nutritional support.
                Always consult a licensed medical professional before beginning any new medication, supplement, or therapy program.
              </p>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-24 glass rounded-2xl animate-fade-in-up">
              <div className="inline-flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-foreground font-medium text-lg">Synthesizing Clinical Records & Reports...</p>
                <span className="text-sm text-muted-foreground max-w-md">
                  Analyzing pathology findings, abnormal lab markers, and diagnosis logs to curate natural remedies, OTC treatments, and products.
                </span>
              </div>
            </div>
          )}

          {/* Empty / Error State */}
          {!loading && error && (
            <div className="glass card-shadow rounded-2xl p-12 text-center animate-fade-in-up space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-xl font-semibold text-foreground">No Medical Data Found</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-4 pt-2">
                <Button asChild className="gradient-bg rounded-full px-7">
                  <Link to="/medical-report">
                    <FileText className="mr-2 h-4 w-4" /> Upload Medical Report
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full px-7">
                  <Link to="/diagnose">
                    <Stethoscope className="mr-2 h-4 w-4" /> Scan Disease / Symptoms
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Main Content */}
          {!loading && data && (
            <div className="space-y-8 animate-fade-in-up">

              {/* Source Reports & Scans */}
              {data.source_reports && data.source_reports.length > 0 && (
                <div className="glass card-shadow rounded-2xl p-6">
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-5 w-5 text-primary" />
                      <h3 className="text-base font-semibold text-foreground">Active Clinical Records Powering Recommendations</h3>
                    </div>
                    <span className="text-xs bg-secondary/50 text-muted-foreground px-3 py-1 rounded-full">
                      {data.source_reports.length} {data.source_reports.length === 1 ? "Record" : "Records"} Analyzed
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.source_reports.map((rep, idx) => (
                      <div key={idx} className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground text-sm truncate">{rep.condition_name}</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            rep.severity === "Mild" ? "bg-green-500/10 text-green-400 border-green-500/20" :
                            rep.severity === "Moderate" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
                            "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>
                            {rep.severity}
                          </span>
                        </div>
                        {rep.date && (
                          <p className="text-[11px] text-muted-foreground">Logged: {rep.date}</p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {rep.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overall AI Summary */}
              <div className="glass card-shadow rounded-2xl p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Sparkles className="h-32 w-32 text-primary" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Clinical Health Summary & Assessment</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                  {data.overall_summary}
                </p>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 border ${
                      activeCategory === cat
                        ? "gradient-bg text-primary-foreground border-transparent shadow-sm scale-105"
                        : "glass text-muted-foreground hover:text-foreground border-border/60 hover:bg-secondary/40"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Categorized Recommendation Cards */}
              <div className="space-y-6">
                {filteredCategories.map((cat, catIdx) => (
                  <div key={catIdx} className="glass card-shadow rounded-2xl p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between gap-4 border-b border-border/40 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10">
                          {categoryIcon(cat.category)}
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-foreground">{cat.category}</h3>
                          <p className="text-xs text-muted-foreground">
                            {cat.items.length} {cat.items.length === 1 ? "recommendation" : "recommendations"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {cat.items.map((item, itemIdx) => (
                        <div
                          key={itemIdx}
                          className="bg-card/50 hover:bg-card border border-border/50 hover:border-primary/40 rounded-xl p-5 space-y-3 transition-all duration-200 hover:-translate-y-0.5 card-shadow"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <h4 className="font-semibold text-foreground text-sm md:text-base">
                                {item.name}
                              </h4>
                            </div>
                            <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full border shrink-0 ${priorityBadge(item.priority)}`}>
                              {item.priority} Priority
                            </span>
                          </div>

                          <div className="space-y-1.5 pl-6">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              <strong className="text-foreground font-medium">Why: </strong>
                              {item.reason}
                            </p>
                            {item.instructions && (
                              <div className="bg-secondary/40 rounded-lg p-2.5 text-[11px] text-muted-foreground leading-relaxed mt-2">
                                <strong className="text-foreground/90 font-medium">Guidance: </strong>
                                {item.instructions}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Quick Access CTA Banner */}
              <div className="glass rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 border border-primary/20">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-lg font-bold text-foreground">Have fresh tests or new symptoms?</h4>
                  <p className="text-xs text-muted-foreground max-w-lg">
                    Upload your latest blood report or use AI disease scanning to keep your product recommendations and treatment guidance always updated.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Button asChild className="gradient-bg rounded-full px-6">
                    <Link to="/medical-report">
                      Upload Medical Report <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="rounded-full px-6">
                    <Link to="/diagnose">
                      Scan Disease
                    </Link>
                  </Button>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>
      <FooterSection />
    </div>
  );
}
