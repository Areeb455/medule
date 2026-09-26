import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePatient } from "@/hooks/usePatient";
import {
  Brain, Heart, Activity, Clock, Utensils, 
  Stethoscope, RefreshCw, TrendingUp, AlertCircle, User,
  Trash2, Eye, X, FileText, AlertTriangle,
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

function formatDateSafe(ts: any): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? String(ts) : d.toLocaleDateString();
  } catch {
    return String(ts);
  }
}

export default function Dashboard() {
  const { user } = useUser();
  const { userId, patientName, authHeaders, API } = usePatient();
  const { toast } = useToast();

  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Report detail modal and deletion state
  const [selectedReport, setSelectedReport]   = useState<any | null>(null);
  const [deletingId, setDeletingId]           = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [vitals, setVitals] = useState<any>({ age: "", height_cm: "", weight_kg: "", gender: "" });
const [vitalsSaving, setVitalsSaving] = useState(false);

const handleSaveVitals = async () => {
  if (!userId) return;
  setVitalsSaving(true);
  try {
    const headers = await authHeaders();
    const bmi = vitals.height_cm && vitals.weight_kg
      ? parseFloat((parseFloat(vitals.weight_kg) / Math.pow(parseFloat(vitals.height_cm) / 100, 2)).toFixed(1))
      : null;
    const res = await fetch(`${API}/save-vitals`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        patient_name: patientName || user?.fullName || "",
        vitals: { ...vitals, bmi },
        bmi,
      }),
    });
    if (!res.ok) throw new Error("Failed to save.");
    toast({ title: "Vitals Saved", description: "Your Digital Twin has been updated." });
    fetchTwin();
  } catch (err: any) {
    toast({ title: "Failed", description: err.message, variant: "destructive" });
  } finally { setVitalsSaving(false); }
};

  const fetchTwin = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/digital-twin/${userId}`, { headers });
      if (res.status === 404) {
        setError("No health data found yet. Start by analyzing food, diseases, or tracking habits.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load health profile");
      const json = await res.json();
      setData(json);
      if (json.vitals) {
        setVitals({
          age: json.vitals.age || "",
          height_cm: json.vitals.height_cm || "",
          weight_kg: json.vitals.weight_kg || "",
          gender: json.vitals.gender || "",
        });
      }
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchTwin();
  }, [userId]);

  const handleDeleteDisease = async (logId: string) => {
    if (!logId || !userId) return;
    setDeletingId(logId);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/disease-log/${logId}?user_id=${userId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to delete" }));
        throw new Error(err.detail || "Failed to delete report");
      }
      toast({ title: "Report Deleted", description: "The medical report was removed from your history." });
      setConfirmDeleteId(null);
      if (selectedReport && (selectedReport._id === logId || selectedReport.id === logId)) {
        setSelectedReport(null);
      }
      setData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          disease_count: Math.max(0, (prev.disease_count || 1) - 1),
          recent_diseases: (prev.recent_diseases || []).filter((x: any) => (x._id || x.id) !== logId),
        };
      });
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteFood = async (logId: string) => {
    if (!logId || !userId) return;
    setDeletingId(logId);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/food-log/${logId}?user_id=${userId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Failed to delete food entry");
      toast({ title: "Food Entry Deleted", description: "Removed from your nutritional history." });
      setConfirmDeleteId(null);
      setData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          food_count: Math.max(0, (prev.food_count || 1) - 1),
          recent_food: (prev.recent_food || []).filter((x: any) => (x._id || x.id) !== logId),
        };
      });
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteHabit = async (logId: string) => {
    if (!logId || !userId) return;
    setDeletingId(logId);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/habit-log/${logId}?user_id=${userId}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Failed to delete habit entry");
      toast({ title: "Habit Entry Deleted", description: "Removed from your habit history." });
      setConfirmDeleteId(null);
      setData((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          habit_count: Math.max(0, (prev.habit_count || 1) - 1),
          recent_habits: (prev.recent_habits || []).filter((x: any) => (x._id || x.id) !== logId),
        };
      });
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // Radar chart: completeness of health data
  const radarData = data
    ? [
        { metric: "Nutrition",   value: Math.min(data.food_count    * 10, 100) },
        { metric: "Disease Log", value: Math.min(data.disease_count * 15, 100) },
        { metric: "Habits",      value: Math.min(data.habit_count   * 10, 100) },
        { metric: "Activity",    value: data.habit_count > 0 ? 70 : 10 },
        { metric: "Monitoring",  value: (data.food_count + data.disease_count + data.habit_count) > 5 ? 80 : 30 },
      ]
    : [];

  // Pie: log breakdown
  const pieData = data
    ? [
        { name: "Food Logs",    value: data.food_count    || 0 },
        { name: "Disease Logs", value: data.disease_count || 0 },
        { name: "Habit Logs",   value: data.habit_count   || 0 },
      ].filter(d => d.value > 0)
    : [];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-6 max-w-6xl">

          {/* Header */}
          <div className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in-up">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                Digital <span className="gradient-text">Twin</span>
              </h1>
              <p className="text-muted-foreground">
                Your real-time health profile — updated automatically as you use Medule.
              </p>
            </div>
            <Button onClick={fetchTwin} disabled={loading} className="gradient-bg rounded-full px-6">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh Profile
            </Button>
          </div>

          {loading && (
            <div className="text-center py-20">
              <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground animate-pulse">Building your health profile with AI...</p>
            </div>
          )}

          {!loading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Left Column (Stats & Twin Summary) */}
              <div className="lg:col-span-2 space-y-6">
                {error && (
                  <div className="glass card-shadow rounded-2xl p-10 text-center">
                    <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                    <p className="text-muted-foreground text-lg">{error}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Use the <strong>Analyze</strong>, <strong>Diagnose</strong>, or <strong>Habits</strong> features to start building your profile.
                    </p>
                  </div>
                )}

                {data && (
                  <div className="space-y-6 animate-fade-in-up">
                    {/* Patient card */}
                    <div className="glass card-shadow rounded-2xl p-6 flex items-center gap-6">
                      <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center shrink-0">
                        <User className="h-8 w-8 text-primary-foreground" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">{data.patient_name}</h2>
                        <p className="text-muted-foreground text-sm">
                          Last active: {formatDateSafe(data.last_active) || "N/A"}
                        </p>
                      </div>
                      <div className="ml-auto grid grid-cols-3 gap-6 text-center">
                        {[
                          { label: "Food Logs",    value: data.food_count,    icon: <Utensils className="h-4 w-4" />,    color: "text-green-400" },
                          { label: "Disease Logs", value: data.disease_count, icon: <Stethoscope className="h-4 w-4" />, color: "text-red-400" },
                          { label: "Habit Logs",   value: data.habit_count,   icon: <Clock className="h-4 w-4" />,       color: "text-purple-400" },
                        ].map((s, i) => (
                          <div key={i}>
                            <div className={`flex justify-center mb-1 ${s.color}`}>{s.icon}</div>
                            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                            <div className="text-xs text-muted-foreground">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* AI Summary */}
                    <div className="glass card-shadow rounded-2xl p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Brain className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold text-foreground">AI Health Summary</h3>
                        <span className="ml-auto text-xs text-muted-foreground bg-secondary/40 px-3 py-1 rounded-full">
                          Generated by Gemini AI
                        </span>
                      </div>
                      <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                        {data.ai_summary}
                      </div>
                    </div>

                    {/* Charts row */}
                    <div className="grid md:grid-cols-2 gap-6">

                      {/* Radar */}
                      <div className="glass card-shadow rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Activity className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-semibold text-foreground">Health Profile Completeness</h3>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                          <RadarChart data={radarData}>
                            <PolarGrid stroke="#333" />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: "#888", fontSize: 12 }} />
                            <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Pie */}
                      <div className="glass card-shadow rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          <h3 className="text-lg font-semibold text-foreground">Log Breakdown</h3>
                        </div>
                        {pieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Pie>
                              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">
                            No logs yet
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent logs */}
                    <div className="grid md:grid-cols-3 gap-4">

                      {/* Food */}
                      <div className="glass card-shadow rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Utensils className="h-4 w-4 text-green-400" />
                            <h4 className="font-semibold text-foreground text-sm">Recent Food</h4>
                          </div>
                          <span className="text-xs text-muted-foreground">{data.recent_food?.length || 0} entries</span>
                        </div>
                        <div className="space-y-2">
                          {data.recent_food?.length > 0
                            ? data.recent_food.slice(0, 5).map((f: any, i: number) => {
                                const logId = f._id || f.id || `f-${i}`;
                                const isConfirming = confirmDeleteId === logId;
                                const isDeleting = deletingId === logId;
                                return (
                                  <div key={i} className="group relative text-sm text-muted-foreground bg-secondary/20 hover:bg-secondary/30 transition-all rounded-lg p-3 flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-foreground font-medium truncate">{f.food_name || "—"}</span>
                                        {f.calories ? <span className="text-xs text-green-400 font-semibold shrink-0">{f.calories} kcal</span> : null}
                                      </div>
                                      <div className="text-xs opacity-60 mt-0.5">
                                        {formatDateSafe(f.timestamp)}
                                      </div>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-1">
                                      {isConfirming ? (
                                        <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5">
                                          <span className="text-[10px] text-red-400 font-semibold">Delete?</span>
                                          <button
                                            onClick={() => handleDeleteFood(logId)}
                                            disabled={isDeleting}
                                            className="text-red-400 hover:text-red-300 p-1"
                                            title="Confirm delete"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={() => setConfirmDeleteId(null)}
                                            className="text-muted-foreground hover:text-foreground p-1"
                                            title="Cancel"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setConfirmDeleteId(logId)}
                                          className="text-muted-foreground/60 hover:text-red-400 opacity-60 hover:opacity-100 p-1 rounded transition-all"
                                          title="Delete food entry"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            : <p className="text-sm text-muted-foreground">No food logs yet.</p>
                          }
                        </div>
                      </div>

                      {/* Medical Reports & Disease Conditions */}
                      <div className="glass card-shadow rounded-2xl p-5 border border-red-500/20">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4 text-red-400" />
                            <h4 className="font-semibold text-foreground text-sm">Medical Reports</h4>
                          </div>
                          <span className="text-xs text-red-400/80 font-medium">{data.recent_diseases?.length || 0} reports</span>
                        </div>
                        <div className="space-y-2">
                          {data.recent_diseases?.length > 0
                            ? data.recent_diseases.slice(0, 6).map((d: any, i: number) => {
                                const logId = d._id || d.id || `d-${i}`;
                                const isConfirming = confirmDeleteId === logId;
                                const isDeleting = deletingId === logId;
                                return (
                                  <div key={i} className="group text-sm text-muted-foreground bg-secondary/20 hover:bg-secondary/35 rounded-lg p-3 transition-all border border-border/40 hover:border-red-500/30">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <span className="text-foreground font-semibold text-sm truncate flex-1" title={d.condition_name}>
                                        {d.condition_name || "Medical Report"}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                        d.severity === "Mild" ? "bg-green-500/10 text-green-400 border-green-500/30"
                                        : d.severity === "Moderate" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                                        : "bg-red-500/10 text-red-400 border-red-500/30"
                                      }`}>
                                        {d.severity || "Report"}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-border/20 text-xs">
                                      <span className="opacity-60 text-[11px]">
                                        {formatDateSafe(d.timestamp)}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        {/* View Details */}
                                        <button
                                          onClick={() => setSelectedReport(d)}
                                          className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-primary/10 transition-all"
                                          title="View full report"
                                        >
                                          <Eye className="h-3 w-3" /> View
                                        </button>

                                        {/* Delete Action */}
                                        {isConfirming ? (
                                          <div className="flex items-center gap-1 bg-red-500/15 border border-red-500/40 rounded px-1.5 py-0.5">
                                            <span className="text-[10px] text-red-400 font-bold">Delete?</span>
                                            <button
                                              onClick={() => handleDeleteDisease(logId)}
                                              disabled={isDeleting}
                                              className="text-red-400 hover:text-red-300 font-bold px-1"
                                              title="Confirm Delete"
                                            >
                                              {isDeleting ? "..." : "Yes"}
                                            </button>
                                            <button
                                              onClick={() => setConfirmDeleteId(null)}
                                              className="text-muted-foreground hover:text-foreground px-1"
                                              title="Cancel"
                                            >
                                              <X className="h-3 w-3" />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => setConfirmDeleteId(logId)}
                                            className="text-muted-foreground/60 hover:text-red-400 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-red-500/10 transition-all"
                                            title="Delete this report"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                            <span className="text-[11px]">Delete</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            : (
                              <div className="text-center py-6 text-muted-foreground">
                                <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">No medical reports saved yet.</p>
                              </div>
                            )
                          }
                        </div>
                      </div>

                      {/* Habits */}
                      <div className="glass card-shadow rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-purple-400" />
                            <h4 className="font-semibold text-foreground text-sm">Recent Habits</h4>
                          </div>
                          <span className="text-xs text-muted-foreground">{data.recent_habits?.length || 0} entries</span>
                        </div>
                        <div className="space-y-2">
                          {data.recent_habits?.length > 0
                            ? data.recent_habits.slice(0, 5).map((h: any, i: number) => {
                                const logId = h._id || h.id || `h-${i}`;
                                const isConfirming = confirmDeleteId === logId;
                                const isDeleting = deletingId === logId;
                                return (
                                  <div key={i} className="group text-sm text-muted-foreground bg-secondary/20 hover:bg-secondary/30 rounded-lg p-3 transition-all flex items-center justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <span className="text-foreground font-medium text-xs block">{h.date || "—"}</span>
                                      <div className="text-xs opacity-80 mt-0.5 truncate">{h.summary}</div>
                                    </div>
                                    <div className="shrink-0">
                                      {isConfirming ? (
                                        <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5">
                                          <span className="text-[10px] text-red-400 font-semibold">Delete?</span>
                                          <button
                                            onClick={() => handleDeleteHabit(logId)}
                                            disabled={isDeleting}
                                            className="text-red-400 hover:text-red-300 p-1"
                                            title="Confirm delete"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                          <button
                                            onClick={() => setConfirmDeleteId(null)}
                                            className="text-muted-foreground hover:text-foreground p-1"
                                            title="Cancel"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setConfirmDeleteId(logId)}
                                          className="text-muted-foreground/60 hover:text-red-400 opacity-60 hover:opacity-100 p-1 rounded transition-all"
                                          title="Delete habit entry"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            : <p className="text-sm text-muted-foreground">No habit logs yet.</p>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column (Health Vitals Form) */}
              <div className="lg:col-span-1">
                <div className="glass card-shadow rounded-2xl p-6 space-y-4 h-fit animate-fade-in-up">
                  <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                    <User className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Health Vitals</h3>
                  </div>

                  <div className="space-y-4">
                    {/* Age */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Age (years)</label>
                      <input
                        type="number"
                        value={vitals.age || ""}
                        onChange={(e) => setVitals({ ...vitals, age: e.target.value })}
                        placeholder="e.g. 25"
                        className="w-full bg-secondary/20 border border-border/50 rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                      />
                    </div>

                    {/* Height */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Height (cm)</label>
                      <input
                        type="number"
                        value={vitals.height_cm || ""}
                        onChange={(e) => setVitals({ ...vitals, height_cm: e.target.value })}
                        placeholder="e.g. 175"
                        className="w-full bg-secondary/20 border border-border/50 rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                      />
                    </div>

                    {/* Weight */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        value={vitals.weight_kg || ""}
                        onChange={(e) => setVitals({ ...vitals, weight_kg: e.target.value })}
                        placeholder="e.g. 70"
                        className="w-full bg-secondary/20 border border-border/50 rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                      />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">Gender</label>
                      <select
                        value={vitals.gender || ""}
                        onChange={(e) => setVitals({ ...vitals, gender: e.target.value })}
                        className="w-full bg-secondary/20 border border-border/50 rounded-xl px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm appearance-none cursor-pointer"
                      >
                        <option value="" className="bg-background">Select Gender</option>
                        <option value="Male" className="bg-background">Male</option>
                        <option value="Female" className="bg-background">Female</option>
                        <option value="Other" className="bg-background">Other</option>
                      </select>
                    </div>

                    {/* BMI Indicator if values exist */}
                    {vitals.height_cm && vitals.weight_kg && (
                      <div className="bg-secondary/10 border border-border/30 rounded-xl p-3 text-center animate-fade-in">
                        <span className="text-xs text-muted-foreground block">Calculated BMI</span>
                        <span className="text-2xl font-bold text-foreground">
                          {(parseFloat(vitals.weight_kg) / Math.pow(parseFloat(vitals.height_cm) / 100, 2)).toFixed(1)}
                        </span>
                        {(() => {
                          const bmi = parseFloat(vitals.weight_kg) / Math.pow(parseFloat(vitals.height_cm) / 100, 2);
                          if (bmi < 18.5) return <span className="text-xs text-blue-400 font-semibold block">Underweight</span>;
                          if (bmi < 25) return <span className="text-xs text-green-400 font-semibold block">Normal Weight</span>;
                          if (bmi < 30) return <span className="text-xs text-yellow-400 font-semibold block">Overweight</span>;
                          return <span className="text-xs text-red-400 font-semibold block">Obese</span>;
                        })()}
                      </div>
                    )}

                    <Button
                      onClick={handleSaveVitals}
                      disabled={vitalsSaving}
                      className="w-full gradient-bg rounded-xl py-2.5 mt-2 text-sm font-semibold"
                    >
                      {vitalsSaving ? "Saving..." : "Save Vitals"}
                    </Button>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* Medical Report Detail & Deletion Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in">
          <div className="glass border border-border/60 card-shadow rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 md:p-8 space-y-6 relative">
            <button
              onClick={() => setSelectedReport(null)}
              className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary/40 transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl gradient-bg shrink-0">
                <FileText className="h-6 w-6 text-primary-foreground" />
              </div>
              <div className="flex-1 pr-6">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl md:text-2xl font-bold text-foreground">
                    {selectedReport.condition_name || "Medical Report"}
                  </h3>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    selectedReport.severity === "Mild" ? "bg-green-500/10 text-green-400 border-green-500/30"
                    : selectedReport.severity === "Moderate" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                    : "bg-red-500/10 text-red-400 border-red-500/30"
                  }`}>
                    {selectedReport.severity || "Analysis"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recorded: {formatDateSafe(selectedReport.timestamp) || "Recent"}
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-secondary/20 rounded-xl p-4 border border-border/40">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Summary</h4>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                {selectedReport.full_result?.brief_description || selectedReport.full_result?.report_summary || selectedReport.summary || "No additional summary provided."}
              </p>
            </div>

            {/* Causes / Treatments / Risks if present */}
            {selectedReport.full_result && (
              <div className="grid md:grid-cols-3 gap-3">
                {selectedReport.full_result.causes && (
                  <div className="bg-secondary/20 rounded-xl p-3.5 border border-border/30">
                    <p className="text-xs font-bold text-red-400 mb-2">Causes</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {selectedReport.full_result.causes.slice(0, 3).map((c: string, idx: number) => (
                        <li key={idx} className="truncate">• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedReport.full_result.treatments && (
                  <div className="bg-secondary/20 rounded-xl p-3.5 border border-border/30">
                    <p className="text-xs font-bold text-green-400 mb-2">Treatments</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {selectedReport.full_result.treatments.slice(0, 3).map((t: string, idx: number) => (
                        <li key={idx} className="truncate">• {t}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedReport.full_result.risks && (
                  <div className="bg-secondary/20 rounded-xl p-3.5 border border-border/30">
                    <p className="text-xs font-bold text-yellow-400 mb-2">Risks</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      {selectedReport.full_result.risks.slice(0, 3).map((r: string, idx: number) => (
                        <li key={idx} className="truncate">• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Footer with Delete and Close */}
            <div className="pt-4 border-t border-border/40 flex items-center justify-between gap-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const id = selectedReport._id || selectedReport.id;
                  handleDeleteDisease(id);
                }}
                disabled={deletingId === (selectedReport._id || selectedReport.id)}
                className="rounded-full px-5 text-xs font-semibold gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletingId === (selectedReport._id || selectedReport.id) ? "Deleting..." : "Delete This Report"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedReport(null)}
                className="rounded-full px-5 text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <FooterSection />
    </div>
  );
}
