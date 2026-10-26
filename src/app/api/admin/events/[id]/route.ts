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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const title = String(body.title ?? "").trim();
    const description = body.description ? String(body.description).trim() : null;
    const eventDate = String(body.event_date ?? "").trim();
    const startTime = body.start_time ? String(body.start_time).trim() : null;
    const endTime = body.end_time ? String(body.end_time).trim() : null;
    const location = body.location ? String(body.location).trim() : null;
    const allGrades = Boolean(body.all_grades);
    const gradeLevels: string[] = Array.isArray(body.grade_levels) ? body.grade_levels : [];

    if (!title || !eventDate) {
      return NextResponse.json({ error: "Title and date are required." }, { status: 400 });
    }

    const { error: updErr } = await supabaseAdmin
      .from("events")
      .update({
        title,
        description,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        location,
        all_grades: allGrades,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updErr) {
      return NextResponse.json({ error: "Could not update event." }, { status: 500 });
    }

    // Replace grade levels
    await supabaseAdmin.from("event_grades").delete().eq("event_id", id);
    if (!allGrades && gradeLevels.length > 0) {
      await supabaseAdmin
        .from("event_grades")
        .insert(gradeLevels.map((g) => ({ event_id: id, grade_level: g })));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error: delErr } = await supabaseAdmin.from("events").delete().eq("id", id);
  if (delErr) {
    return NextResponse.json({ error: "Could not delete event." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
