import { logger } from "./logger.ts";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export const sendEmail = async (message: EmailMessage) => {
  logger.info({ to: message.to, subject: message.subject }, "Email delivery is not configured");
};
