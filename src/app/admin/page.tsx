"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GRADE_LEVELS } from "@/lib/grades";
import {
  CalendarDays,
  Users,
  Plus,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Mail,
  Sparkles,
} from "lucide-react";

interface EventRow {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  all_grades: boolean;
  grade_levels: string[];
}

interface StudentRow {
  id: string;
  full_name: string;
  grade_level: string;
}

interface CodeRequest {
  id: string;
  parent_email: string;
  status: string;
  created_at: string;
  student: { id: string; full_name: string; grade_level: string } | null;
}

interface LogRow {
  id: string;
  event_id: string;
  type: string;
  sent_at: string;
  status: string;
  event_title: string;
  parent_email: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function collapseGrades(grades: string[], allGrades: boolean): string {
  if (allGrades) return "All grades";
  if (grades.length === 0) return "—";
  const sorted = [...grades].sort((a, b) => GRADE_LEVELS.indexOf(a as never) - GRADE_LEVELS.indexOf(b as never));
  // collapse consecutive
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  let prevIdx = GRADE_LEVELS.indexOf(sorted[0] as never);
  for (let i = 1; i < sorted.length; i++) {
    const idx = GRADE_LEVELS.indexOf(sorted[i] as never);
    if (idx === prevIdx + 1) {
      prev = sorted[i];
      prevIdx = idx;
    } else {
      if (start === prev) ranges.push(start);
      else ranges.push(`${start} to ${prev}`);
      start = sorted[i];
      prev = sorted[i];
      prevIdx = idx;
    }
  }
  if (start === prev) ranges.push(start);
  else ranges.push(`${start} to ${prev}`);
  return ranges.join(", ");
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AdminDashboard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [requests, setRequests] = useState<CodeRequest[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Mini calendar cursor and today's date key, seeded in the effect below.
  const [calCursor, setCalCursor] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState("");

  useEffect(() => {
    // Seeded here rather than during render: Next.js rejects unstable values
    // like `new Date()` in a Client Component, because they would be frozen
    // into the prerender instead of recomputed on each visit.
    void (async () => {
      const n = new Date();
      setCalCursor(new Date(n.getFullYear(), n.getMonth(), 1));
      setTodayKey(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`);
    })();
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error("unauth");
        return r.json();
      })
      .then((d) => {
        if (d.role !== "admin") throw new Error("forbidden");
        setReady(true);
      })
      .catch(() => router.push("/admin/login"));
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const [sRes, eRes, rRes, nRes] = await Promise.all([
          fetch("/api/admin/students"),
          fetch("/api/admin/events"),
          fetch("/api/admin/code-requests"),
          fetch("/api/admin/notifications"),
        ]);
        const sData = await sRes.json();
        const eData = await eRes.json();
        const rData = await rRes.json();
        const nData = await nRes.json();
        setStudents(sData.students ?? []);
        setEvents(eData.events ?? []);
        setRequests(rData.requests ?? []);
        setLogs(nData.logs ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [ready]);

  const openRequests = requests.filter((r) => r.status === "open");

  // upcoming events (today or future), sorted
  const upcoming = useMemo(() => {
    if (!todayKey) return [];
    const today = new Date(todayKey + "T00:00:00");
    return [...events]
      .filter((e) => new Date(e.event_date + "T00:00:00") >= today)
      .sort((a, b) => (a.event_date < b.event_date ? -1 : 1));
  }, [events, todayKey]);

  // mini calendar grid
  const miniGrid = useMemo(() => {
    if (!calCursor) return [];
    const year = calCursor.getFullYear();
    const month = calCursor.getMonth();
    const first = new Date(year, month, 1);
    const startWd = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startWd; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calCursor]);

  const eventDays = useMemo(() => {
    const set = new Set<string>();
    if (!calCursor) return set;
    for (const e of events) {
      const d = new Date(e.event_date + "T00:00:00");
      if (d.getFullYear() === calCursor.getFullYear() && d.getMonth() === calCursor.getMonth()) {
        set.add(String(d.getDate()));
      }
    }
    return set;
  }, [events, calCursor]);

  // parents reached per notification group (event+type)
  const notificationGroups = useMemo(() => {
    const map = new Map<string, { event: string; type: string; count: number; sent_at: string }>();
    for (const l of logs) {
      const key = `${l.event_id}__${l.type}`;
      if (!map.has(key)) {
        map.set(key, { event: l.event_title, type: l.type, count: 0, sent_at: l.sent_at });
      }
      const g = map.get(key)!;
      g.count += 1;
      if (l.sent_at > g.sent_at) g.sent_at = l.sent_at;
    }
    return Array.from(map.values())
      .sort((a, b) => (a.sent_at < b.sent_at ? 1 : -1))
      .slice(0, 5);
  }, [logs]);

  const typeLabel: Record<string, string> = {
    posted: "Posted",
    "1_month": "1 month",
    "1_week": "1 week",
    "3_days": "3 days",
    "1_day": "1 day",
  };

  const stats = [
    { label: "Students", value: students.length, hint: students.length === 0 ? "Add your first student" : `${students.length} enrolled`, icon: Users },
    { label: "Events", value: events.length, hint: `${upcoming.length} upcoming`, icon: CalendarDays },
    { label: "Open code requests", value: openRequests.length, hint: openRequests.length > 0 ? "Needs your attention" : "All caught up", icon: Inbox, urgent: openRequests.length > 0 },
    { label: "Emails sent", value: logs.length, hint: logs.length > 0 ? "Last sent recently" : "None yet", icon: Mail },
  ];

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-foreground/60 text-sm">Here&apos;s what&apos;s happening at SJA today.</p>
        </div>
        <Link
          href="/admin/events"
          className="inline-flex items-center gap-2 min-h-11 px-4 py-2.5 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity self-start"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          New event
        </Link>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`bg-card border rounded-xl p-4 card-elevated ${
                (s as { urgent?: boolean }).urgent
                  ? "border-secondary/60 bg-secondary/5"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    (s as { urgent?: boolean }).urgent
                      ? "bg-secondary/20 text-secondary"
                      : "bg-secondary/10 text-secondary"
                  }`}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
              </div>
              <div className="text-3xl font-bold mt-3">{s.value}</div>
              <div className="text-sm text-foreground mt-0.5">{s.label}</div>
              <div className="text-xs text-foreground/50 mt-1">{s.hint}</div>
            </div>
          );
        })}
      </div>

      {/* Main content: 2/3 + 1/3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: upcoming events */}
        <section className="lg:col-span-2 bg-card border border-border rounded-xl p-5 card-elevated">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Upcoming events</h2>
            <Link href="/admin/events" className="inline-flex items-center min-h-11 text-xs text-secondary hover:opacity-80 underline underline-offset-4">
              View all
            </Link>
          </div>

          {loading ? (
            <p className="text-sm text-foreground/60">Loading...</p>
          ) : upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-3">
                <CalendarDays className="w-6 h-6 text-secondary" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">No events yet</p>
              <p className="text-xs text-foreground/60 mt-1 mb-4">Create your first event to get started.</p>
              <Link
                href="/admin/events"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-secondary text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Create your first event
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {upcoming.slice(0, 8).map((e) => {
                const d = new Date(e.event_date + "T00:00:00");
                return (
                  <li key={e.id} className="py-3 flex items-start gap-3">
                    <div className="w-12 shrink-0 text-center bg-secondary/10 rounded-lg py-1">
                      <div className="text-[10px] font-semibold tracking-wider text-secondary">
                        {d.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
                      </div>
                      <div className="text-lg font-bold leading-tight text-foreground">
                        {d.getDate()}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{e.title}</div>
                      <div className="text-xs text-foreground/60 mt-0.5">
                        {e.start_time ? e.start_time.slice(0, 5) : "All day"}
                        {e.all_grades ? " (All grades)" : ""}
                      </div>
                      {!e.all_grades && e.grade_levels.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-foreground/70">
                            {collapseGrades(e.grade_levels, e.all_grades)}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right column */}
        <div className="space-y-6">
          {/* Mini calendar */}
          <section className="bg-card border border-border rounded-xl p-4 card-elevated">
            {calCursor ? (
              <>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCalCursor(new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1))}
                className="p-1.5 rounded-lg hover:bg-background transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
              </button>
              <div className="text-sm font-semibold">
                {MONTHS[calCursor.getMonth()]} {calCursor.getFullYear()}
              </div>
              <button
                onClick={() => setCalCursor(new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1))}
                className="p-1.5 rounded-lg hover:bg-background transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-[10px] font-semibold text-foreground/50 py-1">
                  {w}
                </div>
              ))}
              {miniGrid.map((d, i) => {
                if (d === null) return <div key={`b-${i}`} />;
                const key = `${calCursor.getFullYear()}-${String(calCursor.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const hasEvent = eventDays.has(String(d));
                const isToday = key === todayKey;
                return (
                  <div
                    key={key}
                    className={`relative aspect-square flex items-center justify-center text-xs rounded-md ${
                      isToday ? "bg-primary text-[#4A342A] font-bold" : "text-foreground/80"
                    }`}
                  >
                    {d}
                    {hasEvent && !isToday && (
                      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-secondary" />
                    )}
                  </div>
                );
              })}
            </div>
            </>
            ) : null}
          </section>

          {/* Code requests */}
          <section className="bg-card border border-border rounded-xl p-4 card-elevated">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Code requests</h3>
              <Link href="/admin/students" className="inline-flex items-center min-h-11 text-xs text-secondary hover:opacity-80 underline underline-offset-4">
                Manage
              </Link>
            </div>
            {openRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <Sparkles className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium">No open requests</p>
                <p className="text-xs text-foreground/60 mt-1">You&apos;re all caught up.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {openRequests.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.parent_email}</div>
                      <div className="text-xs text-foreground/60">
                        {r.student ? `${r.student.full_name} (${r.student.grade_level})` : "Unknown student"}
                      </div>
                      <div className="text-[11px] text-foreground/50 mt-0.5">{timeAgo(r.created_at)}</div>
                    </div>
                    <Link
                      href="/admin/students"
                      className="shrink-0 inline-flex items-center min-h-11 text-xs px-2 py-1 rounded-md border border-border hover:bg-background transition-colors"
                    >
                      Generate new code
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Recent notifications */}
      <section className="bg-card border border-border rounded-xl p-5 card-elevated">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent notifications</h2>
          <Link href="/admin/notifications" className="inline-flex items-center min-h-11 text-xs text-secondary hover:opacity-80 underline underline-offset-4">
            View all
          </Link>
        </div>
        {notificationGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center mb-2">
              <Mail className="w-5 h-5 text-secondary" aria-hidden="true" />
            </div>
            <p className="text-sm font-medium">No emails sent yet</p>
            <p className="text-xs text-foreground/60 mt-1">They go out automatically when you post an event.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {notificationGroups.map((g, i) => (
              <li key={i} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{g.event}</div>
                  <div className="text-xs text-foreground/60 mt-0.5">
                    {typeLabel[g.type] ?? g.type} · {g.count} parent{g.count !== 1 ? "s" : ""} reached
                  </div>
                </div>
                <div className="text-xs text-foreground/50 shrink-0">
                  {new Date(g.sent_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
