"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Student {
  id: string;
  full_name: string;
  grade_level: string;
  student_number: string | null;
}

export default function ChildrenPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [userName, setUserName] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ studentNameOrId: "", studentCode: "" });
  const [adding, setAdding] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/children");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setStudents(data.students ?? []);
    } catch {
      toast.error("Could not load children.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      // Seeded here rather than during render: Next.js rejects unstable
      // values like `new Date()` in a Client Component.
      setNow(new Date());
      await load();
    })();
    const timer = setInterval(() => setNow(new Date()), 60000);
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.name) setUserName(d.name); })
      .catch(() => {});
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/children", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not add child.");
      } else {
        toast.success(`${data.student.full_name} (${data.student.grade_level}) added.`);
        setForm({ studentNameOrId: "", studentCode: "" });
        load();
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const requestCodeGen = async (studentId: string) => {
    setRequestingId(studentId);
    try {
      const res = await fetch("/api/children/code-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not request code.");
      } else {
        toast.success("Code request sent to the school office.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setRequestingId(null);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            href="/calendar"
            className="inline-flex items-center gap-2 min-h-11 px-3 py-1.5 text-sm font-medium bg-card border border-border rounded-lg hover:bg-background transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H5M12 19l-7-7 7-7"></path>
            </svg>
            Back to Calendar
          </Link>
          <h1 className="text-xl font-bold">My Children</h1>
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
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium bg-primary text-[#4A342A] rounded-lg hover:opacity-90 transition-opacity"
        >
          Log out
        </button>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-8">
        {/* Linked children */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Linked children</h2>
          {loading ? (
            <p className="text-foreground/60">Loading...</p>
          ) : students.length === 0 ? (
            <p className="text-foreground/60">No children linked yet. Add one below.</p>
          ) : (
            <ul className="space-y-3">
              {students.map((s) => (
                <li
                  key={s.id}
                  className="bg-card border border-border rounded-lg p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="font-medium">{s.full_name}</div>
                    <div className="text-sm text-foreground/60">
                      {s.grade_level}
                      {s.student_number ? ` · ${s.student_number}` : ""}
                    </div>
                  </div>
                  <button
                    onClick={() => requestCodeGen(s.id)}
                    disabled={requestingId === s.id}
                    className="text-sm px-3 py-1.5 border border-border rounded-lg hover:bg-background transition-colors disabled:opacity-50"
                  >
                    {requestingId === s.id ? "Sending..." : "Request code"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Add child */}
        <section className="bg-card border border-border rounded-lg p-6 card-elevated relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 gradient-primary"></div>
          <h2 className="text-lg font-semibold mb-4">Add another child</h2>
          <form className="space-y-4" onSubmit={addChild}>
            <div>
              <label htmlFor="studentNameOrId" className="block text-sm font-medium mb-1.5">
                Student Name or Student ID
              </label>
              <input
                id="studentNameOrId"
                type="text"
                required
                value={form.studentNameOrId}
                onChange={(e) => setForm({ ...form, studentNameOrId: e.target.value })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Jane Doe or S002"
              />
            </div>
            <div>
              <label htmlFor="studentCode" className="block text-sm font-medium mb-1.5">
                Student Code
              </label>
              <input
                id="studentCode"
                type="text"
                required
                value={form.studentCode}
                onChange={(e) => setForm({ ...form, studentCode: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. TESTCODE"
              />
            </div>
            <button
              type="submit"
              disabled={adding}
              className="w-full py-2.5 px-4 bg-primary text-[#4A342A] font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {adding ? "Verifying..." : "Add Child"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
