import { useState } from "react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import FileUpload from "@/components/analyze/FileUpload";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Activity, CheckCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";

export default function Analyze() {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isUploading, setIsUploading] = useState(false);
  
  // Medical Report Data
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  
  // Food Analysis Data
  const [foodFile, setFoodFile] = useState<File | null>(null);
  const [foodPreview, setFoodPreview] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const handleReportUpload = async (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      toast({ title: "Invalid file", description: "Please upload a PDF file.", variant: "destructive" });
      return;
    }
    setReportFile(file);
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("https://medule-3ix4.onrender.com/upload-medical-report", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Upload failed. Please try again." }));
        throw new Error(body.detail ?? "Upload failed. Please try again.");
      }
      const data = await res.json();
      setProfileData(data);
      setStep(2);
      toast({ title: "Report Analyzed", description: "Successfully generated your medical profile." });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFoodUpload = async (file: File) => {
    setFoodFile(file);
    setFoodPreview(URL.createObjectURL(file));
    setIsUploading(true);
    
    const formData = new FormData();
    formData.append("image", file);
    formData.append("profile", profileData?.assigned_profile || "full");

    try {
      const res = await fetch("https://medule-3ix4.onrender.com/analyze-food", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: "Analysis failed. Please try again." }));
        throw new Error(body.detail ?? "Analysis failed. Please try again.");
      }
      const data = await res.json();
      setAnalysisResult(data);
      setStep(3);
      toast({ title: "Analysis Complete", description: "Food has been successfully evaluated." });
    } catch (err: any) {
      toast({ title: "Analysis Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const resetFlow = () => {
    setStep(1);
    setReportFile(null);
    setProfileData(null);
    setFoodFile(null);
    setFoodPreview(null);
    setAnalysisResult(null);
  };

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
              Upload your medical report and a food image to get a personalized dietary verdict.
            </p>
          </div>

          {/* Step 1: Medical Report */}
          {step === 1 && (
            <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              <div className="glass card-shadow rounded-2xl p-8 mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-primary-foreground font-bold">1</div>
                  <h2 className="text-xl font-semibold text-foreground">Upload Medical Report (PDF)</h2>
                </div>
                <FileUpload
                  type="pdf"
                  accept="application/pdf"
                  label="Drag & Drop PDF or Click to Browse"
                  description="Upload your latest pathology or health report to generate your digital twin profile."
                  onFileSelect={handleReportUpload}
                  isLoading={isUploading}
                />
                {isUploading && <p className="text-center mt-4 text-muted-foreground animate-pulse">Analyzing medical report...</p>}
              </div>
            </div>
          )}

          {/* Step 2: Food Upload */}
          {step === 2 && profileData && (
            <div className="animate-fade-in-up space-y-6">
              <div className="glass card-shadow rounded-2xl p-6 border-l-4 border-primary">
                <h3 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" /> Profile Generated: {profileData.assigned_profile.toUpperCase()}
                </h3>
                <p className="text-muted-foreground mb-4">{profileData.summary}</p>
                <div className="grid gap-2">
                  {profileData.conditions.map((cond: any, idx: number) => (
                    <div key={idx} className="bg-secondary/50 rounded-lg p-3 text-sm">
                      <span className="font-semibold text-foreground">{cond.name}: </span>
                      <span className="text-muted-foreground">{cond.description}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass card-shadow rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center text-primary-foreground font-bold">2</div>
                    <h2 className="text-xl font-semibold text-foreground">Upload Food Image</h2>
                  </div>
                  <Button variant="outline" size="sm" onClick={resetFlow}>Start Over</Button>
                </div>
                <FileUpload
                  type="image"
                  accept="image/jpeg, image/png, image/webp"
                  label="Drag & Drop Food Image"
                  description="Upload a clear picture of the food you want to analyze."
                  onFileSelect={handleFoodUpload}
                  isLoading={isUploading}
                />
                {isUploading && <p className="text-center mt-4 text-muted-foreground animate-pulse">Analyzing food against your profile...</p>}
              </div>
            </div>
          )}

          {/* Step 3: Results */}
          {step === 3 && analysisResult && (
            <div className="animate-fade-in-up space-y-6">
              <div className="glass card-shadow rounded-2xl p-8">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="w-full md:w-1/3">
                    {foodPreview && (
                      <img src={foodPreview} alt="Food Preview" className="w-full h-auto rounded-xl object-cover aspect-square card-shadow" />
                    )}
                    <div className="mt-4 text-center">
                      <h3 className="text-2xl font-bold capitalize text-foreground">{analysisResult.top_prediction}</h3>
                    </div>
                  </div>

                  <div className="w-full md:w-2/3 flex flex-col justify-center space-y-6">
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${
                      analysisResult.dietary_status === 'APPROVED' ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'
                    }`}>
                      {analysisResult.dietary_status === 'APPROVED' ? (
                        <CheckCircle className="h-8 w-8 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                      )}
                      <div>
                        <h4 className="font-bold text-lg text-foreground">Status: {analysisResult.dietary_status}</h4>
                        <p className="text-sm text-muted-foreground">Based on your {profileData?.assigned_profile} profile</p>
                      </div>
                    </div>

                    {analysisResult.warnings && analysisResult.warnings.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="font-semibold text-red-400 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" /> Medical Warnings
                        </h5>
                        {analysisResult.warnings.map((w: any, i: number) => (
                          <div key={i} className="bg-red-500/5 p-3 rounded-lg border border-red-500/10 text-sm">
                            <strong className="text-red-400">{w.category}:</strong> <span className="text-muted-foreground">{w.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {analysisResult.medical_benefits && analysisResult.medical_benefits.length > 0 && (
                      <div className="space-y-3">
                        <h5 className="font-semibold text-green-400 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" /> Medical Benefits
                        </h5>
                        {analysisResult.medical_benefits.map((b: any, i: number) => (
                          <div key={i} className="bg-green-500/5 p-3 rounded-lg border border-green-500/10 text-sm">
                            <strong className="text-green-400">{b.category}:</strong> <span className="text-muted-foreground">{b.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {(!analysisResult.warnings?.length && !analysisResult.medical_benefits?.length) && (
                      <div className="bg-secondary/30 p-4 rounded-xl flex items-start gap-3">
                        <Info className="h-5 w-5 text-accent mt-0.5" />
                        <p className="text-sm text-muted-foreground">No specific warnings or benefits detected for this food in relation to your profile.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 flex justify-center">
                   <Button onClick={resetFlow} className="gradient-bg rounded-full px-8">
                     Analyze Another Item
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
