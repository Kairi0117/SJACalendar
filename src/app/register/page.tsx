"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    parentEmail: "",
    studentNameOrId: "",
    studentCode: ""
  });
  const [step, setStep] = useState(1); // 1: registration form, 2: email verification
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // Count down the resend cooldown.
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Registration failed.");
      } else {
        setStep(2);
        // If the email didn't send, warn the parent but still let them
        // enter the code (admin can re-send via the resend flow).
        if (data.emailSent === false) {
          toast.warning("We couldn't send your email code. Check SMTP settings and try resending, or ask your school admin to check the server logs.");
        }
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      const res = await fetch("/api/auth/register/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not resend the code.");
        return;
      }
      setResendTimer(60);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setResending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, code: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Verification failed.");
      } else {
        router.push("/calendar");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="text-center text-3xl font-bold text-foreground">
          SJA Digital Calendar
        </h1>
        <h2 className="mt-6 text-center text-xl font-semibold text-foreground/80">
          Parent Registration
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow sm:rounded-lg sm:px-10 card-elevated relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 gradient-primary"></div>
          {step === 1 ? (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-foreground/80">
                    First Name
                  </label>
                  <div className="mt-1">
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="appearance-none block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder:text-foreground/40 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                      placeholder="First"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="middleName" className="block text-sm font-medium text-foreground/80">
                    Middle Name
                  </label>
                  <div className="mt-1">
                    <input
                      id="middleName"
                      name="middleName"
                      type="text"
                      value={formData.middleName}
                      onChange={handleInputChange}
                      className="appearance-none block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder:text-foreground/40 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-foreground/80">
                    Last Name
                  </label>
                  <div className="mt-1">
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="appearance-none block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder:text-foreground/40 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                      placeholder="Last"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="parentEmail" className="block text-sm font-medium text-foreground/80">
                  Parent Email
                </label>
                <div className="mt-1">
                  <input
                    id="parentEmail"
                    name="parentEmail"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.parentEmail}
                    onChange={handleInputChange}
                    className="appearance-none block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder:text-foreground/40 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="studentNameOrId" className="block text-sm font-medium text-foreground/80">
                  Student Name or Student ID
                </label>
                <div className="mt-1">
                  <input
                    id="studentNameOrId"
                    name="studentNameOrId"
                    type="text"
                    required
                    value={formData.studentNameOrId}
                    onChange={handleInputChange}
                    className="appearance-none block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder:text-foreground/40 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="studentCode" className="block text-sm font-medium text-foreground/80">
                  Student Code
                </label>
                <div className="mt-1">
                  <input
                    id="studentCode"
                    name="studentCode"
                    type="text"
                    required
                    value={formData.studentCode}
                    onChange={handleInputChange}
                    className="appearance-none block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder:text-foreground/40 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  />
                </div>
              </div>



              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify Student & Send Code"}
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-6" onSubmit={handleVerify}>
              <div>
                <p className="text-sm text-foreground/70 mb-4">
                  A 6-digit verification code has been sent to <strong>{formData.parentEmail}</strong>
                </p>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-foreground/80">
                  Verification Code
                </label>
                <div className="mt-1">
                  <input
                    id="verificationCode"
                    name="verificationCode"
                    type="text"
                    required
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder:text-foreground/40 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm text-center text-lg tracking-widest"
                    placeholder="123456"
                  />
                </div>
              </div>



              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Complete Registration"}
                </button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={resend}
                  disabled={resendTimer > 0 || resending}
                  className="text-sm text-primary hover:opacity-80 disabled:text-foreground/40"
                >
                  {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Code"}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6">
            <div className="text-center">
              <Link href="/" className="inline-flex items-center min-h-11 font-medium text-primary hover:opacity-80">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
