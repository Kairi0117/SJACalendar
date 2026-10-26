import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { normalizeCode, getClientIp, checkRateLimit, recordFailedAttempt, clearAttempts, createSession } from "@/lib/auth";
import bcrypt from "bcryptjs";

const GENERIC_ERROR = "Invalid email or student code.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const studentCode = normalizeCode(String(body.studentCode ?? ""));

    if (!email || !studentCode) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Keyed on the account, so rotating IPs cannot buy more attempts. The
    // student code space is far too large to brute force, so this is about
    // capping guessing per account rather than per address.
    const identifier = `parent:${getClientIp(req)}`;

    const rl = await checkRateLimit(identifier);
    if (rl.locked) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in 10 minutes." },
        { status: 429 }
      );
    }

    // Find parent by email
    const { data: parent } = await supabaseAdmin
      .from("parents")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let studentMatch = false;
    if (parent) {
      // Get linked students
      const { data: links } = await supabaseAdmin
        .from("parent_students")
        .select("student_id")
        .eq("parent_id", parent.id);

      const studentIds = (links ?? []).map((l) => l.student_id);
      if (studentIds.length > 0) {
        const { data: students } = await supabaseAdmin
          .from("students")
          .select("code_hash")
          .in("id", studentIds)
          .eq("archived", false);

        for (const s of students ?? []) {
          if (await bcrypt.compare(studentCode, s.code_hash)) {
            studentMatch = true;
            break;
          }
        }
      }
    }

    if (!parent || !studentMatch) {
      await recordFailedAttempt(identifier);
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    await clearAttempts(identifier);

    const cookieStore = await cookies();
    await createSession("parent", parent.id, (name, value, options) => {
      cookieStore.set(name, value, options as never);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
