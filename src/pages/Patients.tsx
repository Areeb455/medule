import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import FooterSection from "@/components/FooterSection";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { usePatient } from "@/hooks/usePatient";
import {
  Users, Search, ChevronDown, ChevronUp,
  Utensils, Stethoscope, Clock, RefreshCw,
  Plus, Save, X,
} from "lucide-react";

export default function Patients() {
  const { userId, patientName, authHeaders, API } = usePatient();
  const { toast } = useToast();

  const [patients, setPatients]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [detail, setDetail]       = useState<Record<string, any>>({});

  // Manual entry state
  const [showManual, setShowManual] = useState<string | null>(null); // user_id
  const [manualCat, setManualCat]   = useState("food");
  const [manualText, setManualText] = useState("");
  const [saving, setSaving]         = useState(false);

  const fetchPatients = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/patients`, { headers });
      if (!res.ok) throw new Error("Failed to load patients");
      setPatients(await res.json());
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (uid: string) => {
    if (detail[uid]) return; // already loaded
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/patient/${uid}`, { headers });
      if (!res.ok) throw new Error("Failed to load patient detail");
      const d = await res.json();
      setDetail(prev => ({ ...prev, [uid]: d }));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const toggleExpand = (uid: string) => {
    if (expanded === uid) {
      setExpanded(null);
    } else {
      setExpanded(uid);
      fetchDetail(uid);
    }
  };

  const saveManualEntry = async (targetUserId: string, targetName: string) => {
    if (!manualText.trim()) return;
    setSaving(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`${API}/log-manual`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id:      targetUserId,
          patient_name: targetName,
          category:     manualCat,
          summary:      manualText.trim(),
        }),
      });
      if (!res.ok) throw new Error("Failed to save entry");
      toast({ title: "Saved", description: "Manual entry added to patient record." });
      setShowManual(null);
      setManualText("");
      // Refresh detail
      delete detail[targetUserId];
      fetchDetail(targetUserId);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { if (userId) fetchPatients(); }, [userId]);

  const filtered = patients.filter(p =>
    p.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.user_id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 pt-24 pb-12">
        <div className="container mx-auto px-6 max-w-5xl">

          {/* Header */}
          <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in-up">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
                Patient <span className="gradient-text">Management</span>
              </h1>
              <p className="text-muted-foreground">
                All patient records — auto-populated from feature usage. Add manual entries anytime.
              </p>
            </div>
            <Button onClick={fetchPatients} disabled={loading} className="gradient-bg rounded-full px-6">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patients by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-secondary/30 border border-border rounded-full pl-11 pr-5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Patients", value: patients.length, icon: <Users className="h-4 w-4" />, color: "text-blue-400" },
              { label: "Total Food Logs", value: patients.reduce((s, p) => s + (p.food_count || 0), 0), icon: <Utensils className="h-4 w-4" />, color: "text-green-400" },
              { label: "Total Disease Logs", value: patients.reduce((s, p) => s + (p.disease_count || 0), 0), icon: <Stethoscope className="h-4 w-4" />, color: "text-red-400" },
            ].map((s, i) => (
              <div key={i} className="glass card-shadow rounded-2xl p-5 text-center">
                <div className={`flex justify-center mb-2 ${s.color}`}>{s.icon}</div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Patient list */}
          {loading ? (
            <div className="text-center py-16">
              <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass card-shadow rounded-2xl p-10 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No patients found. They'll appear here as users sign in and use Medule features.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((patient) => {
                const uid = patient.user_id;
                const isOpen = expanded === uid;
                const d = detail[uid];

                return (
                  <div key={uid} className="glass card-shadow rounded-2xl overflow-hidden">

                    {/* Patient row */}
                    <div
                      className="flex items-center gap-4 p-5 cursor-pointer hover:bg-white/5 transition-all"
                      onClick={() => toggleExpand(uid)}
                    >
                      <div className="w-10 h-10 rounded-full gradient-bg flex items-center justify-center shrink-0 text-primary-foreground font-bold text-sm">
                        {(patient.patient_name || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{patient.patient_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground">
                          Last active: {patient.last_active ? new Date(patient.last_active).toLocaleString() : "—"}
                        </p>
                      </div>
                      <div className="hidden md:flex items-center gap-6 text-center">
                        {[
                          { icon: <Utensils className="h-3 w-3" />, val: patient.food_count || 0, color: "text-green-400", label: "food" },
                          { icon: <Stethoscope className="h-3 w-3" />, val: patient.disease_count || 0, color: "text-red-400", label: "disease" },
                          { icon: <Clock className="h-3 w-3" />, val: patient.habit_count || 0, color: "text-purple-400", label: "habits" },
                        ].map((s, i) => (
                          <div key={i} className="text-center">
                            <div className={`flex justify-center mb-0.5 ${s.color}`}>{s.icon}</div>
                            <div className={`text-sm font-bold ${s.color}`}>{s.val}</div>
                            <div className="text-xs text-muted-foreground">{s.label}</div>
                          </div>
                        ))}
                      </div>
                      <div className="text-muted-foreground">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="border-t border-border px-5 pb-5 pt-4">
                        {!d ? (
                          <div className="text-center py-4">
                            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Manual entry button */}
                            <div className="flex justify-end">
                              <Button
                                size="sm"
                                className="gradient-bg rounded-full px-4 text-xs"
                                onClick={() => setShowManual(showManual === uid ? null : uid)}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Add Manual Entry
                              </Button>
                            </div>

                            {/* Manual entry form */}
                            {showManual === uid && (
                              <div className="bg-secondary/20 rounded-xl p-4 space-y-3">
                                <div className="flex gap-2">
                                  {["food", "disease", "habit"].map(cat => (
                                    <button
                                      key={cat}
                                      onClick={() => setManualCat(cat)}
                                      className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${
                                        manualCat === cat ? "gradient-bg text-primary-foreground" : "bg-secondary/40 text-muted-foreground"
                                      }`}
                                    >
                                      {cat}
                                    </button>
                                  ))}
                                </div>
                                <input
                                  type="text"
                                  placeholder={`Enter ${manualCat} note...`}
                                  value={manualText}
                                  onChange={e => setManualText(e.target.value)}
                                  className="w-full bg-background/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" className="gradient-bg rounded-full px-4 text-xs" disabled={saving}
                                    onClick={() => saveManualEntry(uid, patient.patient_name)}>
                                    <Save className="h-3 w-3 mr-1" /> {saving ? "Saving..." : "Save"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowManual(null)}>
                                    <X className="h-3 w-3 mr-1" /> Cancel
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Recent logs */}
                            <div className="grid md:grid-cols-3 gap-3">
                              {[
                                { title: "Food", logs: d.food_logs, color: "text-green-400", key: (l: any) => l.food_name || l.summary },
                                { title: "Disease", logs: d.disease_logs, color: "text-red-400", key: (l: any) => l.condition_name || l.summary },
                                { title: "Habits", logs: d.habit_logs, color: "text-purple-400", key: (l: any) => l.summary },
                              ].map((section) => (
                                <div key={section.title}>
                                  <p className={`text-xs font-semibold mb-2 ${section.color}`}>{section.title}</p>
                                  {section.logs?.length > 0 ? (
                                    <div className="space-y-1">
                                      {section.logs.slice(0, 4).map((l: any, i: number) => (
                                        <div key={i} className="text-xs text-muted-foreground bg-secondary/20 rounded px-2 py-1.5 truncate">
                                          {section.key(l)}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">No logs</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>
      </main>
      <FooterSection />
    </div>
  );
}