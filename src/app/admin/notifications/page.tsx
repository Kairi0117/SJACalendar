"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface LogRow {
  id: string;
  event_title: string;
  parent_email: string;
  type: string;
  sent_at: string;
  status: string;
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch {
      toast.error("Could not load notification log.");
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

  const typeLabel: Record<string, string> = {
    posted: "Posted",
    manual: "Manual notify",
    "1_month": "1 month before",
    "1_week": "1 week before",
    "3_days": "3 days before",
  };

  return (
    <div>
      <main className="space-y-6">
        <h1 className="text-xl font-bold">Notification Log</h1>
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground/60">
            Emails are sent automatically when an event is posted, and daily for reminders (1 month, 1 week, 3 days before).
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/admin/test-email", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) toast.error(data.error || "Test email failed.");
                  else toast.success(`Test email sent to ${data.to}.`);
                } catch {
                  toast.error("Network error.");
                }
              }}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-background transition-colors"
            >
              Test email
            </button>
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/admin/notifications/run", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) {
                    toast.error(data.error || "Run failed.");
                  } else {
                    toast.success(`Reminder check complete. Sent ${data.totalSent} email(s).`);
                    load();
                  }
                } catch {
                  toast.error("Network error.");
                }
              }}
              className="px-4 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Run reminder check
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-foreground/60">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-foreground/60">No notifications sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-4 font-medium text-foreground/60">Sent</th>
                  <th className="py-2 pr-4 font-medium text-foreground/60">Event</th>
                  <th className="py-2 pr-4 font-medium text-foreground/60">Parent</th>
                  <th className="py-2 pr-4 font-medium text-foreground/60">Type</th>
                  <th className="py-2 font-medium text-foreground/60">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/40">
                    <td className="py-2 pr-4 text-foreground/70 whitespace-nowrap">
                      {new Date(l.sent_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{l.event_title}</td>
                    <td className="py-2 pr-4 text-foreground/70">{l.parent_email}</td>
                    <td className="py-2 pr-4">{typeLabel[l.type] ?? l.type}</td>
                    <td className="py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          l.status === "sent"
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary/15 text-secondary"
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
