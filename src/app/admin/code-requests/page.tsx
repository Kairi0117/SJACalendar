"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Check, Clock, User } from "lucide-react";

interface CodeRequest {
  id: string;
  parent_email: string;
  status: string;
  created_at: string;
  student: { id: string; full_name: string; grade_level: string } | null;
}

export default function AdminCodeRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<CodeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [newCodeModal, setNewCodeModal] = useState<{ code: string; studentName: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Ticks so relative timestamps stay current.
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/code-requests");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setRequests(data.requests ?? []);
      setNowMs(Date.now());
    } catch {
      toast.error("Could not load code requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markDone = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/code-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "done" }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || "Could not update.");
      else {
        toast.success("Request marked as done.");
        load();
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  };

  const generateCode = async (req: CodeRequest) => {
    if (!req.student) {
      toast.error("No student linked to this request.");
      return;
    }
    if (busyId) return; // prevent double-trigger
    setBusyId(req.id);
    try {
      const res = await fetch(`/api/admin/students/${req.student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_code", notify_email: req.parent_email }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not generate code.");
        return;
      }
      // mark request done
      await fetch("/api/admin/code-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.id, status: "done" }),
      });
      if (data.emailed) {
        toast.success(`New code generated and emailed to ${req.parent_email}.`);
      } else {
        toast.error(data.emailError || "Email could not be sent; showing code instead.");
        setNewCodeModal({ code: data.code, studentName: req.student.full_name });
      }
      load();
    } catch {
      toast.error("Network error.");
    } finally {
      setBusyId(null);
    }
  };

  const timeAgo = (dateStr: string) => {
    if (!nowMs) return new Date(dateStr).toLocaleDateString();
    const diff = nowMs - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const filtered = requests.filter((r) => (filter === "open" ? r.status === "open" : true));
  const openCount = requests.filter((r) => r.status === "open").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Code Requests</h1>
        <p className="text-sm text-foreground/60 mt-1">
          Parents who forgot their student code and requested a new one.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("open")}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filter === "open"
              ? "bg-secondary text-white border-secondary"
              : "border-border text-foreground/70 hover:text-foreground hover:bg-background"
          }`}
        >
          Open ({openCount})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            filter === "all"
              ? "bg-secondary text-white border-secondary"
              : "border-border text-foreground/70 hover:text-foreground hover:bg-background"
          }`}
        >
          All ({requests.length})
        </button>
      </div>

      {loading ? (
        <p className="text-foreground/60">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-card border border-border rounded-xl">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
            <Check className="w-6 h-6 text-primary" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium">
            {filter === "open" ? "No open requests. You're all caught up." : "No requests yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 card-elevated"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-foreground/40 shrink-0" aria-hidden="true" />
                  <span className="font-medium truncate">{r.parent_email}</span>
                  {r.status === "open" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/15 text-secondary font-medium">
                      Open
                    </span>
                  )}
                </div>
                <div className="text-sm text-foreground/60 mt-1 ml-6">
                  {r.student ? `${r.student.full_name} (${r.student.grade_level})` : "Unknown student"}
                </div>
                <div className="text-xs text-foreground/50 mt-1 ml-6 flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {timeAgo(r.created_at)}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                {r.student && r.status === "open" && (
                  <button
                    onClick={() => generateCode(r)}
                    disabled={busyId === r.id || busyId !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {busyId === r.id ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                        <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <KeyRound className="w-4 h-4" aria-hidden="true" />
                    )}
                    {busyId === r.id ? "Generating..." : "Generate new code"}
                  </button>
                )}
                {r.status === "open" && (
                  <button
                    onClick={() => markDone(r.id)}
                    disabled={busyId !== null}
                    className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark done
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {newCodeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setNewCodeModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">New code generated</h3>
            <p className="text-sm text-foreground/70 mb-3">
              Hand this code to the family for <strong>{newCodeModal.studentName}</strong>. Shown only once.
            </p>
            <div className="bg-background border border-border rounded-lg p-4 flex items-center justify-between gap-3 mb-4">
              <span className="font-mono text-2xl font-bold text-primary tracking-widest">
                {newCodeModal.code}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(newCodeModal.code)}
                className="px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-card transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="text-xs text-secondary mb-4">
              The previous code no longer works. The request has been marked as done.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setNewCodeModal(null)}
                className="px-4 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
