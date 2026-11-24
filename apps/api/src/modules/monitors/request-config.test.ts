import {
  REQUEST_LIMITS,
  createMonitorSchema,
  updateMonitorSchema,
} from "@pulse/contracts";
import { describe, expect, it } from "vitest";
import { AppError } from "../../lib/errors.ts";
import { secretBox } from "../../security/secret-box.ts";
import {
  resolveRequestConfig,
  toOutgoingHeaders,
  toPublicHeaders,
  toStoredHeaders,
} from "./request-config.ts";

const baseInput = {
  name: "Private API",
  url: "https://example.com/health",
  method: "POST",
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatusCode: 200,
  alertChannelIds: [],
};

const issuesFor = (input: Record<string, unknown>) => {
  const result = createMonitorSchema.safeParse({ ...baseInput, ...input });
  return result.success
    ? []
    : result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      );
};

const header = (name: string, value: string | null = "x", secret = false) => ({
  name,
  value,
  secret,
});

describe("request validation", () => {
  it("accepts headers and a body for methods that carry one", () => {
    expect(
      issuesFor({
        requestHeaders: [
          header("Authorization", "Bearer t", true),
          header("Accept"),
        ],
        requestBody: "{}",
        requestContentType: "application/json",
      }),
    ).toEqual([]);
  });

  it.each([
    "Host",
    "content-length",
    "Content-Type",
    "Transfer-Encoding",
    "connection",
    "Upgrade",
    "TE",
    "trailer",
    "Keep-Alive",
    "Proxy-Authorization",
    "proxy-connection",
  ])("rejects the managed header %s", (name) => {
    expect(issuesFor({ requestHeaders: [header(name)] })).toEqual([
      "requestHeaders.0.name: This header is managed by Pulse and cannot be set",
    ]);
  });

  it("allows overriding user-agent and accept", () => {
    expect(
      issuesFor({ requestHeaders: [header("User-Agent"), header("accept")] }),
    ).toEqual([]);
  });

  it("rejects header names that are not HTTP tokens and values with line breaks", () => {
    expect(issuesFor({ requestHeaders: [header("Bad Name")] })[0]).toMatch(
      /^requestHeaders\.0\.name/,
    );
    expect(
      issuesFor({ requestHeaders: [header("X-Ok", "a\r\nInjected: 1")] }),
    ).toEqual([
      "requestHeaders.0.value: Header values cannot contain line breaks",
    ]);
  });

  it("rejects duplicate names, too many headers and missing values", () => {
    expect(
      issuesFor({ requestHeaders: [header("X-Token"), header("x-token")] }),
    ).toEqual(["requestHeaders.1.name: x-token is listed more than once"]);

    const tooMany = Array.from(
      { length: REQUEST_LIMITS.headers + 1 },
      (_, index) => header(`X-Header-${index}`),
    );
    expect(issuesFor({ requestHeaders: tooMany })).toEqual([
      `requestHeaders: Use at most ${REQUEST_LIMITS.headers} headers`,
    ]);

    expect(issuesFor({ requestHeaders: [header("X-Plain", null)] })).toEqual([
      "requestHeaders.0.value: Enter a value",
    ]);
    expect(
      issuesFor({ requestHeaders: [header("X-Secret", "", true)] }),
    ).toEqual(["requestHeaders.0.value: Enter a secret value"]);
    expect(
      issuesFor({ requestHeaders: [header("X-Secret", null, true)] }),
    ).toEqual([]);
  });

  it("rejects a body on GET and HEAD and a body without a content type", () => {
    for (const method of ["GET", "HEAD"]) {
      expect(
        issuesFor({
          method,
          requestBody: "{}",
          requestContentType: "application/json",
        }),
      ).toEqual([`requestBody: ${method} requests cannot send a body`]);
    }

    expect(
      issuesFor({ method: "GET", requestBody: "", requestContentType: null }),
    ).toEqual([]);
    expect(issuesFor({ requestBody: "hello" })).toEqual([
      "requestContentType: Choose a content type for the body",
    ]);
  });

  it("limits the body to 64 KB measured in bytes", () => {
    const limit = REQUEST_LIMITS.bodyBytes;

    expect(
      issuesFor({
        requestBody: "a".repeat(limit),
        requestContentType: "text/plain",
      }),
    ).toEqual([]);
    expect(
      issuesFor({
        requestBody: "é".repeat(limit / 2 + 1),
        requestContentType: "text/plain",
      }),
    ).toEqual(["requestBody: The body can be at most 64 KB"]);
  });

  it("validates header shapes on partial updates", () => {
    expect(
      updateMonitorSchema.safeParse({ requestHeaders: [header("Host")] })
        .success,
    ).toBe(false);
    expect(updateMonitorSchema.safeParse({ requestBody: "{}" }).success).toBe(
      true,
    );
  });
});

const expectFieldError = (run: () => unknown, field: string) => {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect(Object.keys((error as AppError).fieldErrors ?? {})).toEqual([field]);
    return;
  }

  throw new Error("Expected a field error");
};

describe("stored headers", () => {
  it("encrypts secrets and hides them in public headers", () => {
    const stored = toStoredHeaders(
      [
        header("X-Api-Key", "secret-value", true),
        header("Accept", "application/json"),
      ],
      [],
    );

    expect(stored[0]?.value).toMatch(/^v1:/);
    expect(stored[0]?.value).not.toContain("secret-value");
    expect(stored[1]).toEqual({
      name: "Accept",
      value: "application/json",
      secret: false,
    });
    expect(toPublicHeaders(stored)).toEqual([
      { name: "X-Api-Key", value: null, secret: true },
      { name: "Accept", value: "application/json", secret: false },
    ]);
  });

  it("keeps a stored secret when it is submitted without a value", () => {
    const [existing] = toStoredHeaders(
      [header("X-Api-Key", "keep-me", true)],
      [],
    );
    const stored = toStoredHeaders(
      [header("x-api-key", null, true)],
      [existing!],
    );

    expect(stored[0]?.value).toBe(existing?.value);
    expect(secretBox.decrypt(stored[0]!.value)).toBe("keep-me");
  });

  it("requires a value for a new secret or a header that was not secret", () => {
    expectFieldError(
      () => toStoredHeaders([header("X-New", null, true)], []),
      "requestHeaders",
    );
    expectFieldError(
      () =>
        toStoredHeaders(
          [header("X-Plain", null, true)],
          [{ name: "X-Plain", value: "visible", secret: false }],
        ),
      "requestHeaders",
    );
  });

  it("builds outgoing headers with overrides and the body content type", () => {
    const stored = toStoredHeaders(
      [
        header("Authorization", "Bearer t", true),
        header("user-agent", "Custom/1"),
      ],
      [],
    );

    expect(
      toOutgoingHeaders({
        requestHeaders: stored,
        requestBody: "a=1",
        requestContentType: "application/x-www-form-urlencoded",
      }),
    ).toEqual({
      "user-agent": "Custom/1",
      Authorization: "Bearer t",
      "Content-Type": "application/x-www-form-urlencoded",
    });
  });
});

describe("resolveRequestConfig", () => {
  const existing = {
    method: "POST" as const,
    requestHeaders: [],
    requestBody: "<ping/>",
    requestContentType: "text/xml" as const,
  };

  it("rejects switching to GET while a body is stored", () => {
    expectFieldError(
      () => resolveRequestConfig({ method: "GET" }, existing),
      "requestBody",
    );
  });

  it("clears the content type with the body", () => {
    expect(
      resolveRequestConfig({ method: "GET", requestBody: null }, existing),
    ).toEqual({ requestBody: null, requestContentType: null });
    expect(resolveRequestConfig({ requestBody: "" }, existing)).toEqual({
      requestBody: null,
      requestContentType: null,
    });
  });
});
