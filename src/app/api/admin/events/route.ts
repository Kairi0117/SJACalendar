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

  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, title, description, event_date, start_time, end_time, location, all_grades, created_at")
    .order("event_date", { ascending: true });

  const ids = (events ?? []).map((e) => e.id);
  const { data: grades } = ids.length
    ? await supabaseAdmin.from("event_grades").select("event_id, grade_level").in("event_id", ids)
    : { data: [] };

  const gradesByEvent = new Map<string, string[]>();
  for (const g of grades ?? []) {
    if (!gradesByEvent.has(g.event_id)) gradesByEvent.set(g.event_id, []);
    gradesByEvent.get(g.event_id)!.push(g.grade_level);
  }

  const result = (events ?? []).map((e) => ({
    ...e,
    grade_levels: gradesByEvent.get(e.id) ?? [],
  }));

  return NextResponse.json({ events: result });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("events")
      .insert({
        title,
        description,
        event_date: eventDate,
        start_time: startTime,
        end_time: endTime,
        location,
        all_grades: allGrades,
        created_by: session.userId,
      })
      .select("id")
      .single();

    if (insErr || !inserted) {
      return NextResponse.json({ error: "Could not create event." }, { status: 500 });
    }

    if (!allGrades && gradeLevels.length > 0) {
      await supabaseAdmin
        .from("event_grades")
        .insert(gradeLevels.map((g) => ({ event_id: inserted.id, grade_level: g })));
    }

    // Send "posted" notifications (fire and forget, but await to catch errors)
    try {
      const { sendEventNotifications } = await import("@/lib/notifications");
      await sendEventNotifications(inserted.id, "posted");
    } catch (err) {
      console.error("Posted notification failed:", err);
    }

    return NextResponse.json({ ok: true, id: inserted.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
