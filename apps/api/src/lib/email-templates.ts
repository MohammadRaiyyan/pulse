import type { EmailMessage } from "./mailer.ts";

type EmailContent = Omit<EmailMessage, "to">;

type EmailLayout = {
  subject: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer?: string;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toText = ({ paragraphs, action, footer }: EmailLayout) =>
  [
    ...paragraphs,
    ...(action ? [`${action.label}: ${action.url}`] : []),
    ...(footer ? [footer] : []),
  ].join("\n\n");

const toHtml = ({ subject, paragraphs, action, footer }: EmailLayout) => {
  const body = paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
  const button = action
    ? `<p><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:10px 16px;background:#111827;color:#ffffff;border-radius:6px;text-decoration:none">${escapeHtml(action.label)}</a></p>`
    : "";
  const small = footer
    ? `<p style="color:#6b7280;font-size:12px">${escapeHtml(footer)}</p>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5;color:#111827">${body}${button}${small}</body></html>`;
};

const render = (layout: EmailLayout): EmailContent => ({
  subject: layout.subject,
  text: toText(layout),
  html: toHtml(layout),
});

export const passwordResetEmail = ({
  resetUrl,
  expiresInMinutes,
}: {
  resetUrl: string;
  expiresInMinutes: number;
}) =>
  render({
    subject: "Reset your Pulse password",
    paragraphs: [
      "Someone asked to reset the password for your Pulse account.",
      `The link below works once and expires in ${expiresInMinutes} minutes.`,
    ],
    action: { label: "Reset password", url: resetUrl },
    footer: "If you did not ask for this, you can ignore this email.",
  });

export const invitationEmail = ({
  inviteUrl,
  inviterName,
  role,
  expiresInDays,
}: {
  inviteUrl: string;
  inviterName: string;
  role: string;
  expiresInDays: number;
}) =>
  render({
    subject: `${inviterName} invited you to Pulse`,
    paragraphs: [
      `${inviterName} invited you to join their Pulse workspace as ${role}.`,
      `The invitation expires in ${expiresInDays} days.`,
    ],
    action: { label: "Accept invitation", url: inviteUrl },
    footer: "If you were not expecting this, you can ignore this email.",
  });

export const alertEmail = ({
  subject,
  message,
  detailsUrl,
}: {
  subject: string;
  message: string;
  detailsUrl?: string;
}) =>
  render({
    subject,
    paragraphs: [message],
    action: detailsUrl ? { label: "Open Pulse", url: detailsUrl } : undefined,
    footer: "You receive this because this address is a Pulse alert channel.",
  });
