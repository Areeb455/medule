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
} from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function Dashboard() {
  const { user } = useUser();
  const { userId, patientName, authHeaders, API } = usePatient();
  const { toast } = useToast();

  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

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
      setData(await res.json());
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

          {error && !loading && (
            <div className="glass card-shadow rounded-2xl p-10 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">{error}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Use the <strong>Analyze</strong>, <strong>Diagnose</strong>, or <strong>Habits</strong> features to start building your profile.
              </p>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-6 animate-fade-in-up">

              {/* Patient card */}
              <div className="glass card-shadow rounded-2xl p-6 flex items-center gap-6">
                <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center shrink-0">
                  <User className="h-8 w-8 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{data.patient_name}</h2>
                  <p className="text-muted-foreground text-sm">
                    Last active: {data.last_active ? new Date(data.last_active).toLocaleString() : "N/A"}
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
                  <div className="flex items-center gap-2 mb-4">
                    <Utensils className="h-4 w-4 text-green-400" />
                    <h4 className="font-semibold text-foreground">Recent Food</h4>
                  </div>
                  <div className="space-y-2">
                    {data.recent_food?.length > 0
                      ? data.recent_food.slice(0, 5).map((f: any, i: number) => (
                          <div key={i} className="text-sm text-muted-foreground bg-secondary/20 rounded-lg px-3 py-2">
                            <span className="text-foreground font-medium">{f.food_name || "—"}</span>
                            <span className="ml-2 text-xs">{f.calories ? `${f.calories} kcal` : ""}</span>
                            <div className="text-xs opacity-60 mt-0.5">
                              {f.timestamp ? new Date(f.timestamp).toLocaleDateString() : ""}
                            </div>
                          </div>
                        ))
                      : <p className="text-sm text-muted-foreground">No food logs yet.</p>
                    }
                  </div>
                </div>

                {/* Disease */}
                <div className="glass card-shadow rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Stethoscope className="h-4 w-4 text-red-400" />
                    <h4 className="font-semibold text-foreground">Recent Conditions</h4>
                  </div>
                  <div className="space-y-2">
                    {data.recent_diseases?.length > 0
                      ? data.recent_diseases.slice(0, 5).map((d: any, i: number) => (
                          <div key={i} className="text-sm text-muted-foreground bg-secondary/20 rounded-lg px-3 py-2">
                            <span className="text-foreground font-medium">{d.condition_name || "—"}</span>
                            <span className={`ml-2 text-xs font-semibold ${
                              d.severity === "Mild" ? "text-green-400"
                              : d.severity === "Moderate" ? "text-yellow-400"
                              : "text-red-400"
                            }`}>{d.severity}</span>
                            <div className="text-xs opacity-60 mt-0.5">
                              {d.timestamp ? new Date(d.timestamp).toLocaleDateString() : ""}
                            </div>
                          </div>
                        ))
                      : <p className="text-sm text-muted-foreground">No disease logs yet.</p>
                    }
                  </div>
                </div>

                {/* Habits */}
                <div className="glass card-shadow rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-4 w-4 text-purple-400" />
                    <h4 className="font-semibold text-foreground">Recent Habits</h4>
                  </div>
                  <div className="space-y-2">
                    {data.recent_habits?.length > 0
                      ? data.recent_habits.slice(0, 5).map((h: any, i: number) => (
                          <div key={i} className="text-sm text-muted-foreground bg-secondary/20 rounded-lg px-3 py-2">
                            <span className="text-foreground font-medium">{h.date || "—"}</span>
                            <div className="text-xs opacity-80 mt-0.5">{h.summary}</div>
                          </div>
                        ))
                      : <p className="text-sm text-muted-foreground">No habit logs yet.</p>
                    }
                  </div>
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