import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

export async function sendEmailSafe(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendEmail(to, subject, html);
    return { ok: true };
  } catch (err: unknown) {
    // Never let an email delivery failure crash the calling API route.
    // Log for visibility; the route continues and can surface a warning.
    const msg = err instanceof Error ? err.message : "send failed";
    console.error("sendEmail failed:", msg);
    return { ok: false, error: msg };
  }
}

export function verificationEmailHtml(code: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #4A342A;">SJA Digital Calendar</h2>
      <p>Your registration verification code is:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #B2967D; padding: 16px 0; text-align: center;">
        ${code}
      </div>
      <p style="color: #7D5A4A; font-size: 13px;">This code expires in 10 minutes. If you did not request it, ignore this email.</p>
    </div>
  `;
}

export function newStudentCodeEmailHtml(code: string, studentName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #4A342A;">
      <h2 style="color: #4A342A;">SJA Digital Calendar</h2>
      <p>A new student code has been issued for <strong>${studentName}</strong>.</p>
      <p>Your new student code is:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #B2967D; padding: 16px 0; text-align: center;">
        ${code}
      </div>
      <p style="color: #7D5A4A; font-size: 13px;">
        Use this code together with your registered email to log in. The previous code no longer works.
        If you did not request this, please contact the school office.
      </p>
    </div>
  `;
}
