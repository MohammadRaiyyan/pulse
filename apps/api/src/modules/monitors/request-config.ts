import {
  type HttpMethod,
  type MonitorHeader,
  type MonitorHeaderInput,
  type RequestContentType,
  requestBodyIssues,
} from "@pulse/contracts";
import { badRequest } from "../../lib/errors.ts";
import type { StoredHeader } from "../../models/index.ts";
import { type SecretBox, secretBox } from "../../security/secret-box.ts";

const DEFAULT_USER_AGENT = "PulseMonitor/1.0";

type RequestConfig = {
  method: HttpMethod;
  requestHeaders: StoredHeader[];
  requestBody: string | null;
  requestContentType: RequestContentType | null;
};

type RequestConfigChanges = {
  method?: HttpMethod | undefined;
  requestHeaders?: MonitorHeaderInput[] | undefined;
  requestBody?: string | null | undefined;
  requestContentType?: RequestContentType | null | undefined;
};

const headerKey = (name: string) => name.trim().toLowerCase();

export const toStoredHeaders = (
  headers: MonitorHeaderInput[],
  existing: StoredHeader[],
  box: SecretBox = secretBox,
): StoredHeader[] => {
  const storedSecrets = new Map(
    existing
      .filter((header) => header.secret)
      .map((header) => [headerKey(header.name), header.value]),
  );

  return headers.map((header) => {
    const name = header.name.trim();

    if (!header.secret) {
      return { name, value: header.value ?? "", secret: false };
    }

    if (header.value !== null) {
      return { name, value: box.encrypt(header.value), secret: true };
    }

    const kept = storedSecrets.get(headerKey(name));

    if (!kept) {
      throw badRequest("Some fields are invalid", {
        requestHeaders: [`Enter a value for the secret header ${name}`],
      });
    }

    return { name, value: kept, secret: true };
  });
};

export const toPublicHeaders = (headers: StoredHeader[]): MonitorHeader[] =>
  headers.map((header) =>
    header.secret
      ? { name: header.name, value: null, secret: true }
      : { name: header.name, value: header.value, secret: false },
  );

export const toOutgoingHeaders = (
  config: Pick<
    RequestConfig,
    "requestHeaders" | "requestBody" | "requestContentType"
  >,
  box: SecretBox = secretBox,
) => {
  const headers = new Map<string, [string, string]>([
    ["user-agent", ["User-Agent", DEFAULT_USER_AGENT]],
  ]);

  for (const header of config.requestHeaders) {
    const value = header.secret ? box.decrypt(header.value) : header.value;
    headers.set(headerKey(header.name), [header.name, value]);
  }

  if (config.requestBody !== null && config.requestContentType) {
    headers.set("content-type", ["Content-Type", config.requestContentType]);
  }

  return Object.fromEntries(headers.values());
};

export const resolveRequestConfig = (
  changes: RequestConfigChanges,
  existing: RequestConfig | undefined,
): Partial<RequestConfig> => {
  const method = changes.method ?? existing?.method ?? "GET";
  const requestBody =
    changes.requestBody === undefined
      ? (existing?.requestBody ?? null)
      : changes.requestBody || null;
  const requestContentType =
    changes.requestContentType === undefined
      ? (existing?.requestContentType ?? null)
      : changes.requestContentType;

  const issues = requestBodyIssues({ method, requestBody, requestContentType });

  if (issues.length > 0) {
    throw badRequest(
      "Some fields are invalid",
      Object.fromEntries(issues.map((issue) => [issue.path, [issue.message]])),
    );
  }

  const resolved: Partial<RequestConfig> = {
    requestBody,
    requestContentType: requestBody === null ? null : requestContentType,
  };

  if (changes.requestHeaders) {
    resolved.requestHeaders = toStoredHeaders(
      changes.requestHeaders,
      existing?.requestHeaders ?? [],
    );
  }

  return resolved;
};

export const touchesRequestConfig = (changes: RequestConfigChanges) =>
  changes.method !== undefined ||
  changes.requestHeaders !== undefined ||
  changes.requestBody !== undefined ||
  changes.requestContentType !== undefined;
