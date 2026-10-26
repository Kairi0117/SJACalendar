import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { verifySecret } from "@/lib/auth";
import { findStudent } from "@/lib/students";

const GENERIC_ERROR = "Verification failed. Please check your details.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.parentEmail ?? "").trim().toLowerCase();
    const studentNameOrId = String(body.studentNameOrId ?? "").trim();
    const code = String(body.code ?? "").trim();

    if (!email || !studentNameOrId || !code) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Re-verify parent + student + link
    const { data: parent } = await supabaseAdmin
      .from("parents")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    const student = await findStudent(studentNameOrId);

    if (!parent || !student) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    const { data: link } = await supabaseAdmin
      .from("parent_students")
      .select("parent_id")
      .eq("parent_id", parent.id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (!link) {
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
    }

    // Find valid verification code
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

    await supabaseAdmin.from("email_verifications").update({ used: true }).eq("id", valid.id);

    // Log a code request for admin approval
    await supabaseAdmin.from("code_requests").insert({
      parent_email: email,
      student_id: student.id,
      status: "open",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
