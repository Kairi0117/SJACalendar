import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionFromToken, SESSION_COOKIE } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session || session.role !== "parent") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Linked grade levels
  const { data: links } = await supabaseAdmin
    .from("parent_students")
    .select("student_id")
    .eq("parent_id", session.userId);

  const studentIds = (links ?? []).map((l) => l.student_id);
  let gradeLevels: string[] = [];
  if (studentIds.length > 0) {
    const { data: students } = await supabaseAdmin
      .from("students")
      .select("grade_level")
      .in("id", studentIds)
      .eq("archived", false);
    gradeLevels = Array.from(new Set((students ?? []).map((s) => s.grade_level)));
  }

  // All events
  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id, title, description, event_date, start_time, end_time, location, all_grades, created_at")
    .order("event_date", { ascending: true });

  const eventIds = (events ?? []).map((e) => e.id);
  const { data: grades } = eventIds.length
    ? await supabaseAdmin.from("event_grades").select("event_id, grade_level").in("event_id", eventIds)
    : { data: [] };

  const gradesByEvent = new Map<string, string[]>();
  for (const g of grades ?? []) {
    if (!gradesByEvent.has(g.event_id)) gradesByEvent.set(g.event_id, []);
    gradesByEvent.get(g.event_id)!.push(g.grade_level);
  }

  // Filter to events relevant to parent's grade levels (or all_grades)
  const filtered = (events ?? []).filter((e) => {
    if (e.all_grades) return true;
    const eg = gradesByEvent.get(e.id) ?? [];
    return eg.some((g) => gradeLevels.includes(g));
  });

  const result = filtered.map((e) => {
    const eg = gradesByEvent.get(e.id) ?? [];
    const relatedGrades = e.all_grades ? ["All grades"] : eg.filter((g) => gradeLevels.includes(g));
    return { ...e, grade_levels: eg, related_grades: relatedGrades };
  });

  return NextResponse.json({ events: result, gradeLevels });
}
