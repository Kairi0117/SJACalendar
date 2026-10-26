import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit, recordFailedAttempt, clearAttempts, createSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

const GENERIC_ERROR = "Invalid email or password.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!email || !password) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Keyed on the account rather than the client IP: an admin password is
    // brute-forceable, so the attempt budget must not grow when the attacker
    // rotates addresses. Trade-off: a caller can lock an admin out for 10
    // minutes by failing 3 times.
    const identifier = `admin:${email}`;
    const rl = await checkRateLimit(identifier);
    if (rl.locked) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in 10 minutes." },
        { status: 429 }
      );
    }

    const { data: admin } = await supabaseAdmin
      .from("admins")
      .select("id, password_hash")
      .eq("email", email)
      .maybeSingle();

    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      await recordFailedAttempt(identifier);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    await clearAttempts(identifier);

    const cookieStore = await cookies();
    await createSession("admin", admin.id, (name, value, options) => {
      cookieStore.set(name, value, options as never);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
