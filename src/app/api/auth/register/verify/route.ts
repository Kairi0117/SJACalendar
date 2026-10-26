import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findStudent } from "@/lib/students";
import { verifySecret, createSession, clearAttempts } from "@/lib/auth";
import bcrypt from "bcryptjs";

const GENERIC_ERROR = "Registration failed. Please check your details.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const firstName = String(body.firstName ?? "").trim();
    const middleName = String(body.middleName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.parentEmail ?? "").trim().toLowerCase();
    const studentNameOrId = String(body.studentNameOrId ?? "").trim();
    const studentCode = String(body.studentCode ?? "").trim().toUpperCase();
    const code = String(body.code ?? "").trim();

    if (!firstName || !lastName || !email || !studentNameOrId || !studentCode || !code) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Re-verify student
    const student = await findStudent(studentNameOrId);
    if (!student) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }
    const codeOk = await bcrypt.compare(studentCode, student.code_hash);
    if (!codeOk) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Find latest unused, unexpired verification code for this email
    const { data: verifications } = await supabaseAdmin
      .from("email_verifications")
      .select("id, code_hash, expires_at, used")
      .eq("email", email)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(5);

    const now = new Date();
    const valid = verifications?.find((v) => new Date(v.expires_at) > now);
    if (!valid) {
      return NextResponse.json({ error: "Verification code expired or not found." }, { status: 400 });
    }

    const codeMatch = await verifySecret(code, valid.code_hash);
    if (!codeMatch) {
      return NextResponse.json({ error: "Invalid verification code." }, { status: 400 });
    }

    // Mark code used
    await supabaseAdmin.from("email_verifications").update({ used: true }).eq("id", valid.id);

    // Check if parent already exists
    const { data: existing } = await supabaseAdmin
      .from("parents")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let parentId: string;
    if (existing) {
      parentId = existing.id;
      // update name
      await supabaseAdmin
        .from("parents")
        .update({ first_name: firstName, middle_name: middleName || null, last_name: lastName })
        .eq("id", parentId);
    } else {
      const { data: inserted, error: insErr } = await supabaseAdmin
        .from("parents")
        .insert({ first_name: firstName, middle_name: middleName || null, last_name: lastName, email })
        .select("id")
        .single();
      if (insErr || !inserted) {
        return NextResponse.json({ error: "Could not create account." }, { status: 500 });
      }
      parentId = inserted.id;
    }

    // Link parent to student (ignore duplicate)
    await supabaseAdmin
      .from("parent_students")
      .upsert({ parent_id: parentId, student_id: student.id }, { onConflict: "parent_id,student_id" });

    await clearAttempts(`register:${email}`);

    // Create session
    const cookieStore = await cookies();
    await createSession("parent", parentId, (name, value, options) => {
      cookieStore.set(name, value, options as never);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
