"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export default function ForgotCode() {
  const [step, setStep] = useState(1); // 1: details, 2: verify code, 3: done
  const [email, setEmail] = useState("");
  const [studentNameOrId, setStudentNameOrId] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!studentNameOrId.trim()) {
      toast.error("Please enter the student name or ID.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-code/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentEmail: email.trim(), studentNameOrId: studentNameOrId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not verify details.");
      } else {
        setStep(2);
        toast.success("A verification code has been sent to your email.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      toast.error("Please enter the verification code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-code/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentEmail: email.trim(),
          studentNameOrId: studentNameOrId.trim(),
          code: verificationCode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Verification failed.");
      } else {
        setStep(3);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-code/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentEmail: email.trim(), studentNameOrId: studentNameOrId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not resend code.");
        if (res.status === 429) {
          setResendTimer(60);
          const t = setInterval(() => {
            setResendTimer((v) => {
              if (v <= 1) {
                clearInterval(t);
                return 0;
              }
              return v - 1;
            });
          }, 1000);
        }
      } else {
        toast.success("A new verification code has been sent.");
        setResendTimer(60);
        const t = setInterval(() => {
          setResendTimer((v) => {
            if (v <= 1) {
              clearInterval(t);
              return 0;
            }
            return v - 1;
          });
        }, 1000);
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-1">Forgot your code?</h1>
          <p className="text-[15px] text-foreground/70">
            {step === 1 && "Verify your details to request a new student code"}
            {step === 2 && "Enter the verification code sent to your email"}
            {step === 3 && "Request submitted"}
          </p>
        </div>

        <div className="bg-card rounded-xl shadow-lg border border-border p-6 sm:p-7 card-elevated relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 gradient-primary"></div>

          {step === 1 && (
            <form className="space-y-5" onSubmit={handleStart} noValidate>
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
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="studentNameOrId" className="block text-sm font-medium text-foreground mb-1.5">
                  Student Name or Student ID
                </label>
                <input
                  id="studentNameOrId"
                  name="studentNameOrId"
                  type="text"
                  required
                  value={studentNameOrId}
                  onChange={(e) => setStudentNameOrId(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                  placeholder="e.g. John Doe or S001"
                />
                <p className="mt-1.5 text-[13px] text-foreground/60">
                  Must match a student linked to your parent account.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary hover:opacity-90 text-[#4A342A] font-semibold rounded-lg transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : "Send Verification Code"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form className="space-y-5" onSubmit={handleVerify} noValidate>
              <p className="text-sm text-foreground/70">
                A 6-digit code was sent to <strong>{email}</strong>.
              </p>
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-foreground mb-1.5">
                  Verification Code
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary transition-all text-center text-lg tracking-widest"
                  placeholder="123456"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-primary hover:opacity-90 text-[#4A342A] font-semibold rounded-lg transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : "Verify & Submit Request"}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={resend}
                  disabled={resendTimer > 0 || loading}
                  className="text-sm text-primary hover:opacity-80 transition-opacity disabled:text-foreground/40 disabled:cursor-not-allowed"
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M20 6L9 17l-5-5"></path>
                </svg>
              </div>
              <p className="text-[15px] text-foreground leading-relaxed">
                Please wait a moment for the request approval. The code will be sent to your email account, please kindly check it.
              </p>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center min-h-11 text-sm text-foreground/70 underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
