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

  const { data: logs } = await supabaseAdmin
    .from("notification_logs")
    .select("id, event_id, parent_id, type, sent_at, status")
    .order("sent_at", { ascending: false })
    .limit(200);

  const eventIds = Array.from(new Set((logs ?? []).map((l) => l.event_id)));
  const parentIds = Array.from(new Set((logs ?? []).map((l) => l.parent_id)));

  const { data: events } = eventIds.length
    ? await supabaseAdmin.from("events").select("id, title").in("id", eventIds)
    : { data: [] };
  const { data: parents } = parentIds.length
    ? await supabaseAdmin.from("parents").select("id, email").in("id", parentIds)
    : { data: [] };

  const eventById = new Map((events ?? []).map((e) => [e.id, e.title]));
  const parentById = new Map((parents ?? []).map((p) => [p.id, p.email]));

  const result = (logs ?? []).map((l) => ({
    ...l,
    event_title: eventById.get(l.event_id) ?? "Unknown event",
    parent_email: parentById.get(l.parent_id) ?? "Unknown parent",
  }));

  return NextResponse.json({ logs: result });
}
