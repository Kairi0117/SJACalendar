import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabase/server";

export const SESSION_COOKIE = "sdc_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Rate limiting: this many failed attempts before a temporary lockout.
export const MAX_ATTEMPTS = 3;

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Client IP, for rate limiting.
//
// Never key a limit on the whole x-forwarded-for header: a client can send its
// own value and the proxy appends the real address to the end, so the rightmost
// entry is the one written by the closest trusted proxy. Keying on the raw
// header let anyone reset their attempt counter by sending a new value per
// request.
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  // Direct connection with no proxy in front (local development).
  return "local";
}

export async function hashSecret(value: string): Promise<string> {
  return bcrypt.hash(value, 10);
}

export async function verifySecret(value: string, hash: string): Promise<boolean> {
  return bcrypt.compare(value, hash);
}

export function generateStudentCode(): string {
  // Uppercase letters + digits, excluding confusing chars (O, 0, I, 1)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export function generateVerificationCode(): string {
  // 6-digit number
  const n = crypto.randomInt(0, 1000000);
  return n.toString().padStart(6, "0");
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Normalize student code input (uppercase, trim)
export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

// Rate limiting. Pass one or more identifiers; the caller is locked out if any
// of them has tripped. Identifiers should be values the attacker cannot change
// (a trusted client IP, or the account email).
export async function checkRateLimit(
  ...identifiers: string[]
): Promise<{ locked: boolean; remaining: number }> {
  for (const identifier of identifiers) {
    const { data } = await supabaseAdmin
      .from("login_attempts")
      .select("attempt_count, locked_until")
      .eq("identifier", identifier)
      .maybeSingle();

    if (!data) continue;

    if (data.locked_until) {
      if (new Date(data.locked_until) > new Date()) {
        return { locked: true, remaining: 0 };
      }
      // Lockout expired: the next failure starts a fresh window.
      return { locked: false, remaining: MAX_ATTEMPTS };
    }

    const remaining = Math.max(0, MAX_ATTEMPTS - (data.attempt_count ?? 0));
    if (remaining === 0) return { locked: false, remaining: 0 };
  }

  return { locked: false, remaining: MAX_ATTEMPTS };
}

export async function recordFailedAttempt(...identifiers: string[]): Promise<void> {
  for (const identifier of identifiers) {
    const { error } = await supabaseAdmin.rpc("record_login_attempt", {
      p_identifier: identifier,
      p_max_attempts: MAX_ATTEMPTS,
    });
    if (error) {
      // Do not log the identifier: it may contain an email address.
      console.error("record_login_attempt failed:", error.message);
    }
  }
}

export async function clearAttempts(...identifiers: string[]): Promise<void> {
  for (const identifier of identifiers) {
    const { error } = await supabaseAdmin.rpc("clear_login_attempts", {
      p_identifier: identifier,
    });
    if (error) {
      console.error("clear_login_attempts failed:", error.message);
      // Fall back to a direct delete so a missing function cannot wedge login.
      await supabaseAdmin.from("login_attempts").delete().eq("identifier", identifier);
    }
  }
}

export async function createSession(
  role: "parent" | "admin",
  userId: string,
  cookieSetter: (name: string, value: string, options: Record<string, unknown>) => void
): Promise<void> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();

  const row: Record<string, unknown> = {
    token_hash: tokenHash,
    role,
    expires_at: expiresAt,
  };
  if (role === "parent") row.parent_id = userId;
  else row.admin_id = userId;

  await supabaseAdmin.from("sessions").insert(row);

  cookieSetter(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSessionFromToken(token: string | undefined): Promise<{
  role: "parent" | "admin";
  userId: string;
} | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const { data } = await supabaseAdmin
    .from("sessions")
    .select("role, parent_id, admin_id, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  const userId = data.role === "parent" ? data.parent_id : data.admin_id;
  if (!userId) return null;
  return { role: data.role, userId };
}
