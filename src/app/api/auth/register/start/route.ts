import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { findStudent } from "@/lib/students";
import { hashSecret, generateVerificationCode } from "@/lib/auth";
import { sendEmailSafe, verificationEmailHtml } from "@/lib/mailer";

const GENERIC_ERROR = "Student verification failed. Please check your details.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // This step only verifies the student and emails a code. The account,
    // including the middle name, is created by the verify step.
    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.parentEmail ?? "").trim().toLowerCase();
    const studentNameOrId = String(body.studentNameOrId ?? "").trim();
    const studentCode = String(body.studentCode ?? "").trim().toUpperCase();

    if (!firstName || !lastName || !email || !studentNameOrId || !studentCode) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const student = await findStudent(studentNameOrId);
    if (!student) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const codeOk = await (async () => {
      const bcrypt = await import("bcryptjs");
      return bcrypt.compare(studentCode, student.code_hash);
    })();
    if (!codeOk) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Rate limit: one code request per minute per email
    const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("email_verifications")
      .select("id")
      .eq("email", email)
      .gte("created_at", oneMinAgo)
      .limit(1);

    if (recent && recent.length > 0) {
      return NextResponse.json(
        { error: "Please wait 1 minute before requesting another code." },
        { status: 429 }
      );
    }

    // Generate and store verification code
    const code = generateVerificationCode();
    const codeHash = await hashSecret(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabaseAdmin.from("email_verifications").insert({
      email,
      code_hash: codeHash,
      expires_at: expiresAt,
      used: false,
    });

    // Store pending registration data? We'll re-verify student on verify step by re-checking.
    // For simplicity, store student_id in a temp way via the email verification row isn't possible.
    // Instead, verify step re-checks student by re-submitting student details.
    // We'll pass studentId back to client to include in verify step.
    const mailResult = await sendEmailSafe(
      email,
      "Your registration code",
      verificationEmailHtml(code)
    );
    // A mail failure is not fatal: the verification code is stored and
    // the parent can request a resend. Surface the error so the UI can warn
    // without breaking the registration flow entirely.
    return NextResponse.json({
      ok: true,
      studentId: student.id,
      emailSent: mailResult.ok,
      emailError: mailResult.ok ? undefined : mailResult.error,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
