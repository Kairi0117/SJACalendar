import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromToken, SESSION_COOKIE } from "@/lib/auth";
import { previewRecipients, sendEventNotifications } from "@/lib/notifications";

async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session || session.role !== "admin") return null;
  return session;
}

// How many parents this event would reach, and on what basis.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const preview = await previewRecipients(id);
  if (!preview) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  return NextResponse.json(preview);
}

// Email the event to every matching parent.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const preview = await previewRecipients(id);
    if (!preview) return NextResponse.json({ error: "Event not found." }, { status: 404 });

    // dedupe: false — this is an explicit admin action, so it must not be
    // silently swallowed by the cron's duplicate protection.
    const r = await sendEventNotifications(id, "manual", { dedupe: false });
    return NextResponse.json({ ok: true, total: r.total, sent: r.sent, failed: r.failed });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not send notifications." }, { status: 500 });
  }
}
