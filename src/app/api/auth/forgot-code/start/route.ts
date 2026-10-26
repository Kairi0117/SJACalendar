import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { hashSecret, generateVerificationCode } from "@/lib/auth";
import { findStudent } from "@/lib/students";
import { sendEmail, verificationEmailHtml } from "@/lib/mailer";

const GENERIC_ERROR = "We could not verify your details. Please check and try again.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.parentEmail ?? "").trim().toLowerCase();
    const studentNameOrId = String(body.studentNameOrId ?? "").trim();

    if (!email || !studentNameOrId) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Find parent by email
    const { data: parent } = await supabaseAdmin
      .from("parents")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!parent) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Find student
    const student = await findStudent(studentNameOrId);
    if (!student) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Verify link exists
    const { data: link } = await supabaseAdmin
      .from("parent_students")
      .select("parent_id")
      .eq("parent_id", parent.id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (!link) {
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

    const code = generateVerificationCode();
    const codeHash = await hashSecret(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabaseAdmin.from("email_verifications").insert({
      email,
      code_hash: codeHash,
      expires_at: expiresAt,
      used: false,
    });

    await sendEmail(email, "Your verification code", verificationEmailHtml(code));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
