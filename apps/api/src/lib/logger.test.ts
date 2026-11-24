import { describe, expect, it } from "vitest";
import { redactUrl, serializeRequest } from "./logger.ts";

describe("request log redaction", () => {
  it("masks invitation tokens and webhook slugs in paths", () => {
    expect(redactUrl("/api/invitations/preview/abc.def")).toBe(
      "/api/invitations/preview/[redacted]",
    );
    expect(redactUrl("/hooks/secret-slug")).toBe("/hooks/[redacted]");
    expect(redactUrl("/hooks/secret-slug?x=1")).toBe("/hooks/[redacted]?x=1");
  });

  it("masks secret query parameters and keeps the rest", () => {
    expect(redactUrl("/reset-password?token=abc&next=%2Fhome")).toBe(
      "/reset-password?token=%5Bredacted%5D&next=%2Fhome",
    );
    expect(redactUrl("/api/monitors?page=2")).toBe("/api/monitors?page=2");
  });

  it("drops params and query from serialized requests", () => {
    const request = {
      id: 1,
      method: "GET",
      url: "/api/invitations/preview/abc.def",
      headers: { host: "localhost" },
      params: { token: "abc.def" },
      query: { token: "abc.def" },
    };
    const serialized = serializeRequest(request);

    expect(serialized.url).toBe("/api/invitations/preview/[redacted]");
    expect(JSON.stringify(serialized)).not.toContain("abc.def");
  });
});
