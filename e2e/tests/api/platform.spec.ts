import { expect, test } from "../../support/fixtures.ts";
import { API_ORIGIN, WEB_ORIGIN } from "../../support/environment.ts";

test.describe("platform", () => {
  test("health reports database and redis", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", database: "ok", redis: "ok" });
  });

  test("unknown routes use the error envelope", async ({ request }) => {
    const response = await request.get("/api/does-not-exist");

    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  test("malformed JSON is a validation error, not a crash", async ({ request }) => {
    const response = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: "{not json",
    });

    expect(response.status()).toBe(400);
    expect((await response.json()).error.message).toBe("Request body is not valid JSON");
  });

  test("security headers are set and the server is not advertised", async ({ request }) => {
    const response = await request.get("/api/health");
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("CORS allows the app origin only", async () => {
    const allowed = await fetch(`${API_ORIGIN}/api/health`, { headers: { Origin: WEB_ORIGIN } });
    const denied = await fetch(`${API_ORIGIN}/api/health`, { headers: { Origin: "https://evil.example" } });

    expect(allowed.headers.get("access-control-allow-origin")).toBe(WEB_ORIGIN);
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true");
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });
});
