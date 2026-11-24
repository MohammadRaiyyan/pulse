import { REDACTED_HEADER_VALUE } from "@pulse/contracts";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "x-auth-token",
  "x-access-token",
]);

const SENSITIVE_NAME_PARTS = ["token", "secret", "password", "api-key", "apikey"];

const SIGNATURE_HEADERS = new Set([
  "stripe-signature",
  "x-hub-signature",
  "x-hub-signature-256",
  "x-slack-signature",
  "x-shopify-hmac-sha256",
  "x-twilio-signature",
  "svix-signature",
  "webhook-signature",
]);

export const isSensitiveHeader = (name: string) => {
  const lowerName = name.toLowerCase();

  if (SIGNATURE_HEADERS.has(lowerName)) {
    return false;
  }

  return (
    SENSITIVE_HEADERS.has(lowerName) ||
    SENSITIVE_NAME_PARTS.some((part) => lowerName.includes(part))
  );
};

export const redactHeaders = (headers: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      isSensitiveHeader(name) ? REDACTED_HEADER_VALUE : value,
    ]),
  );
