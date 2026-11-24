import { appendFile } from "node:fs/promises";
import { createTransport } from "nodemailer";
import { env } from "../config/env.ts";
import { logger } from "./logger.ts";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const DEFAULT_FROM = "Pulse <no-reply@localhost>";

const from = env.MAIL_FROM || DEFAULT_FROM;

const smtpTransport =
  env.MAIL_TRANSPORT === "smtp" && env.SMTP_HOST
    ? createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: env.SMTP_USER
          ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
          : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      })
    : undefined;

const jsonTransport = createTransport({ jsonTransport: true });

export const isEmailDeliveryEnabled =
  env.MAIL_TRANSPORT === "file" || smtpTransport !== undefined;

if (!isEmailDeliveryEnabled) {
  logger.warn("Email delivery is disabled. Set SMTP_HOST to send email.");
}

const writeToFile = async (message: EmailMessage) => {
  const info = await jsonTransport.sendMail({ from, ...message });
  const record = {
    messageId: info.messageId,
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html ?? null,
    sentAt: new Date().toISOString(),
  };

  await appendFile(env.MAIL_FILE, `${JSON.stringify(record)}\n`);
};

export const sendEmail = async (message: EmailMessage) => {
  if (env.MAIL_TRANSPORT === "file") {
    await writeToFile(message);
    return;
  }

  if (!smtpTransport) {
    logger.warn(
      { to: message.to, subject: message.subject },
      "Email not sent because delivery is disabled",
    );
    return;
  }

  await smtpTransport.sendMail({ from, ...message });
};
