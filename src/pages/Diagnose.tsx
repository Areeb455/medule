import { useState, useRef, useCallback } from "react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePatient } from "@/hooks/usePatient";
import {
  Camera, Upload, RotateCcw, AlertTriangle,
  Stethoscope, Info, X, FlipHorizontal,
} from "lucide-react";

// ── Result display ────────────────────────────────────────
function DiagnosisResult({ result, preview, onReset }: {
  result: any; preview: string | null; onReset: () => void;
}) {
  return (
    <div className="animate-fade-in-up space-y-6">
      <div className="glass card-shadow rounded-2xl p-8">
        <div className="flex flex-col md:flex-row gap-8 mb-8">
          {preview && (
            <div className="w-full md:w-1/3 shrink-0">
              <img src={preview} alt="Submitted" className="w-full rounded-xl object-cover aspect-square card-shadow" />
            </div>
          )}
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div>
              <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Identified Condition</p>
              <h2 className="text-3xl font-bold text-foreground">{result.condition_name}</h2>
              <p className="text-muted-foreground mt-2">{result.brief_description}</p>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold w-fit ${
              result.severity === "Mild"     ? "bg-green-500/10 text-green-400 border border-green-500/20" :
              result.severity === "Moderate" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20" :
              "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}>
              <AlertTriangle className="h-4 w-4" />
              Severity: {result.severity}
            </div>
            <div className="bg-secondary/30 p-3 rounded-lg flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                AI-assisted preliminary analysis only — not a medical diagnosis. Always consult a qualified doctor.
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {[
            { title: "Causes",     items: result.causes,     color: "bg-red-400",    accent: "text-red-400" },
            { title: "Treatments", items: result.treatments, color: "bg-green-400",  accent: "text-green-400" },
            { title: "Risks",      items: result.risks,      color: "bg-yellow-400", accent: "text-yellow-400" },
          ].map((section, i) => (
            <div key={i} className="glass rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${section.color} inline-block`} />
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.items?.map((item: string, j: number) => (
                  <li key={j} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className={`${section.accent} mt-1 shrink-0`}>•</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {result.see_doctor_if && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 mb-6">
            <h3 className="font-semibold text-red-400 mb-2">🏥 See a Doctor If:</h3>
            <ul className="space-y-1">
              {result.see_doctor_if.map((s: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-red-400 mt-1 shrink-0">•</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-center">
          <Button onClick={onReset} className="gradient-bg rounded-full px-8">
            <RotateCcw className="h-4 w-4 mr-2" /> Analyze Another
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────
export default function Diagnose() {
  const { toast } = useToast();
  const { buildFormData, API } = usePatient();

  const [mode, setMode]         = useState<"upload" | "camera">("upload");
  const [preview, setPreview]   = useState<string | null>(null);
  const [result, setResult]     = useState<any>(null);
  const [loading, setLoading]   = useState(false);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive]   = useState(false);
  const [facingMode, setFacingMode]       = useState<"user" | "environment">("environment");

  const submitImage = async (file: File, objectUrl: string) => {
    setPreview(objectUrl);
    setLoading(true);
    const formData = buildFormData(file); // includes user_id + patient_name
    try {
      const res = await fetch(`${API}/analyze-disease`, { method: "POST", body: formData });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ detail: "Analysis failed." }));
        throw new Error(b.detail ?? "Analysis failed.");
      }
      setResult(await res.json());
      toast({ title: "Analysis Complete", description: "Result saved to your profile." });
    } catch (err: any) {
      toast({ title: "Analysis Failed", description: err.message, variant: "destructive" });
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    submitImage(file, URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    submitImage(file, URL.createObjectURL(file));
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraActive(true);
    } catch {
      toast({ title: "Camera Error", description: "Could not access camera.", variant: "destructive" });
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const flipCamera = async () => {
    stopCamera();
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    setTimeout(startCamera, 300);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      stopCamera();
      submitImage(file, URL.createObjectURL(blob));
    }, "image/jpeg", 0.92);
  };

  const reset = () => { stopCamera(); setPreview(null); setResult(null); };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-6 max-w-4xl">

          <div className="mb-10 text-center animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Disease <span className="gradient-text">Recognition</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Capture or upload a photo of a skin condition, eye issue, visible mark, or wound — instant AI analysis.
            </p>
          </div>

          {result ? (
            <DiagnosisResult result={result} preview={preview} onReset={reset} />
          ) : (
            <div className="glass card-shadow rounded-2xl p-8 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-6">
                <Stethoscope className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Submit a Photo for Analysis</h2>
              </div>

              {/* Mode toggle */}
              <div className="flex rounded-xl bg-secondary/30 p-1 mb-6 gap-1">
                <button onClick={() => { stopCamera(); setMode("upload"); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${mode === "upload" ? "gradient-bg text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
                  <Upload className="h-4 w-4" /> Upload Image or PDF
                </button>
                <button onClick={() => { setMode("camera"); startCamera(); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all ${mode === "camera" ? "gradient-bg text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"}`}>
                  <Camera className="h-4 w-4" /> Open Camera
                </button>
              </div>

              {loading && (
                <div className="text-center py-12">
                  <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-muted-foreground animate-pulse">Analyzing with AI...</p>
                </div>
              )}

              {!loading && mode === "upload" && (
                <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                  className="relative border-2 border-dashed border-border rounded-2xl p-10 text-center hover:border-primary hover:bg-white/5 cursor-pointer glass transition-all">
                  <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="p-4 rounded-full gradient-bg">
                      <Upload className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground">Drag & Drop or Click to Browse</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        JPG, PNG, WEBP, PDF — skin, eye, wound, rash, or any visible condition
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!loading && mode === "camera" && (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    {!cameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-white/60 text-sm">Starting camera...</p>
                      </div>
                    )}
                    {cameraActive && (
                      <button onClick={flipCamera} className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all">
                        <FlipHorizontal className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="flex gap-3 justify-center">
                    <Button onClick={capturePhoto} disabled={!cameraActive} className="gradient-bg rounded-full px-8">
                      <Camera className="h-4 w-4 mr-2" /> Capture & Analyze
                    </Button>
                    <Button variant="outline" onClick={() => { stopCamera(); setMode("upload"); }}>
                      <X className="h-4 w-4 mr-2" /> Cancel
                    </Button>
                  </div>
                </div>
              )}

              {!loading && (
                <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                  {["Good lighting helps accuracy", "Focus on the affected area", "Include surrounding skin for context"].map((tip, i) => (
                    <div key={i} className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">{tip}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <FooterSection />
    </div>
  );
}