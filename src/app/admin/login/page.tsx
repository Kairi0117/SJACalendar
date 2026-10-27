"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/lib/useTheme";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  const { darkMode, toggleTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: typeof errors = {};

    if (!email.trim()) {
      nextErrors.email = "Please enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Please enter your password.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Login failed.");
      } else {
        router.push("/admin");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClasses =
    "w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-lg bg-card border border-border hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
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

      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6 justify-center">
          <svg className="w-9 h-9 shrink-0" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path
              d="M24 3 L42 10 V24 C42 35 34 42 24 45 C14 42 6 35 6 24 V10 Z"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-secondary"
              fill="transparent"
            />
            <rect x="14" y="18" width="20" height="17" rx="2" stroke="currentColor" strokeWidth="2" className="text-foreground" />
            <line x1="14" y1="24" x2="34" y2="24" stroke="currentColor" strokeWidth="2" className="text-foreground" />
            <line x1="20" y1="15" x2="20" y2="21" stroke="currentColor" strokeWidth="2" className="text-foreground" />
            <line x1="28" y1="15" x2="28" y2="21" stroke="currentColor" strokeWidth="2" className="text-foreground" />
          </svg>
          <span className="text-lg font-semibold text-foreground">SJA Digital Calendar</span>
        </div>

        {/* Heading tight against the card */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold text-foreground mb-1">Staff Login</h1>
          <p className="text-[15px] text-foreground/70">
            Manage events, students and notifications
          </p>
        </div>

        <div className="bg-card rounded-xl shadow-lg border border-border px-4 py-6 sm:p-7 card-elevated relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1" style={{ background: "linear-gradient(135deg, var(--secondary) 0%, var(--primary) 100%)" }}></div>
          <form className="space-y-5" onSubmit={handleLogin} noValidate>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                Staff Email
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
                className={`${inputClasses} ${errors.email ? "border-secondary" : ""}`}
                placeholder="you@school.edu"
              />
              {errors.email && (
                <p id="email-error" className="mt-1.5 text-[13px] text-secondary" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={errors.password ? "true" : "false"}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className={`${inputClasses} pr-12 ${errors.password ? "border-secondary" : ""}`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-foreground/60 hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
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
              {errors.password && (
                <p id="password-error" className="mt-1.5 text-[13px] text-secondary" role="alert">
                  {errors.password}
                </p>
              )}
            </div>



            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-secondary hover:opacity-90 text-white font-semibold rounded-lg transition-opacity focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                </svg>
              )}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center min-h-11 text-sm text-foreground/70 underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Back to Parent Login
          </Link>
        </div>
      </div>
    </div>
  );
}
