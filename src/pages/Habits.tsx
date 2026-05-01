import { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePatient } from "@/hooks/usePatient";
import {
  Monitor, Coffee, Play, Square, Clock, Zap,
  BarChart3, Calendar, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, Legend,
} from "recharts";

// ── Constants ─────────────────────────────────────────────
const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const TICK_MS           = 1000;           // update every second

// ── Helpers ───────────────────────────────────────────────
function fmt(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

interface DayStats {
  date:          string;
  activeSeconds: number;
  idleSeconds:   number;
  sessions:      number;
}

// ── Component ─────────────────────────────────────────────
export default function Habits() {
  const { toast } = useToast();
  const { userId, patientName, authHeaders, API } = usePatient();

  // Timer state
  const [tracking, setTracking]     = useState(false);
  const [isIdle, setIsIdle]         = useState(false);
  const [activeSeconds, setActive]  = useState(0);
  const [idleSeconds, setIdle]      = useState(0);
  const [sessions, setSessions]     = useState(0);

  // History (stored in localStorage)
  const [history, setHistory]       = useState<DayStats[]>([]);

  const lastActivityRef = useRef<number>(Date.now());
  const tickRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const idleCheckRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingRef     = useRef(false);
  const isIdleRef       = useRef(false);

  // ── Load history from localStorage ──
  useEffect(() => {
    const raw = localStorage.getItem("medule_habit_history");
    if (raw) setHistory(JSON.parse(raw));
  }, []);

  // ── Activity detection ──
  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isIdleRef.current && trackingRef.current) {
      isIdleRef.current = false;
      setIsIdle(false);
    }
  }, []);

  useEffect(() => {
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetActivity, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, resetActivity));
  }, [resetActivity]);

  // Page visibility — pause when tab hidden
  useEffect(() => {
    const handle = () => {
      if (document.hidden && trackingRef.current) resetActivity();
    };
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, [resetActivity]);

  // ── Tick ──
  const startTick = () => {
    tickRef.current = setInterval(() => {
      if (!trackingRef.current) return;
      if (document.hidden) return; // don't count hidden tab time

      const idle = Date.now() - lastActivityRef.current > IDLE_THRESHOLD_MS;
      if (idle !== isIdleRef.current) {
        isIdleRef.current = idle;
        setIsIdle(idle);
      }

      if (idle) {
        setIdle(p => p + 1);
      } else {
        setActive(p => p + 1);
      }
    }, TICK_MS);
  };

  const stopTick = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };

  // ── Start / Stop ──
  const startTracking = () => {
    trackingRef.current = true;
    setTracking(true);
    setSessions(p => p + 1);
    lastActivityRef.current = Date.now();
    startTick();
    toast({ title: "Tracking started", description: "Your screen time is now being recorded." });
  };

  const stopTracking = async () => {
    trackingRef.current = false;
    setTracking(false);
    stopTick();

    const today = todayKey();
    const entry: DayStats = {
      date:          today,
      activeSeconds: activeSeconds,
      idleSeconds:   idleSeconds,
      sessions:      sessions,
    };

    // Merge with existing today entry if any
    setHistory(prev => {
      const existing = prev.find(d => d.date === today);
      let updated: DayStats[];
      if (existing) {
        updated = prev.map(d =>
          d.date === today
            ? {
                ...d,
                activeSeconds: d.activeSeconds + activeSeconds,
                idleSeconds:   d.idleSeconds   + idleSeconds,
                sessions:      d.sessions      + sessions,
              }
            : d
        );
      } else {
        updated = [entry, ...prev].slice(0, 30); // keep 30 days
      }
      localStorage.setItem("medule_habit_history", JSON.stringify(updated));
      return updated;
    });

    // Save to backend
    if (userId) {
      try {
        const headers = await authHeaders();
        await fetch(`${API}/log-habit`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id:        userId,
            patient_name:   patientName,
            date:           today,
            active_minutes: activeSeconds / 60,
            idle_minutes:   idleSeconds   / 60,
            total_minutes:  (activeSeconds + idleSeconds) / 60,
            sessions:       sessions,
          }),
        });
        toast({ title: "Session saved", description: "Your habit data has been saved to your profile." });
      } catch {
        // Silent fail — data is still in localStorage
      }
    }

    setActive(0);
    setIdle(0);
    setSessions(0);
  };

  // ── Chart data ──
  const chartData = [...history]
    .reverse()
    .slice(-14)
    .map(d => ({
      date:   d.date.slice(5),           // MM-DD
      Active: Math.round(d.activeSeconds / 60),
      Idle:   Math.round(d.idleSeconds   / 60),
    }));

  const totalActive = history.reduce((s, d) => s + d.activeSeconds, 0);
  const totalIdle   = history.reduce((s, d) => s + d.idleSeconds,   0);
  const avgSession  = history.length
    ? Math.round(history.reduce((s, d) => s + d.sessions, 0) / history.length)
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-6 max-w-5xl">

          {/* Header */}
          <div className="mb-10 text-center animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Habit <span className="gradient-text">Tracker</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Track your screen time and idle periods in real-time. Build healthier digital habits.
            </p>
          </div>

          {/* Live tracker card */}
          <div className="glass card-shadow rounded-2xl p-8 mb-8 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <Monitor className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Live Session</h2>
              {tracking && (
                <span className="ml-auto flex items-center gap-2 text-sm text-green-400">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                  Recording
                </span>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Active Time",   value: fmt(activeSeconds),   icon: <Zap className="h-4 w-4" />,      color: "text-green-400" },
                { label: "Idle Time",     value: fmt(idleSeconds),     icon: <Coffee className="h-4 w-4" />,   color: "text-yellow-400" },
                { label: "Total Time",    value: fmt(activeSeconds + idleSeconds), icon: <Clock className="h-4 w-4" />, color: "text-blue-400" },
                { label: "Focus Sessions",value: `${sessions}`,        icon: <TrendingUp className="h-4 w-4" />, color: "text-purple-400" },
              ].map((stat, i) => (
                <div key={i} className="bg-secondary/30 rounded-xl p-4 text-center">
                  <div className={`flex justify-center mb-2 ${stat.color}`}>{stat.icon}</div>
                  <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Status indicator */}
            {tracking && (
              <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 transition-all ${
                isIdle
                  ? "bg-yellow-500/10 border border-yellow-500/20"
                  : "bg-green-500/10 border border-green-500/20"
              }`}>
                {isIdle ? <Coffee className="h-5 w-5 text-yellow-400" /> : <Zap className="h-5 w-5 text-green-400" />}
                <div>
                  <p className={`font-semibold ${isIdle ? "text-yellow-400" : "text-green-400"}`}>
                    {isIdle ? "You appear idle" : "You're active"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isIdle
                      ? "No mouse/keyboard activity detected for 5+ minutes"
                      : "Activity detected — tracking productive time"}
                  </p>
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex justify-center gap-4">
              {!tracking ? (
                <Button onClick={startTracking} className="gradient-bg rounded-full px-10 py-3 text-base">
                  <Play className="h-5 w-5 mr-2" /> Start Tracking
                </Button>
              ) : (
                <Button onClick={stopTracking} variant="outline" className="rounded-full px-10 py-3 text-base border-red-500/30 text-red-400 hover:bg-red-500/10">
                  <Square className="h-5 w-5 mr-2" /> Stop & Save
                </Button>
              )}
            </div>

            {/* Tips */}
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                "5+ minutes without input = idle",
                "Hidden browser tabs not counted",
                "Data auto-saves to your profile",
              ].map((tip, i) => (
                <div key={i} className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* History charts */}
          {history.length > 0 && (
            <div className="space-y-6">

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total Active Time (all time)", value: fmt(totalActive), color: "text-green-400" },
                  { label: "Total Idle Time (all time)",   value: fmt(totalIdle),   color: "text-yellow-400" },
                  { label: "Avg Sessions/Day",             value: `${avgSession}`,  color: "text-purple-400" },
                ].map((s, i) => (
                  <div key={i} className="glass card-shadow rounded-2xl p-6 text-center">
                    <div className={`text-3xl font-bold mb-1 ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Area chart */}
              <div className="glass card-shadow rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Daily Screen Time (Last 14 Days)</h3>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="idleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#eab308" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#888" }} unit="m" />
                    <Tooltip
                      contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                      labelStyle={{ color: "#ccc" }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="Active" stroke="#22c55e" fill="url(#activeGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Idle"   stroke="#eab308" fill="url(#idleGrad)"   strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Bar chart */}
              <div className="glass card-shadow rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Active vs Idle Comparison</h3>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#888" }} unit="m" />
                    <Tooltip
                      contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }}
                    />
                    <Legend />
                    <Bar dataKey="Active" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Idle"   fill="#eab308" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

            </div>
          )}

          {history.length === 0 && (
            <div className="glass card-shadow rounded-2xl p-10 text-center text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>No history yet — start a tracking session to see your stats here.</p>
            </div>
          )}

        </div>
      </main>
      <FooterSection />
    </div>
  );
}