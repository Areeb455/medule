import { useState } from "react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePatient } from "@/hooks/usePatient";
import {
  RotateCcw, FileText, Utensils, Upload,
  CheckCircle, AlertTriangle, Info, Zap,
} from "lucide-react";

// ── Food Result ───────────────────────────────────────────
function FoodResult({ result, preview, onReset }: { result: any; preview: string | null; onReset: () => void }) {
  const verdict = result.health_verdict || "";
  const color =
    verdict === "Healthy"   ? "text-green-400"  :
    verdict === "Moderate"  ? "text-yellow-400" : "text-red-400";
  const bg =
    verdict === "Healthy"   ? "bg-green-500/10 border-green-500/20"  :
    verdict === "Moderate"  ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20";

  return (
    <div className="glass card-shadow rounded-2xl p-8 animate-fade-in-up">
      <div className="flex flex-col md:flex-row gap-8 mb-6">
        {preview && (
          <img src={preview} alt="Food" className="w-full md:w-1/3 rounded-xl object-cover aspect-square card-shadow shrink-0" />
        )}
        <div className="flex-1 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Identified Food</p>
            <h2 className="text-3xl font-bold text-foreground">{result.food_name}</h2>
            <p className="text-muted-foreground mt-1">{result.serving_size}</p>
          </div>

          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${bg} ${color}`}>
            {verdict === "Healthy" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {verdict}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Calories",  value: `${result.calories} kcal` },
              { label: "Protein",   value: `${result.macronutrients?.protein ?? "—"}g` },
              { label: "Carbs",     value: `${result.macronutrients?.carbs ?? "—"}g` },
            ].map((s, i) => (
              <div key={i} className="bg-secondary/30 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {[
          { title: "Benefits",      items: result.health_benefits, color: "text-green-400",  dot: "bg-green-400" },
          { title: "Concerns",      items: result.concerns,        color: "text-red-400",    dot: "bg-red-400" },
          { title: "Alternatives",  items: result.alternatives,    color: "text-blue-400",   dot: "bg-blue-400" },
        ].map((s, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <h4 className={`font-semibold mb-3 flex items-center gap-2 ${s.color}`}>
              <span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.title}
            </h4>
            <ul className="space-y-1">
              {s.items?.map((item: string, j: number) => (
                <li key={j} className={`text-xs text-muted-foreground flex gap-2`}>
                  <span className={`${s.color} shrink-0`}>•</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {result.micronutrients?.length > 0 && (
        <div className="bg-secondary/20 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Key Micronutrients</p>
          <div className="flex flex-wrap gap-2">
            {result.micronutrients.map((m: string, i: number) => (
              <span key={i} className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full">{m}</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Button onClick={onReset} className="gradient-bg rounded-full px-8">
          <RotateCcw className="h-4 w-4 mr-2" /> Analyze Another
        </Button>
      </div>
    </div>
  );
}

// ── Medical Report Result ─────────────────────────────────
function ReportResult({ result, onReset }: { result: any; onReset: () => void }) {
  return (
    <div className="glass card-shadow rounded-2xl p-8 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-5 w-5 text-primary" />
        <h3 className="text-xl font-semibold text-foreground">Report Analysis</h3>
        <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold border ${
          result.severity === "Mild"     ? "bg-green-500/10 text-green-400 border-green-500/20" :
          result.severity === "Moderate" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" :
          "bg-red-500/10 text-red-400 border-red-500/20"
        }`}>
          {result.severity}
        </span>
      </div>

      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground">{result.condition_name}</h2>
        <p className="text-muted-foreground mt-2">{result.brief_description}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        {[
          { title: "Causes",     items: result.causes,     color: "text-red-400",    dot: "bg-red-400" },
          { title: "Treatments", items: result.treatments, color: "text-green-400",  dot: "bg-green-400" },
          { title: "Risks",      items: result.risks,      color: "text-yellow-400", dot: "bg-yellow-400" },
        ].map((s, i) => (
          <div key={i} className="glass rounded-xl p-4">
            <h4 className={`font-semibold mb-3 flex items-center gap-2 ${s.color}`}>
              <span className={`w-2 h-2 rounded-full ${s.dot}`} /> {s.title}
            </h4>
            <ul className="space-y-1">
              {s.items?.map((item: string, j: number) => (
                <li key={j} className="text-xs text-muted-foreground flex gap-2">
                  <span className={`${s.color} shrink-0`}>•</span>{item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {result.see_doctor_if?.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-6">
          <h4 className="font-semibold text-red-400 mb-2">🏥 See a Doctor If:</h4>
          <ul className="space-y-1">
            {result.see_doctor_if.map((s: string, i: number) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                <span className="text-red-400 shrink-0">•</span>{s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-secondary/30 rounded-lg p-3 flex gap-2 mb-6">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground">AI-assisted analysis only — not a medical diagnosis. Always consult a qualified doctor.</p>
      </div>

      <div className="flex justify-center">
        <Button onClick={onReset} className="gradient-bg rounded-full px-8">
          <RotateCcw className="h-4 w-4 mr-2" /> Analyze Another
        </Button>
      </div>
    </div>
  );
}

// ── Upload Box ────────────────────────────────────────────
function UploadBox({ onFile, accept, label, sublabel, icon, loading }: {
  onFile: (f: File) => void;
  accept: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  if (loading) return (
    <div className="text-center py-12">
      <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-muted-foreground animate-pulse text-sm">Analyzing with AI...</p>
    </div>
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      className="relative border-2 border-dashed border-border rounded-2xl p-10 text-center hover:border-primary hover:bg-white/5 cursor-pointer transition-all"
    >
      <input
        type="file"
        accept={accept}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full gradient-bg">{icon}</div>
        <div>
          <p className="text-lg font-semibold text-foreground">{label}</p>
          <p className="text-sm text-muted-foreground mt-1">{sublabel}</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function Analyze() {
  const { toast } = useToast();
  const { buildFormData, API } = usePatient();

  // Medical report state
  const [reportLoading, setReportLoading] = useState(false);
  const [reportResult, setReportResult]   = useState<any>(null);

  // Food state
  const [foodLoading, setFoodLoading]   = useState(false);
  const [foodPreview, setFoodPreview]   = useState<string | null>(null);
  const [foodResult, setFoodResult]     = useState<any>(null);

  // ── Medical report upload → /analyze-disease ──
  const handleReportUpload = async (file: File) => {
    setReportLoading(true);
    setReportResult(null);
    const formData = buildFormData(file);
    try {
      const res = await fetch(`${API}/analyze-disease`, { method: "POST", body: formData });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ detail: "Analysis failed." }));
        throw new Error(b.detail ?? "Analysis failed.");
      }
      setReportResult(await res.json());
      toast({ title: "Report Analyzed", description: "Medical report analysis complete." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setReportLoading(false);
    }
  };

  // ── Food image upload → /analyze-food ──
  const handleFoodUpload = async (file: File) => {
    setFoodPreview(URL.createObjectURL(file));
    setFoodResult(null);
    setFoodLoading(true);
    const formData = buildFormData(file);
    try {
      const res = await fetch(`${API}/analyze-food`, { method: "POST", body: formData });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ detail: "Analysis failed." }));
        throw new Error(b.detail ?? "Analysis failed.");
      }
      setFoodResult(await res.json());
      toast({ title: "Analysis Complete", description: "Food analysis saved to your profile." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
      setFoodPreview(null);
    } finally {
      setFoodLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-6 max-w-4xl space-y-10">

          {/* Header */}
          <div className="text-center animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Health <span className="gradient-text">Analysis</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Upload your medical report or analyze food — results saved to your profile automatically.
            </p>
          </div>

          {/* Medical Report Section */}
          <div className="glass card-shadow rounded-2xl p-8 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">Medical Report Analysis</h2>
                <p className="text-sm text-muted-foreground">Upload a pathology or health report — PDF or image. Apollo, Thyrocare, SRL and others supported.</p>
              </div>
            </div>

            {reportResult ? (
              <ReportResult result={reportResult} onReset={() => setReportResult(null)} />
            ) : (
              <UploadBox
                onFile={handleReportUpload}
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                label="Drag & Drop Report or Click to Browse"
                sublabel="Supports PDF or image — Apollo, Thyrocare, SRL and other standard reports"
                icon={<FileText className="w-8 h-8 text-primary-foreground" />}
                loading={reportLoading}
              />
            )}
          </div>

          {/* Food Analysis Section */}
          <div className="glass card-shadow rounded-2xl p-8 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <Utensils className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">Clinical Food Analysis</h2>
                <p className="text-sm text-muted-foreground">Upload a photo of any food — JPG, PNG, or WEBP. Get calories, nutrients, and health verdict.</p>
              </div>
            </div>

            {foodResult ? (
              <FoodResult result={foodResult} preview={foodPreview} onReset={() => { setFoodResult(null); setFoodPreview(null); }} />
            ) : (
              <UploadBox
                onFile={handleFoodUpload}
                accept="image/jpeg,image/jpg,image/png,image/webp"
                label="Drag & Drop Food Image or Click to Browse"
                sublabel="JPG, PNG, WEBP — get instant nutritional breakdown and health verdict"
                icon={<Utensils className="w-8 h-8 text-primary-foreground" />}
                loading={foodLoading}
              />
            )}
          </div>

          {/* Tips */}
          <div className="grid grid-cols-3 gap-4 animate-fade-in-up">
            {[
              { icon: <Zap className="h-4 w-4 text-yellow-400" />, tip: "Results auto-saved to your Digital Twin profile" },
              { icon: <CheckCircle className="h-4 w-4 text-green-400" />, tip: "Supports Apollo, Thyrocare, SRL medical reports" },
              { icon: <Info className="h-4 w-4 text-blue-400" />, tip: "AI analysis only — always consult a doctor" },
            ].map((t, i) => (
              <div key={i} className="glass rounded-xl p-4 flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{t.icon}</div>
                <p className="text-xs text-muted-foreground">{t.tip}</p>
              </div>
            ))}
          </div>

        </div>
      </main>
      <FooterSection />
    </div>
  );
}