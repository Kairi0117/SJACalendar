import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionFromToken, SESSION_COOKIE } from "@/lib/auth";

async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function GET(_req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: requests } = await supabaseAdmin
    .from("code_requests")
    .select("id, parent_email, student_id, status, created_at")
    .order("created_at", { ascending: false });

  const studentIds = Array.from(new Set((requests ?? []).map((r) => r.student_id).filter(Boolean)));
  const { data: students } = studentIds.length
    ? await supabaseAdmin.from("students").select("id, full_name, grade_level").in("id", studentIds)
    : { data: [] };

  const studentById = new Map((students ?? []).map((s) => [s.id, s]));
  const result = (requests ?? []).map((r) => ({
    ...r,
    student: r.student_id ? studentById.get(r.student_id) ?? null : null,
  }));

  return NextResponse.json({ requests: result });
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const id = String(body.id ?? "");
    const status = String(body.status ?? "done");
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

    const { error: updErr } = await supabaseAdmin
      .from("code_requests")
      .update({ status })
      .eq("id", id);
    if (updErr) return NextResponse.json({ error: "Could not update request." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
