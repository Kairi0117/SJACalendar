import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionFromToken, SESSION_COOKIE, generateStudentCode, hashSecret } from "@/lib/auth";
import { sendEmail, newStudentCodeEmailHtml } from "@/lib/mailer";

async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const action = body.action;

    if (action === "restore") {
      const { error: updErr } = await supabaseAdmin
        .from("students")
        .update({ archived: false, archived_at: null })
        .eq("id", id);
      if (updErr) return NextResponse.json({ error: "Could not restore." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === "reset_code") {
      const code = generateStudentCode();
      const codeHash = await hashSecret(code);
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("full_name")
        .eq("id", id)
        .maybeSingle();
      const { error: updErr } = await supabaseAdmin
        .from("students")
        .update({ code_hash: codeHash, code_created_at: new Date().toISOString() })
        .eq("id", id);
      if (updErr) {
        return NextResponse.json({ error: "Could not reset code." }, { status: 500 });
      }

      const notifyEmail = body.notify_email ? String(body.notify_email).trim() : null;
      let emailed = false;
      let emailError: string | null = null;
      if (notifyEmail) {
        try {
          await sendEmail(notifyEmail, "Your new student code", newStudentCodeEmailHtml(code, student?.full_name ?? "your child"));
          emailed = true;
        } catch (err) {
          console.error("Failed to email new code:", err);
          emailError = err instanceof Error ? err.message : String(err);
        }
      } else {
        emailError = "No notify_email provided.";
      }

      return NextResponse.json({ ok: true, code, emailed, emailError, notifyEmail });
    }

    // update fields
    const updates: Record<string, unknown> = {};
    if (body.full_name) updates.full_name = String(body.full_name).trim();
    if (body.student_number !== undefined) updates.student_number = body.student_number ? String(body.student_number).trim() : null;
    if (body.grade_level) updates.grade_level = String(body.grade_level).trim();

    const { error: updErr } = await supabaseAdmin.from("students").update(updates).eq("id", id);
    if (updErr) {
      return NextResponse.json({ error: "Could not update student." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const permanent = req.nextUrl.searchParams.get("permanent") === "true";

  if (permanent) {
    const { error: delErr } = await supabaseAdmin.from("students").delete().eq("id", id);
    if (delErr) {
      return NextResponse.json({ error: "Could not permanently delete student." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, permanent: true });
  }

  const { error: updErr } = await supabaseAdmin
    .from("students")
    .update({ archived: true, archived_at: new Date().toISOString() })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: "Could not archive student." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
