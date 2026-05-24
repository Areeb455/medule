import { useState, useRef } from "react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePatient } from "@/hooks/usePatient";
import {
  RotateCcw, Utensils, CheckCircle, AlertTriangle,
  Info, Zap, Search, Camera, Edit2
} from "lucide-react";

function FoodResult({ result, preview, onReset, onManualEdit }: {
  result: any; preview: string | null; onReset: () => void; onManualEdit: () => void;
}) {
  const verdict = result.health_verdict || "";
  const color = verdict === "Healthy" ? "text-green-400" : verdict === "Moderate" ? "text-yellow-400" : "text-red-400";
  const bg    = verdict === "Healthy" ? "bg-green-500/10 border-green-500/20" : verdict === "Moderate" ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20";

  return (
    <div className="glass card-shadow rounded-2xl p-8 animate-fade-in-up">
      <div className="flex flex-col md:flex-row gap-8 mb-6">
        {preview && <img src={preview} alt="Food" className="w-full md:w-1/3 rounded-xl object-cover aspect-square card-shadow shrink-0" />}
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Identified Food</p>
              <h2 className="text-3xl font-bold text-foreground">{result.food_name}</h2>
              <p className="text-muted-foreground mt-1">{result.serving_size}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onManualEdit} className="text-xs text-primary hover:bg-primary/10">
              <Edit2 className="h-3 w-3 mr-1" /> Not correct?
            </Button>
          </div>
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${bg} ${color}`}>
            {verdict === "Healthy" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {verdict}
          </div>
          {result.food_name === "Unknown Food" && (
            <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-300">No food was detected. Please upload a clearer photo or use manual search.</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            {((): { label: string; value: string }[] => {
              const isUnknown = result.food_name === "Unknown Food";
              return [
                { label: "Calories", value: isUnknown ? "0 kcal" : `${result.calories} kcal` },
                { label: "Protein",  value: isUnknown ? "0g"     : `${result.macronutrients?.protein ?? "—"}g` },
                { label: "Carbs",    value: isUnknown ? "0g"     : `${result.macronutrients?.carbs   ?? "—"}g` },
              ];
            })().map((s, i) => (
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
          { title: "Benefits",     items: result.health_benefits, color: "text-green-400", dot: "bg-green-400" },
          { title: "Concerns",     items: result.concerns,        color: "text-red-400",   dot: "bg-red-400" },
          { title: "Alternatives", items: result.alternatives,    color: "text-blue-400",  dot: "bg-blue-400" },
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
      <div className="flex justify-center gap-4">
        <Button onClick={onReset} variant="outline" className="rounded-full px-8">
          <RotateCcw className="h-4 w-4 mr-2" /> Reset
        </Button>
        <Button onClick={() => window.location.reload()} className="gradient-bg rounded-full px-8">Done</Button>
      </div>
    </div>
  );
}

function UploadBox({ onFile, accept, label, sublabel, icon, loading }: {
  onFile: (f: File) => void; accept: string; label: string;
  sublabel: string; icon: React.ReactNode; loading: boolean;
}) {
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); };
  if (loading) return (
    <div className="text-center py-12">
      <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-muted-foreground animate-pulse text-sm">Analyzing with AI...</p>
    </div>
  );
  return (
    <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
      className="relative border-2 border-dashed border-border rounded-2xl p-10 text-center hover:border-primary hover:bg-white/5 cursor-pointer transition-all">
      <input type="file" accept={accept} onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
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

export default function Analyze() {
  const { toast } = useToast();
  const { userId, patientName, buildFormData, API } = usePatient();

  const [foodLoading, setFoodLoading] = useState(false);
  const [foodPreview, setFoodPreview] = useState<string | null>(null);
  const [foodResult,  setFoodResult]  = useState<any>(null);
  const [manualMode,  setManualMode]  = useState(false);
  const [manualFood,  setManualFood]  = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [foodMode, setFoodMode] = useState<"upload" | "camera">("upload");

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode]                    = useState<"user" | "environment">("environment");

  const handleFoodUpload = async (file: File) => {
    setFoodPreview(URL.createObjectURL(file));
    setFoodResult(null);
    setFoodLoading(true);
    const formData = buildFormData(file);
    try {
      const res = await fetch(`${API}/analyze-food`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Analysis failed.");
      setFoodResult(await res.json());
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
      setFoodPreview(null);
    } finally { setFoodLoading(false); }
  };

  const handleManualFoodSubmit = async () => {
    if (!manualFood.trim()) return;
    setManualLoading(true);
    try {
      const res = await fetch(`${API}/analyze-food-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ food_name: manualFood.trim(), user_id: userId || undefined, patient_name: patientName || undefined }),
      });
      if (!res.ok) throw new Error("Analysis failed.");
      const result = await res.json();
      result.food_name = manualFood.trim();
      setFoodResult(result);
      setManualMode(false);
      setManualFood("");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally { setManualLoading(false); }
  };

  const triggerManualCorrection = () => {
    const currentName = foodResult?.food_name !== "Unknown Food" ? foodResult?.food_name : "";
    setFoodResult(null); setFoodPreview(null);
    setManualFood(currentName); setManualMode(true);
  };

  const startFoodCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraActive(true);
    } catch { toast({ title: "Camera Error", description: "Could not access camera.", variant: "destructive" }); }
  };

  const stopFoodCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null; setCameraActive(false);
  };

  const captureFoodPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(blob => {
      if (!blob) return;
      stopFoodCamera(); setFoodMode("upload");
      handleFoodUpload(new File([blob], "capture.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-6 max-w-4xl space-y-10">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Food <span className="gradient-text">AI</span></h1>
            <p className="text-muted-foreground">Upload or capture a food photo for instant nutritional analysis.</p>
          </div>

          <div className="glass rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Utensils className="text-primary" />
              <h2 className="text-xl font-semibold">Food Analysis</h2>
            </div>

            {foodResult ? (
              <FoodResult result={foodResult} preview={foodPreview}
                onReset={() => { setFoodResult(null); setFoodPreview(null); }}
                onManualEdit={triggerManualCorrection} />
            ) : manualMode ? (
              <div className="space-y-4">
                <Button variant="ghost" onClick={() => setManualMode(false)}>← Back</Button>
                <div className="flex gap-3 bg-secondary/30 p-4 rounded-xl">
                  <Search className="text-primary" />
                  <input type="text" placeholder="Enter what you are eating..."
                    className="flex-1 bg-transparent outline-none text-foreground"
                    value={manualFood} onChange={e => setManualFood(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleManualFoodSubmit()} />
                  <Button onClick={handleManualFoodSubmit} disabled={manualLoading} className="gradient-bg">
                    {manualLoading ? "Processing..." : "Analyze"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex rounded-xl bg-secondary/30 p-1 gap-1">
                  <button onClick={() => { stopFoodCamera(); setFoodMode("upload"); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${foodMode === "upload" ? "gradient-bg text-white" : "text-muted-foreground"}`}>
                    Upload
                  </button>
                  <button onClick={() => { setFoodMode("camera"); startFoodCamera(); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${foodMode === "camera" ? "gradient-bg text-white" : "text-muted-foreground"}`}>
                    Camera
                  </button>
                </div>

                {foodMode === "upload" ? (
                  <>
                    <UploadBox onFile={handleFoodUpload} accept="image/*" label="Upload Food" sublabel="JPG, PNG, WEBP" icon={<Utensils />} loading={foodLoading} />
                    <div className="text-center text-xs text-muted-foreground py-2">OR</div>
                    <Button variant="outline" className="w-full border-dashed" onClick={() => setManualMode(true)}>
                      <Search className="mr-2 h-4 w-4" /> Type Manually
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="aspect-video bg-black rounded-2xl overflow-hidden">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    </div>
                    <div className="flex justify-center gap-3">
                      <Button onClick={captureFoodPhoto} className="gradient-bg px-8"><Camera className="mr-2" /> Capture</Button>
                      <Button variant="outline" onClick={() => { stopFoodCamera(); setFoodMode("upload"); }}>Cancel</Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-border">
                  <div className="flex gap-2 text-xs text-muted-foreground"><Zap className="h-4 w-4 text-yellow-400" /> Results auto-saved.</div>
                  <div className="flex gap-2 text-xs text-muted-foreground"><CheckCircle className="h-4 w-4 text-green-400" /> Multi-food support.</div>
                  <div className="flex gap-2 text-xs text-muted-foreground"><Info className="h-4 w-4 text-blue-400" /> AI analysis only.</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <FooterSection />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
