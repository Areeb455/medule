import { useState } from "react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import FileUpload from "@/components/analyze/FileUpload";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Activity, CheckCircle, AlertTriangle, Info, RotateCcw, FileText, Utensils } from "lucide-react";

function AnalysisResult({ result, foodPreview, profileLabel, onReset }: {
  result: any; foodPreview: string | null; profileLabel: string; onReset: () => void;
}) {
  const approved = result.dietary_status === "APPROVED";
  return (
    <div className="animate-fade-in-up space-y-6 mt-6">
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
  const API = "https://medule-3ix4.onrender.com";

  // ── Medical Report state ──
  const [reportLoading, setReportLoading] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);

  // ── Food Analysis state ──
  const [foodLoading, setFoodLoading] = useState(false);
  const [foodPreview, setFoodPreview] = useState<string | null>(null);
  const [foodResult, setFoodResult] = useState<any>(null);

  // ── Medical Report upload (PDF or image) ──
  const handleReportUpload = async (file: File) => {
    const isPdf = file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isImage) {
      toast({ title: "Invalid file", description: "Please upload a PDF or an image of your report.", variant: "destructive" });
      return;
    }

    setReportLoading(true);
    setProfileData(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API}/upload-medical-report`, { method: "POST", body: formData });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ detail: "Upload failed." }));
        throw new Error(b.detail ?? "Upload failed.");
      }
      setProfileData(await res.json());
      toast({ title: "Report Analyzed", description: "Medical profile generated successfully." });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setReportLoading(false);
    }
  };

  const resetReport = () => setProfileData(null);

  // ── Food upload ──
  const handleFoodUpload = async (file: File) => {
    setFoodPreview(URL.createObjectURL(file));
    setFoodResult(null);
    setFoodLoading(true);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("profile", profileData?.assigned_profile || "full");

    try {
      const res = await fetch(`${API}/analyze-food`, { method: "POST", body: formData });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ detail: "Analysis failed." }));
        throw new Error(b.detail ?? "Analysis failed.");
      }
      setFoodResult(await res.json());
      toast({ title: "Analysis Complete", description: "Food has been evaluated." });
    } catch (err: any) {
      toast({ title: "Analysis Failed", description: err.message, variant: "destructive" });
    } finally {
      setFoodLoading(false);
    }
  };

  const resetFood = () => { setFoodPreview(null); setFoodResult(null); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-6 max-w-4xl space-y-10">

          {/* ── Page header ── */}
          <div className="text-center animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Health <span className="gradient-text">Analysis</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Upload your medical report and analyze your food — all in one place.
            </p>
          </div>

          {/* ══════════════════════════════════════
              SECTION 1 — Medical Report Analysis
          ══════════════════════════════════════ */}
          <div className="glass card-shadow rounded-2xl p-8 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Medical Report Analysis</h2>
            </div>
            <p className="text-muted-foreground text-sm mb-6">
              Upload your pathology or health report — PDF or image (JPG, PNG). We'll extract your conditions and build a personalized dietary profile.
            </p>

            {!profileData ? (
              <>
                <FileUpload
                  type="pdf"
                  accept="application/pdf, image/jpeg, image/jpg, image/png, image/webp"
                  label="Drag & Drop Report or Click to Browse"
                  description="Supports PDF or image — Apollo, Thyrocare, SRL and other standard reports."
                  onFileSelect={handleReportUpload}
                  isLoading={reportLoading}
                />
                {reportLoading && (
                  <p className="text-center mt-4 text-muted-foreground animate-pulse">
                    Analyzing medical report with AI...
                  </p>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-1">
                    <Activity className="h-5 w-5 text-primary" />
                    Profile: <span className="capitalize">{profileData.assigned_profile}</span>
                  </h3>
                  <p className="text-muted-foreground text-sm">{profileData.summary}</p>
                </div>
                <div className="grid gap-2">
                  {profileData.conditions?.map((cond: any, idx: number) => (
                    <div key={idx} className="bg-secondary/50 rounded-lg p-3 text-sm">
                      <span className="font-semibold text-foreground">{cond.name}: </span>
                      <span className="text-muted-foreground">{cond.description}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={resetReport}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Upload Different Report
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════
              SECTION 2 — Clinical Food Analysis
          ══════════════════════════════════════ */}
          <div className="glass card-shadow rounded-2xl p-8 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-2">
              <Utensils className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Clinical Food Analysis</h2>
            </div>
            <p className="text-muted-foreground text-sm mb-6">
              Upload a photo of any food — JPG, PNG, or WEBP. 
              {profileData
                ? <> Result will be tailored to your <strong className="text-foreground capitalize">{profileData.assigned_profile}</strong> profile.</>
                : <> Upload your medical report above for a personalized verdict, or get a general analysis now.</>
              }
            </p>

            {!foodResult ? (
              <>
                <FileUpload
                  type="image"
                  accept="image/jpeg, image/jpg, image/png, image/webp"
                  label="Drag & Drop Food Image or Click to Browse"
                  description="Supports JPG, PNG, WEBP — any food photo works."
                  onFileSelect={handleFoodUpload}
                  isLoading={foodLoading}
                />
                {foodLoading && (
                  <p className="text-center mt-4 text-muted-foreground animate-pulse">
                    Identifying food and running analysis...
                  </p>
                )}
              </>
            ) : (
              <AnalysisResult
                result={foodResult}
                foodPreview={foodPreview}
                profileLabel={profileData?.assigned_profile ?? "general health"}
                onReset={resetFood}
              />
            )}
          </div>

        </div>
      </main>
      <FooterSection />
    </div>
  );
}
