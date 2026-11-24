import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../db/client.ts";
import { monitors } from "../../models/index.ts";
import { secretBox } from "../../security/secret-box.ts";
import { registerUser, request, useTestServer } from "../../test/client.ts";

useTestServer();

const SECRET = "Bearer super-secret-token";

const monitorInput = {
  name: "Private API",
  url: "https://example.com/health",
  method: "POST",
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatusCode: 200,
  alertChannelIds: [] as string[],
  requestHeaders: [
    { name: "Authorization", value: SECRET, secret: true },
    { name: "Accept", value: "application/json", secret: false },
  ],
  requestBody: '{"ping":true}',
  requestContentType: "application/json",
};

const storedHeaders = async (id: string) => {
  const [row] = await db
    .select({ requestHeaders: monitors.requestHeaders })
    .from(monitors)
    .where(eq(monitors.id, id));
  return row?.requestHeaders ?? [];
};

const createMonitor = async (token: string) => {
  const created = await request("/api/monitors", {
    method: "POST",
    token,
    body: monitorInput,
  });
  expect(created.status).toBe(201);
  return created;
};

describe("monitor request configuration", () => {
  it("encrypts secret headers and never returns their values", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const created = await createMonitor(token);
    const id = created.body.id;

    const expectedHeaders = [
      { name: "Authorization", value: null, secret: true },
      { name: "Accept", value: "application/json", secret: false },
    ];

    const fetched = await request(`/api/monitors/${id}`, { token });
    const listed = await request("/api/monitors", { token });

    for (const response of [created, fetched, listed]) {
      expect(JSON.stringify(response.body)).not.toContain("super-secret-token");
    }

    expect(created.body.requestHeaders).toEqual(expectedHeaders);
    expect(fetched.body.requestHeaders).toEqual(expectedHeaders);
    expect(listed.body.items[0].requestHeaders).toEqual(expectedHeaders);
    expect(fetched.body.requestBody).toBe('{"ping":true}');
    expect(fetched.body.requestContentType).toBe("application/json");

    const [stored] = await storedHeaders(id);
    expect(stored?.value).toMatch(/^v1:/);
    expect(stored?.value).not.toContain("super-secret-token");
    expect(secretBox.decrypt(stored!.value)).toBe(SECRET);
  });

  it("keeps a secret submitted without a value and replaces it when a value is sent", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const { body } = await createMonitor(token);
    const [before] = await storedHeaders(body.id);

    const kept = await request(`/api/monitors/${body.id}`, {
      method: "PATCH",
      token,
      body: {
        requestHeaders: [
          { name: "Authorization", value: null, secret: true },
          { name: "X-Region", value: "eu", secret: false },
        ],
      },
    });

    expect(kept.status).toBe(200);
    expect(
      kept.body.requestHeaders.map((header: { name: string }) => header.name),
    ).toEqual(["Authorization", "X-Region"]);
    const [afterKeep] = await storedHeaders(body.id);
    expect(afterKeep?.value).toBe(before?.value);

    const paused = await request(`/api/monitors/${body.id}`, {
      method: "PATCH",
      token,
      body: { isPaused: true },
    });
    expect(paused.body.requestHeaders).toHaveLength(2);

    await request(`/api/monitors/${body.id}`, {
      method: "PATCH",
      token,
      body: {
        requestHeaders: [
          { name: "Authorization", value: "Bearer new", secret: true },
        ],
      },
    });
    const [replaced] = await storedHeaders(body.id);
    expect(secretBox.decrypt(replaced!.value)).toBe("Bearer new");
  });

  it("requires re-entering a value when a secret becomes non-secret", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const { body } = await createMonitor(token);

    const withoutValue = await request(`/api/monitors/${body.id}`, {
      method: "PATCH",
      token,
      body: {
        requestHeaders: [{ name: "Authorization", value: null, secret: false }],
      },
    });
    expect(withoutValue.status).toBe(400);
    expect(withoutValue.body.error.fieldErrors).toHaveProperty(
      "requestHeaders",
    );

    const reentered = await request(`/api/monitors/${body.id}`, {
      method: "PATCH",
      token,
      body: {
        requestHeaders: [
          { name: "Authorization", value: "visible", secret: false },
        ],
      },
    });
    expect(reentered.body.requestHeaders).toEqual([
      { name: "Authorization", value: "visible", secret: false },
    ]);
  });

  it("rejects a new secret header without a value", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const response = await request("/api/monitors", {
      method: "POST",
      token,
      body: {
        ...monitorInput,
        requestHeaders: [{ name: "X-Check-Token", value: null, secret: true }],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.fieldErrors.requestHeaders).toEqual([
      "Enter a value for the secret header X-Check-Token",
    ]);
  });

  it("rejects forbidden headers and bodies on GET with field errors", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const forbidden = await request("/api/monitors", {
      method: "POST",
      token,
      body: {
        ...monitorInput,
        requestHeaders: [{ name: "Host", value: "x", secret: false }],
      },
    });
    expect(forbidden.status).toBe(400);
    expect(Object.keys(forbidden.body.error.fieldErrors)).toEqual([
      "requestHeaders",
    ]);

    const bodyOnGet = await request("/api/monitors", {
      method: "POST",
      token,
      body: { ...monitorInput, method: "GET" },
    });
    expect(bodyOnGet.status).toBe(400);
    expect(bodyOnGet.body.error.fieldErrors.requestBody).toEqual([
      "GET requests cannot send a body",
    ]);

    const { body } = await createMonitor(token);
    const switchToGet = await request(`/api/monitors/${body.id}`, {
      method: "PATCH",
      token,
      body: { method: "GET" },
    });
    expect(switchToGet.status).toBe(400);
    expect(switchToGet.body.error.fieldErrors.requestBody).toBeDefined();

    const switchAndClear = await request(`/api/monitors/${body.id}`, {
      method: "PATCH",
      token,
      body: { method: "GET", requestBody: null, requestContentType: null },
    });
    expect(switchAndClear.status).toBe(200);
    expect(switchAndClear.body.requestBody).toBeNull();
    expect(switchAndClear.body.requestContentType).toBeNull();
  });

  it("defaults to no headers and no body", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const response = await request("/api/monitors", {
      method: "POST",
      token,
      body: {
        name: "Public API",
        url: "https://example.com/health",
        method: "GET",
        intervalSeconds: 60,
        timeoutMs: 5000,
        expectedStatusCode: 200,
        alertChannelIds: [],
      },
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      requestHeaders: [],
      requestBody: null,
      requestContentType: null,
    });
  });
});
