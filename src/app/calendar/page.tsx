"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useTheme } from "@/lib/useTheme";

interface CalEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string; // YYYY-MM-DD
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  all_grades: boolean;
  grade_levels: string[];
  related_grades: string[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatTime(t: string | null): string {
  if (!t) return "";
  // t is HH:MM:SS
  const [h, m] = t.split(":");
  const hour = Number(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [children, setChildren] = useState<{ id: string; full_name: string; grade_level: string }[]>([]);
  const [userName, setUserName] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "list">("month");
  const [cursor, setCursor] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState("");
  const [selected, setSelected] = useState<CalEvent | null>(null);

  const { darkMode, toggleTheme } = useTheme();

  useEffect(() => {
    // A 7-column grid leaves under 50px per cell on a phone, which is unusable.
    // Start on the agenda instead; the toggle is right there for the month.
    // Runs before the calendar paints (it waits on `loading`), so there is no
    // flash of the month grid.
    void (async () => {
      if (window.matchMedia("(max-width: 767px)").matches) setView("list");
    })();
  }, []);

  useEffect(() => {
    // Seeded here rather than during render: Next.js rejects unstable values
    // like `new Date()` in a Client Component, because they would be frozen
    // into the prerender instead of recomputed on each visit.
    void (async () => {
      const n = new Date();
      setNow(n);
      setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
      setTodayKey(toKey(n));
    })();

    // Live clock
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.name) setUserName(d.name); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [evRes, chRes] = await Promise.all([fetch("/api/events"), fetch("/api/children")]);
        if (evRes.status === 401 || chRes.status === 401) {
          router.push("/");
          return;
        }
        const evData = await evRes.json();
        const chData = await chRes.json();
        setEvents(evData.events ?? []);
        setChildren(chData.students ?? []);
      } catch {
        toast.error("Could not load events.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of events) {
      if (!map.has(e.event_date)) map.set(e.event_date, []);
      map.get(e.event_date)!.push(e);
    }
    return map;
  }, [events]);

  const monthGrid = useMemo(() => {
    if (!cursor) return [];
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const upcoming = useMemo(() => {
    if (!todayKey) return [];
    const today = parseDate(todayKey);
    return [...events]
      .filter((e) => parseDate(e.event_date) >= today)
      .sort((a, b) => (a.event_date < b.event_date ? -1 : 1));
  }, [events, todayKey]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const prevMonth = () => setCursor((c) => c ? new Date(c.getFullYear(), c.getMonth() - 1, 1) : c);
  const nextMonth = () => setCursor((c) => c ? new Date(c.getFullYear(), c.getMonth() + 1, 1) : c);
  const goToday = () => {
    const n = new Date();
    setCursor(new Date(n.getFullYear(), n.getMonth(), 1));
    setTodayKey(toKey(n));
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">School Calendar</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {userName && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border text-sm">
              <span className="text-foreground/80">
                {(() => {
                  const h = now ? now.getHours() : 12;
                  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
                })()}
                , <span className="font-semibold">{userName.split(" ")[0]}</span>
              </span>
              {now && (
                <span className="text-foreground/50 text-xs">
                  {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-background border border-border hover:opacity-80 transition-opacity"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
          <button
            onClick={logout}
            className="px-4 py-2 text-sm font-medium bg-primary text-[#4A342A] rounded-lg hover:opacity-90 transition-opacity"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 card-elevated relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 gradient-primary"></div>
            <div className="w-11 h-11 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold">{children.length}</div>
              <div className="text-xs text-foreground/60 uppercase tracking-wider">Linked children</div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 card-elevated relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 gradient-primary"></div>
            <div className="w-11 h-11 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold">{upcoming.length}</div>
              <div className="text-xs text-foreground/60 uppercase tracking-wider">Upcoming events</div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 card-elevated relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 gradient-primary"></div>
            <div className="w-11 h-11 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
                <path d="M6 12v5c3 3 9 3 12 0v-5"></path>
              </svg>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold truncate">
                {children.length === 0
                  ? "—"
                  : Array.from(new Set(children.map((c) => c.grade_level))).join(", ")}
              </div>
              <div className="text-xs text-foreground/60 uppercase tracking-wider">Grade levels</div>
            </div>
          </div>
        </div>

        {/* Main layout: calendar + upcoming sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Left: calendar / list */}
          <section className="min-w-0">
            {/* View toggle + month nav */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="inline-flex rounded-lg border border-border bg-card p-1">
                <button
                  onClick={() => setView("month")}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    view === "month" ? "bg-primary text-[#4A342A] font-medium" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    view === "list" ? "bg-primary text-[#4A342A] font-medium" : "text-foreground/70 hover:text-foreground"
                  }`}
                >
                  List
                </button>
              </div>

              {view === "month" && cursor && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevMonth}
                    className="p-2 rounded-lg border border-border bg-card hover:bg-background transition-colors"
                    aria-label="Previous month"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6"></path>
                    </svg>
                  </button>
                  <button
                    onClick={goToday}
                    className="px-3 py-1.5 text-sm rounded-lg border border-border bg-card hover:bg-background transition-colors"
                  >
                    Today
                  </button>
                  <span className="text-base font-semibold min-w-[140px] text-center">
                    {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
                  </span>
                  <button
                    onClick={nextMonth}
                    className="p-2 rounded-lg border border-border bg-card hover:bg-background transition-colors"
                    aria-label="Next month"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 18l6-6-6-6"></path>
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {loading || !cursor ? (
              <p className="text-foreground/60">Loading events...</p>
            ) : view === "month" ? (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="grid grid-cols-7 border-b border-border bg-background/50">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="py-2 text-center text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthGrid.map((d, i) => {
                    if (!d) {
                      return <div key={`blank-${i}`} className="min-h-[56px] sm:min-h-[92px] border-b border-r border-border/40 bg-background/30"></div>;
                    }
                    const key = toKey(d);
                    const dayEvents = eventsByDate.get(key) ?? [];
                    const isToday = key === todayKey;
                    return (
                      <div
                        key={key}
                        className={`min-h-[56px] sm:min-h-[92px] border-b border-r border-border/40 p-1.5 ${
                          isToday ? "bg-primary/10" : ""
                        }`}
                      >
                        <div className="mb-1">
                          {isToday ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-[#4A342A] text-xs font-bold shadow-sm">
                              {d.getDate()}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-foreground/70">
                              {d.getDate()}
                            </span>
                          )}
                        </div>

                        {/* Phones: a 7-column grid leaves ~48px per cell, so titles
                            would truncate to nothing. Show dots to scan with
                            instead; the agenda is the phone's primary view. */}
                        <div className="sm:hidden flex flex-wrap items-start gap-x-1 gap-y-1 px-0.5">
                          {dayEvents.slice(0, 3).map((e) => (
                            <button
                              key={e.id}
                              onClick={() => setSelected(e)}
                              title={e.title}
                              aria-label={e.title}
                              className="w-2 h-2 rounded-full bg-primary hover:bg-secondary transition-colors"
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[9px] leading-none text-foreground/60">
                              +{dayEvents.length - 3}
                            </span>
                          )}
                        </div>

                        <div className="hidden sm:block space-y-1">
                          {dayEvents.slice(0, 2).map((e) => (
                            <button
                              key={e.id}
                              onClick={() => setSelected(e)}
                              className="block w-full text-left text-[11px] leading-tight px-1.5 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-foreground truncate"
                              title={e.title}
                            >
                              {e.title}
                            </button>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-[10px] text-foreground/60 px-1.5">
                              +{dayEvents.length - 2} more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.length === 0 ? (
                  <p className="text-foreground/60">No upcoming events.</p>
                ) : (
                  upcoming.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSelected(e)}
                      className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-primary transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{e.title}</div>
                          <div className="text-sm text-foreground/60 mt-0.5">
                            {parseDate(e.event_date).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {e.start_time ? ` · ${formatTime(e.start_time)}` : ""}
                            {e.location ? ` · ${e.location}` : ""}
                          </div>
                          {e.related_grades.length > 0 && (
                            <div className="text-xs text-foreground/50 mt-1">
                              {e.related_grades.join(", ")}
                            </div>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-foreground/40 shrink-0 mt-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9 18l6-6-6-6"></path>
                        </svg>
                      </div>
                    </button>
                  ))
                )}
                {events.length > upcoming.length && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-foreground/60 hover:text-foreground">
                      Show past events ({events.length - upcoming.length})
                    </summary>
                    <div className="space-y-3 mt-3">
                      {[...events]
                        .filter((e) => !upcoming.includes(e))
                        .sort((a, b) => (a.event_date < b.event_date ? 1 : -1))
                        .map((e) => (
                          <button
                            key={e.id}
                            onClick={() => setSelected(e)}
                            className="w-full text-left bg-card border border-border rounded-lg p-4 opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <div className="font-semibold truncate">{e.title}</div>
                            <div className="text-sm text-foreground/60 mt-0.5">
                              {parseDate(e.event_date).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                              {e.start_time ? ` · ${formatTime(e.start_time)}` : ""}
                            </div>
                          </button>
                        ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </section>

          {/* Right sidebar: upcoming events */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="bg-card border border-border rounded-xl p-4 card-elevated">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold">List of events</h2>
                <span className="text-xs text-foreground/60">{events.length} total</span>
              </div>
              {events.length === 0 ? (
                <p className="text-sm text-foreground/60 py-4 text-center">No events.</p>
              ) : (
                <ul className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                  {[...events].sort((a, b) => (a.event_date < b.event_date ? -1 : 1)).slice(0, 15).map((e) => {
                    const d = parseDate(e.event_date);
                    return (
                      <li key={e.id}>
                        <button
                          onClick={() => setSelected(e)}
                          className={`w-full text-left flex items-start gap-3 p-2 rounded-lg hover:bg-background transition-colors ${
                            todayKey && parseDate(e.event_date) < parseDate(todayKey) ? "opacity-50" : ""
                          }`}
                        >
                          <div className="w-12 shrink-0 text-center bg-primary/15 rounded-lg py-1">
                            <div className="text-[10px] font-semibold tracking-wider text-primary">
                              {d.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
                            </div>
                            <div className="text-lg font-bold leading-tight text-foreground">
                              {d.getDate()}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{e.title}</div>
                            <div className="text-xs text-foreground/60 mt-0.5">
                              {e.start_time ? formatTime(e.start_time) : "All day"}
                              {e.location ? ` · ${e.location}` : ""}
                            </div>
                            {e.related_grades.length > 0 && (
                              <div className="text-[11px] text-foreground/50 mt-0.5 truncate">
                                {e.related_grades.join(", ")}
                              </div>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {events.length > 15 && (
                    <li className="text-xs text-foreground/60 text-center pt-2">
                      +{events.length - 15} more — see List view
                    </li>
                  )}
                </ul>
              )}
            </div>

            {children.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 mt-4 card-elevated">
                <h2 className="text-base font-semibold mb-3">Your children</h2>
                <ul className="space-y-2">
                  {children.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{c.full_name}</span>
                      <span className="text-xs text-foreground/60 shrink-0 ml-2">{c.grade_level}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/children"
                  className="mt-3 inline-flex items-center justify-center gap-2 min-h-11 w-full px-3 py-2 text-sm font-medium bg-primary text-[#4A342A] rounded-lg hover:opacity-90 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  Manage children
                </Link>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* Event detail modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-title"
        >
          <div
            className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header band */}
            <div className="relative px-6 py-5 gradient-primary text-white">
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">
                    Event details
                  </div>
                  <h2 id="event-title" className="text-xl font-bold leading-tight">
                    {selected.title}
                  </h2>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="shrink-0 p-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Date + time highlight */}
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 text-center bg-primary/10 rounded-xl py-2">
                  <div className="text-[11px] font-semibold tracking-wider text-primary">
                    {parseDate(selected.event_date).toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
                  </div>
                  <div className="text-2xl font-bold leading-none text-foreground">
                    {parseDate(selected.event_date).getDate()}
                  </div>
                  <div className="text-[10px] text-foreground/60 mt-0.5">
                    {parseDate(selected.event_date).toLocaleDateString(undefined, { weekday: "short" })}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    {parseDate(selected.event_date).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  {(selected.start_time || selected.end_time) && (
                    <div className="text-sm text-foreground/70 mt-1 flex items-center gap-1.5">
                      <svg className="w-4 h-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 6v6l4 2"></path>
                      </svg>
                      {formatTime(selected.start_time)}
                      {selected.end_time ? ` – ${formatTime(selected.end_time)}` : ""}
                    </div>
                  )}
                  {selected.location && (
                    <div className="text-sm text-foreground/70 mt-1 flex items-center gap-1.5">
                      <svg className="w-4 h-4 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      {selected.location}
                    </div>
                  )}
                </div>
              </div>

              {/* Grade chips */}
              <div>
                <div className="text-xs font-medium text-foreground/60 mb-1.5">Grade levels</div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.all_grades ? (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary font-medium">
                      All grades
                    </span>
                  ) : (
                    selected.grade_levels.map((g) => (
                      <span
                        key={g}
                        className="text-xs px-2.5 py-1 rounded-full bg-muted text-foreground/80 font-medium"
                      >
                        {g}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {selected.related_grades.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="text-xs font-medium text-primary mb-1">For your children</div>
                  <div className="text-sm text-foreground">{selected.related_grades.join(", ")}</div>
                </div>
              )}

              {selected.description && (
                <div>
                  <div className="text-xs font-medium text-foreground/60 mb-1.5">Description</div>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {selected.description}
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border bg-background/40 flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm font-medium bg-primary text-[#4A342A] rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
