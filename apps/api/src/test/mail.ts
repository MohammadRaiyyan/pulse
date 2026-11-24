import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { env } from "../config/env.ts";

export type SentEmail = {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string | null;
  sentAt: string;
};

export const clearSentEmails = () => writeFile(env.MAIL_FILE, "");

export const readSentEmails = async (): Promise<SentEmail[]> => {
  const content = await readFile(env.MAIL_FILE, "utf8").catch(() => "");

  return content
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as SentEmail);
};

export const waitForEmail = async (to: string, timeoutMs = 3_000) => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const email = (await readSentEmails()).findLast(
      (message) => message.to === to,
    );

    if (email) {
      return email;
    }

    await delay(25);
  }

  throw new Error(`No email was sent to ${to}`);
};
