import { useState } from "react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePatient } from "@/hooks/usePatient";
import { FileText, RotateCcw, AlertTriangle } from "lucide-react";

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

      {result.report_summary && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-6">
          <h4 className="font-semibold text-blue-400 mb-2">📋 Detailed Report Summary</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{result.report_summary}</p>
        </div>
      )}

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
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> See a Doctor If:
          </h3>
          <ul className="space-y-1">
            {result.see_doctor_if.map((s: string, i: number) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                <span className="text-red-400 shrink-0">•</span>{s}
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
  );
}

function UploadBox({ onFile, loading }: { onFile: (f: File) => void; loading: boolean }) {
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); };
  if (loading) return (
    <div className="text-center py-16">
      <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
      <p className="text-muted-foreground animate-pulse text-sm">Analyzing your report with AI...</p>
    </div>
  );
  return (
    <div onDrop={handleDrop} onDragOver={e => e.preventDefault()}
      className="relative border-2 border-dashed border-border rounded-2xl p-14 text-center hover:border-primary hover:bg-white/5 cursor-pointer transition-all">
      <input type="file" accept=".pdf,image/*"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      <div className="flex flex-col items-center gap-4">
        <div className="p-5 rounded-full gradient-bg">
          <FileText className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="text-xl font-semibold text-foreground">Upload Report</p>
          <p className="text-sm text-muted-foreground mt-1">PDF or Image — Apollo, Thyrocare, SRL and other standard reports</p>
        </div>
      </div>
    </div>
  );
}

export default function MedicalReport() {
  const { toast } = useToast();
  const { buildFormData, API } = usePatient();

  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<any>(null);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setResult(null);
    const formData = buildFormData(file);
    try {
      const res = await fetch(`${API}/analyze-disease`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Analysis failed.");
      setResult(await res.json());
      toast({ title: "Report Analyzed", description: "Medical report analysis complete." });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-6 max-w-4xl space-y-10">

          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Medical Report <span className="gradient-text">AI</span>
            </h1>
            <p className="text-muted-foreground">
              Upload your pathology report or health document — PDF or image — and get a detailed AI analysis.
            </p>
          </div>

          <div className="glass rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="text-primary" />
              <h2 className="text-xl font-semibold">Report Analysis</h2>
            </div>

            {result ? (
              <ReportResult result={result} onReset={() => setResult(null)} />
            ) : (
              <UploadBox onFile={handleUpload} loading={loading} />
            )}
          </div>

          {!result && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: "What it analyzes", text: "Blood tests, lipid profiles, diabetes markers, vitamin deficiencies, kidney & liver function, and more." },
                { title: "Supported formats", text: "PDF reports from Apollo, Thyrocare, SRL — or a clear photo of any printed report." },
                { title: "Privacy", text: "Your report is analyzed and immediately deleted. Nothing is stored without your permission." },
              ].map((c, i) => (
                <div key={i} className="glass rounded-xl p-5">
                  <h4 className="font-semibold text-foreground mb-2">{c.title}</h4>
                  <p className="text-xs text-muted-foreground">{c.text}</p>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
      <FooterSection />
    </div>
  );
}
