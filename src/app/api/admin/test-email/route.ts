import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionFromToken, SESSION_COOKIE } from "@/lib/auth";
import { sendEmail } from "@/lib/mailer";

async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = await getSessionFromToken(token);
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const to = String(body?.to ?? process.env.SMTP_USER ?? "").trim();
    if (!to) return NextResponse.json({ error: "No recipient." }, { status: 400 });

    await sendEmail(
      to,
      "SJA Digital Calendar — test email",
      `<div style="font-family:Arial,sans-serif;padding:24px;color:#4A342A;">
        <h2>SJA Digital Calendar</h2>
        <p>This is a test email. If you received it, SMTP is configured correctly.</p>
      </div>`
    );
    return NextResponse.json({ ok: true, to });
  } catch (err) {
    console.error("Test email failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
