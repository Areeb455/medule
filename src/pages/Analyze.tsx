import { useState } from "react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import FileUpload from "@/components/analyze/FileUpload";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Activity, CheckCircle, AlertTriangle, Info,
  Utensils, FileText, RotateCcw, Zap
} from "lucide-react";

type Mode = "quick" | "full";
type QuickStep = 1 | 2;
type FullStep  = 1 | 2 | 3;

function AnalysisResult({ result, foodPreview, profileLabel, onReset }: {
  result: any; foodPreview: string | null; profileLabel: string; onReset: () => void;
}) {
  const approved = result.dietary_status === "APPROVED";
  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="glass card-shadow rounded-2xl p-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-1/3 flex flex-col items-center">
            {foodPreview && (
              <img src={foodPreview} alt="Food Preview" className="w-full h-auto rounded-xl object-cover aspect-square card-shadow" />
            )}
            <h3 className="mt-4 text-2xl font-bold capitalize text-center text-foreground">
              {result.top_prediction?.replace(/_/g, " ")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Confidence:{" "}
              <span className={result.confidence_level === "high" ? "text-green-400" : result.confidence_level === "medium" ? "text-yellow-400" : "text-red-400"}>
                {Math.round(result.confidence * 100)}%
              </span>
            </p>
            {result.confidence_level === "low" && (
              <p className="text-xs text-yellow-400 mt-2 text-center bg-yellow-500/10 rounded-lg px-3 py-2">
                Low confidence — consider retaking the photo in better lighting.
              </p>
            )}
          </div>
          <div className="w-full md:w-2/3 flex flex-col justify-center space-y-6">
            <div className={`p-4 rounded-xl flex items-center gap-3 ${approved ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
              {approved ? <CheckCircle className="h-8 w-8 text-green-500 shrink-0" /> : <AlertTriangle className="h-8 w-8 text-red-500 shrink-0" />}
              <div>
                <h4 className="font-bold text-lg text-foreground">{approved ? "✅ Approved" : "⚠️ Needs Modification"}</h4>
                <p className="text-sm text-muted-foreground">Evaluated against your <strong>{profileLabel}</strong> profile</p>
              </div>
            </div>
            {result.warnings?.length > 0 && (
              <div className="space-y-3">
                <h5 className="font-semibold text-red-400 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Medical Warnings</h5>
                {result.warnings.map((w: any, i: number) => (
                  <div key={i} className="bg-red-500/5 p-3 rounded-lg border border-red-500/10 text-sm">
                    <strong className="text-red-400">{w.category}:</strong> <span className="text-muted-foreground">{w.message}</span>
                  </div>
                ))}
              </div>
            )}
            {result.medical_benefits?.length > 0 && (
              <div className="space-y-3">
                <h5 className="font-semibold text-green-400 flex items-center gap-2"><CheckCircle className="h-4 w-4" /> Medical Benefits</h5>
                {result.medical_benefits.map((b: any, i: number) => (
                  <div key={i} className="bg-green-500/5 p-3 rounded-lg border border-green-500/10 text-sm">
                    <strong className="text-green-400">{b.category}:</strong> <span className="text-muted-foreground">{b.message}</span>
                  </div>
                ))}
              </div>
            )}
            {!result.warnings?.length && !result.medical_benefits?.length && (
              <div className="bg-secondary/30 p-4 rounded-xl flex items-start gap-3">
                <Info className="h-5 w-5 text-accent mt-0.5 shrink-0" />
                <p className="text-sm text-muted-foreground">No specific warnings or benefits detected for this food with your current profile.</p>
              </div>
            )}
            {!result.in_database && (
              <div className="bg-yellow-500/5 p-3 rounded-lg border border-yellow-500/20 text-sm text-yellow-400">
                ⚠️ This food isn't in our nutritional database yet. The verdict above may be incomplete.
              </div>
            )}
          </div>
        </div>
        <div className="mt-8 flex justify-center">
          <Button onClick={onReset} className="gradient-bg rounded-full px-8">
            <RotateCcw className="h-4 w-4 mr-2" /> Analyze Another Item
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Analyze() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("quick");

  const [quickStep, setQuickStep] = useState<QuickStep>(1);
  const [quickFoodPreview, setQuickFoodPreview] = useState<string | null>(null);
  const [quickResult, setQuickResult] = useState<any>(null);
  const [quickLoading, setQuickLoading] = useState(false);

  const [fullStep, setFullStep] = useState<FullStep>(1);
  const [profileData, setProfileData] = useState<any>(null);
  const [fullFoodPreview, setFullFoodPreview] = useState<string | null>(null);
  const [fullResult, setFullResult] = useState<any>(null);
  const [fullLoading, setFullLoading] = useState(false);

  const API = "https://medule-3ix4.onrender.com";

  const handleQuickFoodUpload = async (file: File) => {
    setQuickFoodPreview(URL.createObjectURL(file));
    setQuickLoading(true);
    const formData = new FormData();
    formData.append("image", file);
    formData.append("profile", "full");
    try {
      const res = await fetch(`${API}/analyze-food`, { method: "POST", body: formData });
      if (!res.ok) { const b = await res.json().catch(() => ({ detail: "Analysis failed." })); throw new Error(b.detail); }
      setQuickResult(await res.json());
      setQuickStep(2);
      toast({ title: "Analysis Complete", description: "Food has been evaluated." });
    } catch (err: any) {
      toast({ title: "Analysis Failed", description: err.message, variant: "destructive" });
    } finally { setQuickLoading(false); }
  };

  const resetQuick = () => { setQuickStep(1); setQuickFoodPreview(null); setQuickResult(null); };

  const handleReportUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast({ title: "Invalid file", description: "Please upload a PDF file.", variant: "destructive" }); return;
    }
    setFullLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API}/upload-medical-report`, { method: "POST", body: formData });
      if (!res.ok) { const b = await res.json().catch(() => ({ detail: "Upload failed." })); throw new Error(b.detail); }
      setProfileData(await res.json());
      setFullStep(2);
      toast({ title: "Report Analyzed", description: "Medical profile generated." });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally { setFullLoading(false); }
  };

  const handleFullFoodUpload = async (file: File) => {
    setFullFoodPreview(URL.createObjectURL(file));
    setFullLoading(true);
    const formData = new FormData();
    formData.append("image", file);
    formData.append("profile", profileData?.assigned_profile || "full");
    try {
      const res = await fetch(`${API}/analyze-food`, { method: "POST", body: formData });
      if (!res.ok) { const b = await res.json().catch(() => ({ detail: "Analysis failed." })); throw new Error(b.detail); }
      setFullResult(await res.json());
      setFullStep(3);
      toast({ title: "Analysis Complete", description: "Food evaluated against your profile." });
    } catch (err: any) {
      toast({ title: "Analysis Failed", description: err.message, variant: "destructive" });
    } finally { setFullLoading(false); }
  };

  const resetFull = () => { setFullStep(1); setProfileData(null); setFullFoodPreview(null); setFullResult(null); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-6 max-w-4xl">

          <div className="mb-10 text-center animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Clinical <span className="gradient-text">Food Analysis</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Get a personalized dietary verdict based on your medical profile.
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="flex rounded-xl bg-secondary/30 p-1 mb-8 gap-1">
            <button
              onClick={() => setMode("quick")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${mode === "quick" ? "gradient-bg text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Zap className="h-4 w-4" /> Quick Analysis
              <span className="text-xs opacity-70 hidden sm:inline">(Food image only)</span>
            </button>
            <button
              onClick={() => setMode("full")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold transition-all ${mode === "full" ? "gradient-bg text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}
            >
              <FileText className="h-4 w-4" /> Full Analysis
              <span className="text-xs opacity-70 hidden sm:inline">(Report + food)</span>
            </button>
          </div>

          {/* QUICK MODE */}
          {mode === "quick" && (
            <>
              {quickStep === 1 && (
                <div className="animate-fade-in-up">
                  <div className="glass card-shadow rounded-2xl p-8 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Utensils className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold text-foreground">Upload a Food Image</h2>
                    </div>
                    <p className="text-muted-foreground text-sm mb-6">
                      Upload a clear photo of any food — JPG, PNG, or WEBP. We'll identify it and evaluate it against general health guidelines.
                    </p>
                    <FileUpload
                      type="image"
                      accept="image/jpeg, image/jpg, image/png, image/webp"
                      label="Drag & Drop Food Image or Click to Browse"
                      description="Supports JPG, PNG, WEBP — any food photo works."
                      onFileSelect={handleQuickFoodUpload}
                      isLoading={quickLoading}
                    />
                    {quickLoading && <p className="text-center mt-4 text-muted-foreground animate-pulse">Identifying food and running analysis...</p>}
                  </div>
                  <div className="text-center text-sm text-muted-foreground">
                    Want a more personalised result?{" "}
                    <button onClick={() => setMode("full")} className="text-primary underline underline-offset-2">Upload your medical report</button>
                  </div>
                </div>
              )}
              {quickStep === 2 && quickResult && (
                <AnalysisResult result={quickResult} foodPreview={quickFoodPreview} profileLabel="general health" onReset={resetQuick} />
              )}
            </>
          )}

          {/* FULL MODE */}
          {mode === "full" && (
            <>
              {fullStep === 1 && (
                <div className="animate-fade-in-up">
                  <div className="glass card-shadow rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-primary-foreground font-bold text-sm">1</div>
                      <h2 className="text-xl font-semibold text-foreground">Upload Medical Report</h2>
                    </div>
                    <p className="text-muted-foreground text-sm mb-6">
                      Upload your pathology or health report as a PDF — we'll extract your conditions and build a personalized dietary profile.
                    </p>
                    <FileUpload
                      type="pdf"
                      accept="application/pdf"
                      label="Drag & Drop PDF or Click to Browse"
                      description="Supports Apollo, Thyrocare, SRL, and other standard pathology PDFs."
                      onFileSelect={handleReportUpload}
                      isLoading={fullLoading}
                    />
                    {fullLoading && <p className="text-center mt-4 text-muted-foreground animate-pulse">Analyzing medical report with AI...</p>}
                  </div>
                </div>
              )}

              {fullStep === 2 && profileData && (
                <div className="animate-fade-in-up space-y-6">
                  <div className="glass card-shadow rounded-2xl p-6 border-l-4 border-primary">
                    <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" /> Profile: <span className="capitalize">{profileData.assigned_profile}</span>
                    </h3>
                    <p className="text-muted-foreground mb-4 text-sm">{profileData.summary}</p>
                    <div className="grid gap-2">
                      {profileData.conditions?.map((cond: any, idx: number) => (
                        <div key={idx} className="bg-secondary/50 rounded-lg p-3 text-sm">
                          <span className="font-semibold text-foreground">{cond.name}: </span>
                          <span className="text-muted-foreground">{cond.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="glass card-shadow rounded-2xl p-8">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-primary-foreground font-bold text-sm">2</div>
                        <h2 className="text-xl font-semibold text-foreground">Upload Food Image</h2>
                      </div>
                      <Button variant="outline" size="sm" onClick={resetFull}><RotateCcw className="h-3 w-3 mr-1" /> Start Over</Button>
                    </div>
                    <p className="text-muted-foreground text-sm mb-6">Upload a clear photo of the food you want to check — JPG, PNG, or WEBP.</p>
                    <FileUpload
                      type="image"
                      accept="image/jpeg, image/jpg, image/png, image/webp"
                      label="Drag & Drop Food Image or Click to Browse"
                      description="Supports JPG, PNG, WEBP — verdict tailored to your medical profile."
                      onFileSelect={handleFullFoodUpload}
                      isLoading={fullLoading}
                    />
                    {fullLoading && <p className="text-center mt-4 text-muted-foreground animate-pulse">Analyzing food against your profile...</p>}
                  </div>
                </div>
              )}

              {fullStep === 3 && fullResult && (
                <AnalysisResult result={fullResult} foodPreview={fullFoodPreview} profileLabel={profileData?.assigned_profile ?? "full"} onReset={resetFull} />
              )}
            </>
          )}

        </div>
      </main>
      <FooterSection />
    </div>
  );
}
