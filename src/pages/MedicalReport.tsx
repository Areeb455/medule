import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePatient } from "@/hooks/usePatient";
import { FileText, RotateCcw, AlertTriangle, Sparkles, ArrowRight, Trash2, Eye, X, RefreshCw } from "lucide-react";

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

      {/* Smart Recommendations CTA */}
      <div className="glass border border-primary/30 rounded-xl p-5 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-primary/5">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="font-semibold text-foreground flex items-center gap-2 justify-center sm:justify-start">
            <Sparkles className="h-4 w-4 text-primary" /> Personalized Treatment & Products Ready
          </h4>
          <p className="text-xs text-muted-foreground">
            Our AI has prepared tailored natural remedies, OTC medicines, and supportive health products based on your report findings.
          </p>
        </div>
        <Button asChild className="gradient-bg rounded-full px-6 shrink-0 shadow-md">
          <Link to="/recommendations">
            View Recommendations <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

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
    <div className="text-center py-16 space-y-3">
      <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-2" />
      <p className="text-foreground font-medium text-base animate-pulse">Analyzing your report with AI...</p>
      <p className="text-xs text-muted-foreground max-w-md mx-auto">
        Extracting clinical test parameters, abnormal markers, and normal ranges. Detailed multi-page reports and scans may take 20–30 seconds.
      </p>
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
  const { userId, authHeaders, buildFormData, API } = usePatient();

  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<any>(null);

  // Past reports history state
  const [pastReports, setPastReports]         = useState<any[]>([]);
  const [loadingPast, setLoadingPast]         = useState(false);
  const [deletingId, setDeletingId]           = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchPastReports = async () => {
    if (!userId) return;
    setLoadingPast(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/user-reports/${userId}`, { headers });
      if (res.ok) {
        setPastReports(await res.json());
      } else {
        const dtRes = await fetch(`${API}/digital-twin/${userId}`, { headers });
        if (dtRes.ok) {
          const dt = await dtRes.json();
          setPastReports(dt.recent_diseases || []);
        }
      }
    } catch {
      // silent fallback
    } finally {
      setLoadingPast(false);
    }
  };

  useEffect(() => {
    if (userId) fetchPastReports();
  }, [userId]);

  const handleDeleteReport = async (logId: string) => {
    if (!logId || !userId) return;
    setDeletingId(logId);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/disease-log/${logId}?user_id=${userId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Failed to delete report");
      toast({ title: "Report Deleted", description: "The report has been removed from your history." });
      setPastReports(prev => prev.filter(r => (r._id || r.id) !== logId));
      setConfirmDeleteId(null);
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpload = async (file: File) => {
    setLoading(true);
    setResult(null);
    const formData = buildFormData(file);
    try {
      const res = await fetch(`${API}/analyze-disease`, { method: "POST", body: formData });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Analysis failed." }));
        throw new Error(errData.detail || "Analysis failed.");
      }
      const data = await res.json();
      setResult(data);
      toast({ title: "Report Analyzed", description: "Medical report analysis complete." });
      fetchPastReports();
    } catch (err: any) {
      toast({ title: "Failed to Analyze Report", description: err.message, variant: "destructive" });
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
              <ReportResult result={result} onReset={() => { setResult(null); fetchPastReports(); }} />
            ) : (
              <UploadBox onFile={handleUpload} loading={loading} />
            )}
          </div>

          {/* Past Reports History & Management */}
          {!result && !loading && userId && (
            <div className="glass card-shadow rounded-2xl p-6 sm:p-8 animate-fade-in-up">
              <div className="flex items-center justify-between mb-6 pb-3 border-b border-border/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl gradient-bg text-primary-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">Your Saved Medical Reports</h3>
                    <p className="text-xs text-muted-foreground">
                      Access past analyses or delete mistaken/unneeded reports anytime
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchPastReports}
                  disabled={loadingPast}
                  className="rounded-full text-xs text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingPast ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {loadingPast ? (
                <div className="text-center py-8">
                  <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : pastReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No medical reports uploaded yet.</p>
                  <p className="text-xs opacity-75 mt-1">Upload a PDF or scan above to see your analysis history here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pastReports.map((r, i) => {
                    const logId = r._id || r.id || `rep-${i}`;
                    const isConfirming = confirmDeleteId === logId;
                    const isDeleting = deletingId === logId;

                    return (
                      <div
                        key={i}
                        className="bg-secondary/20 hover:bg-secondary/35 border border-border/40 rounded-xl p-4 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-foreground text-sm truncate">
                              {r.condition_name || "Diagnostic Report"}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              r.severity === "Mild" ? "bg-green-500/10 text-green-400 border-green-500/30"
                              : r.severity === "Moderate" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                              : "bg-red-500/10 text-red-400 border-red-500/30"
                            }`}>
                              {r.severity || "Analyzed"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {r.summary || r.full_result?.brief_description || "Pathology analysis completed"}
                          </p>
                          <span className="text-[10px] opacity-60 mt-1 block">
                            {r.timestamp ? new Date(r.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Recently saved"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          {/* View report */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setResult(r.full_result || r)}
                            className="rounded-full text-xs h-8 px-3 border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Eye className="h-3 w-3 mr-1" /> View Full Analysis
                          </Button>

                          {/* Delete report */}
                          {isConfirming ? (
                            <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/40 rounded-full px-3 py-1">
                              <span className="text-xs text-red-400 font-semibold">Delete?</span>
                              <button
                                onClick={() => handleDeleteReport(logId)}
                                disabled={isDeleting}
                                className="text-xs font-bold text-red-400 hover:text-red-300 px-1"
                              >
                                {isDeleting ? "..." : "Yes"}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-xs text-muted-foreground hover:text-foreground px-1"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteId(logId)}
                              className="rounded-full text-xs h-8 px-3 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                              title="Delete report"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!result && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: "What it analyzes", text: "Blood tests, lipid profiles, diabetes markers, vitamin deficiencies, kidney & liver function, and more." },
                { title: "Supported formats", text: "PDF reports from Apollo, Thyrocare, SRL — or a clear photo of any printed report." },
                { title: "Full Privacy Control", text: "You can view, access, and permanently delete any uploaded report from your history at any time." },
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
