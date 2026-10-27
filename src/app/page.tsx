"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTheme } from "@/lib/useTheme";

export default function Home() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; studentCode?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [upcoming, setUpcoming] = useState<{ id: string; title: string; month: string; day: number; scope: string }[]>([]);

  const { darkMode, toggleTheme } = useTheme();

  useEffect(() => {
    fetch("/api/public/upcoming")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setUpcoming(d.events ?? []))
      .catch(() => setUpcoming([]));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};

    if (!email.trim()) {
      nextErrors.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!studentCode.trim()) {
      nextErrors.studentCode = "Please enter your student code.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), studentCode: studentCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed.");
      } else {
        router.push("/calendar");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClasses =
    "w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Information */}
      <div
        className="hidden lg:flex lg:w-[60%] relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #B2967D 0%, #4A342A 100%)" }}
      >
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        ></div>
        {/* Contrast overlay */}
        <div className="absolute inset-0 bg-black/25"></div>

        <div className="relative z-10 flex flex-col justify-center h-full px-10 xl:px-14 py-12 text-white gap-10">
          {/* Brand block */}
          <div>
            <div className="flex items-center gap-4 mb-4">
              {/* School crest / logo mark */}
              <svg
                className="w-12 h-12 shrink-0"
                viewBox="0 0 48 48"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M24 3 L42 10 V24 C42 35 34 42 24 45 C14 42 6 35 6 24 V10 Z"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  fill="rgba(255,255,255,0.12)"
                />
                <rect x="14" y="18" width="20" height="17" rx="2" stroke="#ffffff" strokeWidth="2" />
                <line x1="14" y1="24" x2="34" y2="24" stroke="#ffffff" strokeWidth="2" />
                <line x1="20" y1="15" x2="20" y2="21" stroke="#ffffff" strokeWidth="2" />
                <line x1="28" y1="15" x2="28" y2="21" stroke="#ffffff" strokeWidth="2" />
              </svg>
              <h1 className="text-3xl xl:text-4xl font-bold leading-tight">
                SJA Digital Calendar
              </h1>
            </div>
            <p className="text-lg xl:text-xl font-light opacity-85">
              Connecting home and school, one date at a time.
            </p>
          </div>

          {/* Mock upcoming events preview */}
          <div className="bg-black/30 backdrop-blur-sm rounded-xl p-5 max-w-md">
            <h2 className="text-sm font-semibold uppercase tracking-wider opacity-80 mb-4">
              Upcoming this month
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm opacity-75 py-2">No upcoming school-wide events right now.</p>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((event) => (
                  <li key={event.id} className="flex items-center gap-4">
                    <div className="w-12 shrink-0 text-center bg-white/15 rounded-lg py-1">
                      <div className="text-[10px] font-semibold tracking-wider">{event.month}</div>
                      <div className="text-lg font-bold leading-tight">{event.day}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{event.title}</div>
                      <div className="text-xs opacity-75">{event.scope}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Feature cards - one line each */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4">
              <h2 className="text-base font-semibold mb-1 flex items-center">
                <svg
                  className="w-5 h-5 mr-2 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                For Parents
              </h2>
              <p className="text-sm leading-relaxed opacity-90">
                See events for your child&apos;s grade level.
              </p>
            </div>

            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4">
              <h2 className="text-base font-semibold mb-1 flex items-center">
                <svg
                  className="w-5 h-5 mr-2 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                Reminders
              </h2>
              <p className="text-sm leading-relaxed opacity-90">
                Get email reminders before every event.
              </p>
            </div>

            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-4">
              <h2 className="text-base font-semibold mb-1 flex items-center">
                <svg
                  className="w-5 h-5 mr-2 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Secure Access
              </h2>
              <p className="text-sm leading-relaxed opacity-90">
                Password-free login with unique student codes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-[40%] min-w-[320px] bg-background flex flex-col">
        <div className="flex justify-between items-center p-6">
          <div className="lg:hidden flex items-center gap-3">
            <svg className="w-8 h-8 shrink-0" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <path
                d="M24 3 L42 10 V24 C42 35 34 42 24 45 C14 42 6 35 6 24 V10 Z"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-primary"
                fill="transparent"
              />
              <rect
                x="14"
                y="18"
                width="20"
                height="17"
                rx="2"
                stroke="currentColor"
                strokeWidth="2"
                className="text-foreground"
              />
              <line x1="14" y1="24" x2="34" y2="24" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <line x1="20" y1="15" x2="20" y2="21" stroke="currentColor" strokeWidth="2" className="text-foreground" />
              <line x1="28" y1="15" x2="28" y2="21" stroke="currentColor" strokeWidth="2" className="text-foreground" />
            </svg>
            <h1 className="text-xl font-bold text-foreground">SJA Digital Calendar</h1>
          </div>
          <button
            onClick={toggleTheme}
            className="ml-auto p-2 rounded-lg bg-card border border-border hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
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
              <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">
            {/* Heading tight against the card */}
            <div className="text-center mb-4">
              <h2 className="text-3xl font-bold text-foreground mb-1">Parent Login</h2>
              <p className="text-[15px] text-foreground/70">
                Sign in to view your children&apos;s events
              </p>
            </div>

            <div className="bg-card rounded-xl shadow-lg border border-border px-4 py-6 sm:p-7 card-elevated relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 gradient-primary"></div>

              <form className="space-y-5" onSubmit={handleLogin} noValidate>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                    Parent Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={errors.email ? "true" : "false"}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    className={`${inputClasses} ${errors.email ? "border-secondary focus:ring-secondary" : ""}`}
                    placeholder="you@example.com"
                  />
                  {errors.email && (
                    <p id="email-error" className="mt-1.5 text-[13px] text-secondary" role="alert">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="studentCode" className="block text-sm font-medium text-foreground mb-1.5">
                    Student Code <span className="font-normal text-foreground/60">(used as your password)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="studentCode"
                      name="studentCode"
                      type={showCode ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={studentCode}
                      onChange={(e) => setStudentCode(e.target.value)}
                      aria-invalid={errors.studentCode ? "true" : "false"}
                      aria-describedby={errors.studentCode ? "code-error" : "code-help"}
                      className={`${inputClasses} pr-12 ${errors.studentCode ? "border-secondary focus:ring-secondary" : ""}`}
                      placeholder="e.g. AH265M"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-foreground/60 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                      aria-label={showCode ? "Hide student code" : "Show student code"}
                    >
                      {showCode ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
                          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      )}
                    </button>
                  </div>
                  <p id="code-help" className="mt-1.5 text-[13px] text-foreground/60">
                    Your school-issued student code signs you in — no separate password needed.
                  </p>
                  {errors.studentCode && (
                    <p id="code-error" className="mt-1.5 text-[13px] text-secondary" role="alert">
                      {errors.studentCode}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-primary hover:opacity-90 text-[#4A342A] font-semibold rounded-lg transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                  )}
                  {loading ? "Signing in..." : "Log In"}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-border space-y-4">
                <div className="text-center">
                  <Link
                    href="/forgot-code"
                    className="inline-flex items-center justify-center min-h-11 text-[14px] text-foreground/70 underline underline-offset-4 hover:text-foreground transition-colors"
                  >
                    Forgot your code?
                  </Link>
                </div>

                <Link
                  href="/register"
                  className="flex items-center justify-center min-h-11 w-full py-2.5 px-4 border border-border text-foreground text-sm font-medium text-center rounded-lg hover:bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  Create a parent account
                </Link>

                <div className="text-center pt-1">
                  <Link
                    href="/admin/login"
                    className="inline-flex items-center justify-center min-h-11 text-[11px] text-foreground/40 hover:text-foreground/70 transition-colors"
                  >
                    Staff login
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
