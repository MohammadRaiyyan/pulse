import { createHmac, randomBytes } from "node:crypto";

export const SIGNATURE_HEADER = "X-Pulse-Signature";
export const TIMESTAMP_HEADER = "X-Pulse-Timestamp";

export const generateSigningSecret = () =>
  `whsec_${randomBytes(32).toString("hex")}`;

export const signWebhookPayload = (
  secret: string,
  timestamp: string,
  body: string,
) =>
  `v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;

export const signatureHeaders = (secret: string, body: string) => {
  const timestamp = String(Math.floor(Date.now() / 1000));

  return {
    [TIMESTAMP_HEADER]: timestamp,
    [SIGNATURE_HEADER]: signWebhookPayload(secret, timestamp, body),
  };
};
