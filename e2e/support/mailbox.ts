import { existsSync, readFileSync } from "node:fs";
import { MAIL_FILE } from "./environment.ts";

type SentEmail = {
  to: string;
  subject: string;
  text: string;
  html: string | null;
  sentAt: string;
};

const readEmails = () =>
  existsSync(MAIL_FILE)
    ? readFileSync(MAIL_FILE, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as SentEmail)
    : [];

export const latestEmailTo = (to: string) => readEmails().findLast((email) => email.to === to);

export const latestEmailLink = (to: string, path: string) => {
  const links = latestEmailTo(to)?.text.match(/https?:\/\/\S+/g) ?? [];
  return links.find((link) => new URL(link).pathname.startsWith(path));
};
