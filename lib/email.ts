export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type EmailResult = {
  sent: boolean;
  skipped?: boolean;
  error?: string;
};

// Email delivery is optional. When RESEND_API_KEY is not set every send is a
// no-op so order/payment flows keep working without an email provider.
const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fromAddress(): string {
  return process.env.NOTIFICATION_EMAIL_FROM ?? "FIDWEL <no-reply@fidwel.app>";
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: EmailInput): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return { sent: false, skipped: true };
  }

  if (!input.to) {
    return { sent: false, error: "Missing recipient email address." };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: input.to,
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        sent: false,
        error: `Email provider returned ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`,
      };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Email send failed.",
    };
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail({
  heading,
  lines,
  action,
}: {
  heading: string;
  lines: string[];
  action?: { label: string; url: string };
}): string {
  const paragraphs = lines
    .map(
      (line) =>
        `<p style="margin:0 0 12px;line-height:1.5;color:#334155;">${escapeHtml(line)}</p>`
    )
    .join("");

  const button = action
    ? `<p style="margin:20px 0 0;"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;">${escapeHtml(action.label)}</a></p>`
    : "";

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;padding:24px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px;">
      <p style="margin:0 0 16px;font-size:20px;font-weight:800;color:#15803d;letter-spacing:-0.5px;">FIDWEL</p>
      <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${escapeHtml(heading)}</h1>
      ${paragraphs}
      ${button}
    </div>
  </body>
</html>`;
}
