import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: events } = await supabaseAdmin
      .from("events")
      .select("id, title, event_date, all_grades")
      .eq("all_grades", true)
      .gte("event_date", today)
      .order("event_date", { ascending: true })
      .limit(5);

    const result = (events ?? []).map((e) => {
      const d = new Date(e.event_date + "T00:00:00");
      return {
        id: e.id,
        title: e.title,
        month: d.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
        day: d.getDate(),
        scope: "All grades",
      };
    });

    return NextResponse.json({ events: result });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ events: [] });
  }
}
