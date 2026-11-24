import { z } from "zod";
import type { HttpMethod } from "./monitor.ts";

export const REQUEST_LIMITS = {
  headers: 20,
  headerNameLength: 256,
  headerValueLength: 4_096,
  bodyBytes: 65_536,
} as const;

export const requestContentTypeSchema = z.enum([
  "application/json",
  "application/x-www-form-urlencoded",
  "text/plain",
  "application/xml",
  "text/xml",
]);

export type RequestContentType = z.infer<typeof requestContentTypeSchema>;

export const METHODS_WITHOUT_BODY: readonly HttpMethod[] = ["GET", "HEAD"];

export const methodAllowsBody = (method: HttpMethod) =>
  !METHODS_WITHOUT_BODY.includes(method);

const HTTP_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

const FORBIDDEN_HEADER_NAMES = new Set([
  "host",
  "content-length",
  "content-type",
  "transfer-encoding",
  "connection",
  "upgrade",
  "te",
  "trailer",
  "keep-alive",
]);

export const isForbiddenHeaderName = (name: string) => {
  const lower = name.toLowerCase();
  return FORBIDDEN_HEADER_NAMES.has(lower) || lower.startsWith("proxy-");
};

const headerNameSchema = z
  .string()
  .trim()
  .min(1, "Header name is required")
  .max(REQUEST_LIMITS.headerNameLength)
  .regex(
    HTTP_TOKEN,
    "Header names can only use letters, digits and !#$%&'*+-.^_`|~",
  )
  .refine((name) => !isForbiddenHeaderName(name), {
    message: "This header is managed by Pulse and cannot be set",
  });

const headerValueSchema = z
  .string()
  .max(REQUEST_LIMITS.headerValueLength)
  .regex(/^[^\r\n\0]*$/, "Header values cannot contain line breaks");

export const monitorHeaderInputSchema = z
  .object({
    name: headerNameSchema,
    value: headerValueSchema.nullable(),
    secret: z.boolean(),
  })
  .superRefine((header, context) => {
    if (header.value === null && !header.secret) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Enter a value",
      });
    }

    if (header.value === "" && header.secret) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Enter a secret value",
      });
    }
  });

export type MonitorHeaderInput = z.infer<typeof monitorHeaderInputSchema>;

export const monitorHeadersInputSchema = z
  .array(monitorHeaderInputSchema)
  .max(REQUEST_LIMITS.headers, `Use at most ${REQUEST_LIMITS.headers} headers`)
  .superRefine((headers, context) => {
    const seen = new Set<string>();

    headers.forEach((header, index) => {
      const key = header.name.trim().toLowerCase();

      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: [index, "name"],
          message: `${header.name} is listed more than once`,
        });
      }

      seen.add(key);
    });
  });

export const monitorHeaderSchema = z.object({
  name: z.string(),
  value: z.string().nullable(),
  secret: z.boolean(),
});

export type MonitorHeader = z.infer<typeof monitorHeaderSchema>;

export const byteLength = (value: string) =>
  new TextEncoder().encode(value).length;

export const requestBodySchema = z
  .string()
  .refine((body) => byteLength(body) <= REQUEST_LIMITS.bodyBytes, {
    message: `The body can be at most ${REQUEST_LIMITS.bodyBytes / 1024} KB`,
  });

type RequestFields = {
  method?: HttpMethod | undefined;
  requestBody?: string | null | undefined;
  requestContentType?: RequestContentType | null | undefined;
};

export const requestBodyIssues = ({
  method,
  requestBody,
  requestContentType,
}: RequestFields) => {
  const issues: {
    path: "requestBody" | "requestContentType";
    message: string;
  }[] = [];

  if (!requestBody) {
    return issues;
  }

  if (method && !methodAllowsBody(method)) {
    issues.push({
      path: "requestBody",
      message: `${method} requests cannot send a body`,
    });
  }

  if (!requestContentType) {
    issues.push({
      path: "requestContentType",
      message: "Choose a content type for the body",
    });
  }

  return issues;
};

export const checkRequestBody = (
  fields: RequestFields,
  context: z.RefinementCtx,
) => {
  for (const issue of requestBodyIssues(fields)) {
    context.addIssue({
      code: "custom",
      path: [issue.path],
      message: issue.message,
    });
  }
};
