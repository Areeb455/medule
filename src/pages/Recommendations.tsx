import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePatient } from "@/hooks/usePatient";
import WebAppConversionModal from "@/components/WebAppConversionModal";
import {
  Lightbulb, Pill, Activity, HeartPulse, MonitorSmartphone,
  AlertTriangle, Loader2, FileText, RotateCcw,
  Sparkles, Leaf, Compass, ArrowRight, ShieldAlert,
  ClipboardList, CheckCircle2, Stethoscope, PlusCircle,
  ExternalLink, ShoppingCart, Tag, Smartphone, Utensils,
  Clock, ShieldCheck, Info
} from "lucide-react";

interface RecItem {
  name: string;
  brand?: string;
  target_source?: string;
  reason: string;
  priority: "High" | "Medium" | "Low";
  estimated_price?: string;
  affiliate_store?: string;
  affiliate_link?: string;
  affiliate_badge?: string;
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

interface DataSourcesAnalyzed {
  vitals_summary?: string;
  food_count: number;
  habit_count: number;
  disease_count: number;
}

interface RecommendationsData {
  overall_summary: string;
  data_sources_analyzed?: DataSourcesAnalyzed;
  recommendations: RecCategory[];
  source_reports?: SourceReport[];
  recent_food?: string[];
  recent_habits?: string[];
  vitals?: any;
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
  if (c.includes("natural") || c.includes("remedy") || c.includes("home") || c.includes("nutrition"))
    return <Leaf className="h-5 w-5 text-emerald-400" />;
  if (c.includes("otc") || c.includes("medicine") || c.includes("medication"))
    return <HeartPulse className="h-5 w-5 text-rose-400" />;
  if (c.includes("supplement") || c.includes("nutrient") || c.includes("vitamin"))
    return <Pill className="h-5 w-5 text-amber-400" />;
  if (c.includes("device") || c.includes("product") || c.includes("monitor"))
    return <MonitorSmartphone className="h-5 w-5 text-cyan-400" />;
  if (c.includes("care") || c.includes("pathway") || c.includes("routine") || c.includes("plan"))
    return <Compass className="h-5 w-5 text-purple-400" />;
  return <Lightbulb className="h-5 w-5 text-primary" />;
};

export default function Recommendations() {
  const { userId, authHeaders, API } = usePatient();
  const { toast } = useToast();

  const [data, setData] = useState<RecommendationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [webAppModalOpen, setWebAppModalOpen] = useState(false);

  const fetchRecommendations = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/recommendations/${userId}`, { headers });

      if (res.status === 404) {
        setError(
          "No health records found yet in your Digital Twin. Log your meals in Food AI, screen time in Habits, or upload a medical report to generate personalized holistic recommendations."
        );
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
                <Sparkles className="h-3.5 w-3.5" /> Digital Twin 360° Recommendations
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                Smart <span className="gradient-text">Insights & Recommended Products</span>
              </h1>
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                Holistic treatment guidance, actual branded health products, supplements, and OTC remedies synthesized directly from your vitals, food logs, screen habits, and clinical pathology reports.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                onClick={() => setWebAppModalOpen(true)}
                variant="outline"
                className="rounded-full px-4 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10"
              >
                <Smartphone className="h-3.5 w-3.5 mr-1.5" />
                Web App
              </Button>
              <Button onClick={fetchRecommendations} disabled={loading} variant="outline" className="rounded-full px-4 text-xs">
                <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button asChild className="gradient-bg rounded-full px-5 text-xs shadow-md hover:opacity-95">
                <Link to="/medical-report">
                  <PlusCircle className="h-3.5 w-3.5 mr-1.5" /> Upload Report
                </Link>
              </Button>
            </div>
          </div>

          {/* Disclaimer & Safety Banner */}
          <div className="glass border border-yellow-500/20 rounded-2xl p-4 flex items-start gap-3.5 animate-fade-in-up">
            <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="text-yellow-400 font-semibold">Clinical & Affiliate Safety Notice</p>
              <p className="text-muted-foreground leading-relaxed">
                Recommendations are generated by clinical pharmacologist AI models using all accumulated features of your Digital Twin (vitals, diet, habits, and pathology records). Products and OTC suggestions are for wellness and supportive care. Always consult your primary physician before starting any new medicinal therapy.
              </p>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-24 glass rounded-2xl animate-fade-in-up">
              <div className="inline-flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-foreground font-medium text-lg">Synthesizing Digital Twin Health Streams...</p>
                <span className="text-sm text-muted-foreground max-w-md">
                  Analyzing vitals, dietary nutrition, screen & habit logs, and clinical pathology to curate personalized products with verified partner links.
                </span>
              </div>
            </div>
          )}

          {/* Empty / Error State */}
          {!loading && error && (
            <div className="glass card-shadow rounded-2xl p-12 text-center animate-fade-in-up space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Activity className="h-8 w-8" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-xl font-semibold text-foreground">Digital Twin Needs Initial Data</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button asChild className="gradient-bg rounded-full px-6 text-xs">
                  <Link to="/analyze">
                    <Utensils className="mr-2 h-4 w-4" /> Log Food & Nutrition
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full px-6 text-xs">
                  <Link to="/habits">
                    <Clock className="mr-2 h-4 w-4" /> Track Daily Habits
                  </Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full px-6 text-xs">
                  <Link to="/medical-report">
                    <FileText className="mr-2 h-4 w-4" /> Upload Medical Report
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Main Content */}
          {!loading && data && (
            <div className="space-y-8 animate-fade-in-up">

              {/* 360° Digital Twin Accumulator Summary Cards */}
              <div className="glass card-shadow rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4 border-b border-border/40 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <h3 className="text-base font-semibold text-foreground">
                      Digital Twin Data Streams Powering Recommendations
                    </h3>
                  </div>
                  <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-medium">
                    Holistic Multi-Feature Analysis
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Vitals */}
                  <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-primary text-xs font-semibold">
                      <HeartPulse className="h-4 w-4" />
                      <span>Vitals & Body Metrics</span>
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      {data.data_sources_analyzed?.vitals_summary && data.data_sources_analyzed.vitals_summary !== "Not recorded"
                        ? data.data_sources_analyzed.vitals_summary
                        : "General baseline vitals"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Calibrated for body mass & age</p>
                  </div>

                  {/* Food / Nutrition */}
                  <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                      <Utensils className="h-4 w-4" />
                      <span>Diet & Nutrition Logs</span>
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      {data.data_sources_analyzed?.food_count || 0} Meals & Food Logs
                    </p>
                    <p className="text-[11px] text-muted-foreground">Calorie intake & micronutrient gaps</p>
                  </div>

                  {/* Lifestyle / Habits */}
                  <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                      <Clock className="h-4 w-4" />
                      <span>Lifestyle & Screen Time</span>
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      {data.data_sources_analyzed?.habit_count || 0} Habit Sessions
                    </p>
                    <p className="text-[11px] text-muted-foreground">Screen strain, activity & idle habits</p>
                  </div>

                  {/* Pathology / Scans */}
                  <div className="bg-secondary/30 border border-border/50 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
                      <ClipboardList className="h-4 w-4" />
                      <span>Clinical Reports & Scans</span>
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      {data.data_sources_analyzed?.disease_count || 0} Reports & Scans
                    </p>
                    <p className="text-[11px] text-muted-foreground">Biomarkers, conditions & lab flags</p>
                  </div>
                </div>
              </div>

              {/* Overall AI Summary */}
              <div className="glass card-shadow rounded-2xl p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Sparkles className="h-32 w-32 text-primary" />
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Holistic Digital Twin Health Synthesis</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-base">
                  {data.overall_summary}
                </p>
              </div>

              {/* Affiliate Disclosure Box */}
              <div className="glass border border-primary/20 rounded-2xl p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-medium">Affiliate Partnerships & Price Transparency: </strong>
                  Medule partners with verified health suppliers (including Amazon Health, Tata 1mg, and Apollo Pharmacy). When you purchase recommended products through our verified links, Medule may earn an affiliate commission at zero extra cost to you. Pricing displayed is estimated based on live market availability.
                </div>
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

              {/* Categorized Recommendation Cards with Actual Products & Affiliate Links */}
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
                            {cat.items.length} {cat.items.length === 1 ? "recommended item" : "recommended items"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {cat.items.map((item, itemIdx) => (
                        <div
                          key={itemIdx}
                          className="bg-card/50 hover:bg-card border border-border/50 hover:border-primary/40 rounded-xl p-5 space-y-3.5 transition-all duration-200 hover:-translate-y-0.5 card-shadow flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            {/* Badges row */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className={`text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-full border ${priorityBadge(item.priority)}`}>
                                {item.priority} Priority
                              </span>

                              <div className="flex items-center gap-1.5">
                                {item.affiliate_badge && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    {item.affiliate_badge}
                                  </span>
                                )}
                                {item.estimated_price && (
                                  <span className="text-[11px] font-bold text-foreground bg-secondary/50 px-2 py-0.5 rounded-full border border-border/60">
                                    {item.estimated_price}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Product Title & Brand */}
                            <div>
                              <div className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-1" />
                                <div>
                                  <h4 className="font-bold text-foreground text-sm md:text-base leading-snug">
                                    {item.name}
                                  </h4>
                                  {item.brand && (
                                    <p className="text-[11px] text-muted-foreground">
                                      Brand: <span className="text-foreground/80 font-medium">{item.brand}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Digital Twin Target Source */}
                            {item.target_source && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/40 text-[11px] text-primary border border-border/50">
                                <Sparkles className="h-3 w-3" />
                                <span>Target: {item.target_source}</span>
                              </div>
                            )}

                            {/* Why & Instructions */}
                            <div className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                              <p>
                                <strong className="text-foreground font-medium">Why it helps: </strong>
                                {item.reason}
                              </p>
                              {item.instructions && (
                                <div className="bg-secondary/30 rounded-lg p-2.5 text-[11px] text-muted-foreground border border-border/40">
                                  <strong className="text-foreground/90 font-medium">Guidance: </strong>
                                  {item.instructions}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Affiliate Buy Button & Store indicator */}
                          <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-3">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Tag className="h-3 w-3 text-primary" />
                              {item.affiliate_store || "Amazon Health Partner"}
                            </span>

                            {item.affiliate_link && (
                              <a
                                href={item.affiliate_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full gradient-bg text-primary-foreground shadow-sm hover:opacity-95 transition-opacity"
                              >
                                <ShoppingCart className="h-3.5 w-3.5" />
                                <span>Buy / View Product</span>
                                <ExternalLink className="h-3 w-3 ml-0.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Web App Conversion Banner */}
              <div className="glass card-shadow rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-primary/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="space-y-2 text-center md:text-left">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                    <Smartphone className="h-3.5 w-3.5" />
                    Web App Provision Active
                  </div>
                  <h4 className="text-xl font-bold text-foreground">
                    Convert Medule to Standalone Web App
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
                    Install Medule directly to your phone's home screen or desktop taskbar. Enjoy offline Digital Twin access, instant product re-ordering, and push health reminders with zero browser bar clutter.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Button
                    onClick={() => setWebAppModalOpen(true)}
                    className="gradient-bg rounded-full px-7 text-xs font-semibold shadow-lg hover:opacity-95"
                  >
                    <Smartphone className="h-4 w-4 mr-2" />
                    Install Web App (PWA)
                  </Button>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      <FooterSection />

      {/* Web App Conversion Modal */}
      <WebAppConversionModal
        isOpen={webAppModalOpen}
        onClose={() => setWebAppModalOpen(false)}
      />
    </div>
  );
}
