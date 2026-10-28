import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { reminderTypesForToday, sendEventNotifications } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  // Protect with CRON_SECRET
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: events } = await supabaseAdmin
      .from("events")
      .select("id, event_date");

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
    return NextResponse.json({ error: "Cron failed." }, { status: 500 });
  }
}
