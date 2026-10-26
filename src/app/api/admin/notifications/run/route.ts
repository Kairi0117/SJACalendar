import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getSessionFromToken, SESSION_COOKIE } from "@/lib/auth";
import { reminderTypesForToday, sendEventNotifications } from "@/lib/notifications";

async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function POST(_req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data: events } = await supabaseAdmin.from("events").select("id, event_date");
    let totalSent = 0;
    const details: { eventId: string; type: string; sent: number }[] = [];

    for (const ev of events ?? []) {
      const types = reminderTypesForToday(ev.event_date);
      for (const t of types) {
        const r = await sendEventNotifications(ev.id, t);
        totalSent += r.sent;
        details.push({ eventId: ev.id, type: t, sent: r.sent });
      }
    }

    return NextResponse.json({ ok: true, totalSent, details });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Run failed." }, { status: 500 });
  }
}
