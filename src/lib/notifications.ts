import { supabaseAdmin } from "./supabase/server";
import { sendEmail } from "./mailer";

export type NotificationType = "posted" | "manual" | "1_month" | "1_week" | "3_days";

const REMINDER_OFFSETS: { type: NotificationType; days: number }[] = [
  { type: "1_month", days: 30 },
  { type: "1_week", days: 7 },
  { type: "3_days", days: 3 },
];

// Public base URL of the site, used for links inside emails. Set
// NEXT_PUBLIC_APP_URL in production (e.g. https://your-app.vercel.app) —
// without it every email links back to localhost.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

if (!process.env.NEXT_PUBLIC_APP_URL) {
  console.warn(
    "NEXT_PUBLIC_APP_URL is not set; notification emails will link to http://localhost:3000."
  );
}

// Event titles and descriptions are admin-entered, so escape them: a stray
// "<" would otherwise break the email markup.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function eventEmailHtml(event: {
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  grade_levels: string[];
  all_grades: boolean;
}, type: NotificationType): { subject: string; html: string } {
  const dateStr = new Date(event.event_date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = event.start_time
    ? `${event.start_time.slice(0, 5)}${event.end_time ? " - " + event.end_time.slice(0, 5) : ""}`
    : "All day";
  const grades = event.all_grades ? "All grades" : event.grade_levels.join(", ") || "—";

  const prefix =
    type === "posted"
      ? "New event posted"
      : type === "manual"
      ? "Event notification"
      : type === "1_month"
      ? "Reminder: 1 month to go"
      : type === "1_week"
      ? "Reminder: 1 week to go"
      : "Reminder: 3 days to go";

  const subject = `${prefix}: ${event.title}`;

  const details: [string, string][] = [
    ["Date", dateStr],
    ["Time", timeStr],
  ];
  if (event.location) details.push(["Location", event.location]);
  details.push(["Grade(s)", grades]);

  const rowsHtml = details
    .map(
      ([label, value]) => `
                        <tr>
                          <td style="padding: 7px 16px 7px 0; color: #7D5A4A; font-size: 13px; width: 96px; vertical-align: top;">${label}</td>
                          <td style="padding: 7px 0; color: #4A342A; font-size: 14px;">${value}</td>
                        </tr>`
    )
    .join("");

  // Parents who are not signed in get redirected from /calendar to the login
  // page, so the button works for both.
  const calendarUrl = `${APP_URL}/calendar`;

  // Table-based layout with inline styles: that is what email clients reliably
  // support. Flexbox and grid are not safe here.
  const html = `
    <!doctype html>
    <html>
      <body style="margin: 0; padding: 0; background-color: #F2EBE3;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F2EBE3; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width: 560px; max-width: 100%;">

                <!-- Header -->
                <tr>
                  <td style="background-color: #4A342A; border-radius: 12px 12px 0 0; padding: 22px 28px;">
                    <div style="font-family: Arial, Helvetica, sans-serif; color: #B2967D; font-size: 11px; letter-spacing: 2px; text-transform: uppercase;">SJA Digital Calendar</div>
                    <div style="font-family: Arial, Helvetica, sans-serif; color: #FFFFFF; font-size: 19px; font-weight: bold; margin-top: 6px;">${prefix}</div>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="background-color: #FFFFFF; border: 1px solid #E8DDD1; border-top: none; border-radius: 0 0 12px 12px; padding: 26px 28px;">

                    <h1 style="font-family: Arial, Helvetica, sans-serif; color: #4A342A; font-size: 21px; line-height: 1.3; margin: 0 0 18px;">${escapeHtml(event.title)}</h1>

                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: #FBF7F1; border-radius: 8px;">
                      <tr>
                        <td style="padding: 14px 18px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                            ${rowsHtml}
                          </table>
                        </td>
                      </tr>
                    </table>

                    ${
                      event.description
                        ? `<p style="font-family: Arial, Helvetica, sans-serif; color: #4A342A; font-size: 14px; line-height: 1.65; margin: 20px 0 0;">${escapeHtml(event.description)}</p>`
                        : ""
                    }

                    <!-- Call to action -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 26px 0 0; width: 100%;">
                      <tr>
                        <td align="center" style="background-color: #B2967D; border-radius: 8px;">
                          <a href="${calendarUrl}" style="display: inline-block; padding: 13px 26px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: bold; color: #4A342A; text-decoration: none;">View in SJA Digital Calendar</a>
                        </td>
                      </tr>
                    </table>
                    <p style="font-family: Arial, Helvetica, sans-serif; color: #7D5A4A; font-size: 12px; text-align: center; margin: 10px 0 0;">
                      Or open <a href="${calendarUrl}" style="color: #4A342A; text-decoration: underline;">${calendarUrl}</a> in your browser
                    </p>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 12px 0; text-align: center;">
                    <p style="font-family: Arial, Helvetica, sans-serif; color: #7D5A4A; font-size: 12px; line-height: 1.7; margin: 0;">
                      You are receiving this because your child is in the relevant grade level.<br>
                      SJA Digital Calendar &middot; Saint Jerome Academy
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
  return { subject, html };
}

// Returns the list of parent IDs + emails that should receive notifications for an event
async function getRecipients(event: { all_grades: boolean; grade_levels: string[] }): Promise<{ parentId: string; email: string }[]> {
  // All parents whose linked students' grade levels intersect (or all if all_grades)
  const { data: parents } = await supabaseAdmin.from("parents").select("id, email");
  if (!parents || parents.length === 0) return [];

  // Map parent -> grade levels via linked students
  const { data: links } = await supabaseAdmin
    .from("parent_students")
    .select("parent_id, student_id");

  const studentIds = Array.from(new Set((links ?? []).map((l) => l.student_id)));
  const { data: students } = studentIds.length
    ? await supabaseAdmin.from("students").select("id, grade_level").in("id", studentIds)
    : { data: [] };

  const gradeByStudent = new Map((students ?? []).map((s) => [s.id, s.grade_level]));
  const gradesByParent = new Map<string, Set<string>>();
  for (const l of links ?? []) {
    const g = gradeByStudent.get(l.student_id);
    if (!g) continue;
    if (!gradesByParent.has(l.parent_id)) gradesByParent.set(l.parent_id, new Set());
    gradesByParent.get(l.parent_id)!.add(g);
  }

  const result: { parentId: string; email: string }[] = [];
  for (const p of parents) {
    const grades = gradesByParent.get(p.id);
    if (!grades) continue;
    let relevant = false;
    if (event.all_grades) {
      relevant = true;
    } else {
      relevant = event.grade_levels.some((g) => grades.has(g));
    }
    if (relevant) result.push({ parentId: p.id, email: p.email });
  }
  return result;
}

export async function fetchEventWithGrades(eventId: string) {
  const { data: event } = await supabaseAdmin
    .from("events")
    .select("id, title, description, event_date, start_time, end_time, location, all_grades")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  const { data: grades } = await supabaseAdmin
    .from("event_grades")
    .select("grade_level")
    .eq("event_id", eventId);

  return {
    ...event,
    grade_levels: (grades ?? []).map((g) => g.grade_level),
  };
}

// How many parents a notification for this event would reach, and why.
// Used to confirm a manual send before it goes out. Returns null when the
// event does not exist, so callers can tell "no such event" from "nobody to
// notify".
export async function previewRecipients(
  eventId: string
): Promise<{
  total: number;
  allGrades: boolean;
  grades: string[];
  alreadyNotified: number;
} | null> {
  const event = await fetchEventWithGrades(eventId);
  if (!event) return null;

  const recipients = await getRecipients(event);

  // Parents who have already been emailed about this event. Distinct parents,
  // not log rows: a manual send is re-sendable, so one parent can appear many
  // times.
  const { data: logRows } = await supabaseAdmin
    .from("notification_logs")
    .select("parent_id")
    .eq("event_id", eventId);

  return {
    total: recipients.length,
    allGrades: event.all_grades,
    grades: event.grade_levels,
    alreadyNotified: new Set((logRows ?? []).map((r) => r.parent_id)).size,
  };
}

export interface NotificationSendResult {
  /** Parents whose linked children match the event. */
  total: number;
  /** Emails accepted by SMTP. */
  sent: number;
  /** Skipped because they were already logged for this event and type. */
  skipped: number;
  /** Matched, but SMTP rejected the email. */
  failed: number;
}

export async function sendEventNotifications(
  eventId: string,
  type: NotificationType,
  options: { dedupe?: boolean } = {}
): Promise<NotificationSendResult> {
  // The dedupe protects the automated cron from emailing twice. A manual send
  // is an explicit admin action and passes dedupe: false so it always goes out.
  const dedupe = options.dedupe ?? true;
  const result: NotificationSendResult = { total: 0, sent: 0, skipped: 0, failed: 0 };

  const event = await fetchEventWithGrades(eventId);
  if (!event) return result;

  const recipients = await getRecipients(event);
  result.total = recipients.length;
  if (recipients.length === 0) return result;

  const { subject, html } = eventEmailHtml(event, type);

  for (const r of recipients) {
    if (dedupe) {
      const { data: existing } = await supabaseAdmin
        .from("notification_logs")
        .select("id")
        .eq("event_id", eventId)
        .eq("parent_id", r.parentId)
        .eq("type", type)
        .maybeSingle();

      if (existing) {
        result.skipped++;
        continue;
      }
    }

    try {
      await sendEmail(r.email, subject, html);
      await supabaseAdmin.from("notification_logs").insert({
        event_id: eventId,
        parent_id: r.parentId,
        type,
        status: "sent",
      });
      result.sent++;
    } catch (err) {
      console.error("Email send failed:", err);
      await supabaseAdmin.from("notification_logs").insert({
        event_id: eventId,
        parent_id: r.parentId,
        type,
        status: "failed",
      });
      result.failed++;
    }
  }

  return result;
}

export function reminderTypesForToday(eventDate: string): NotificationType[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const evDate = new Date(eventDate + "T00:00:00");
  const diffDays = Math.round((evDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const result: NotificationType[] = [];
  for (const { type, days } of REMINDER_OFFSETS) {
    if (diffDays === days) result.push(type);
  }
  return result;
}
