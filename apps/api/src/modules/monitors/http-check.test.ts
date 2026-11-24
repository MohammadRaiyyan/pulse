import { type IncomingHttpHeaders, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSafeFetch, isPublicAddress } from "../../lib/outbound-http.ts";
import type { MonitorRow } from "../../models/index.ts";
import { secretBox } from "../../security/secret-box.ts";
import { runHttpCheck as runCheck } from "./http-check.ts";

const localFetch = createSafeFetch({ isAllowedAddress: () => true });
const publicOnlyFetch = createSafeFetch({ isAllowedAddress: isPublicAddress });

const runHttpCheck = (monitor: MonitorRow) => runCheck(monitor, localFetch);

let baseUrl = "";

type ReceivedRequest = {
  method: string | undefined;
  headers: IncomingHttpHeaders;
  body: string;
};

const received: ReceivedRequest[] = [];

const target = createServer(async (req, res) => {
  if (req.url === "/echo") {
    const chunks: Buffer[] = [];

    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }

    received.push({
      method: req.method,
      headers: req.headers,
      body: Buffer.concat(chunks).toString("utf8"),
    });
    res.end("ok");
    return;
  }

  if (req.url === "/slow") {
    setTimeout(() => res.end("ok"), 700);
    return;
  }

  res.statusCode = req.url === "/broken" ? 500 : 200;
  res.end("ok");
});

beforeAll(() => {
  target.listen(0);
  baseUrl = `http://localhost:${(target.address() as AddressInfo).port}`;
});

afterAll(() => {
  target.close();
});

const monitorFor = (path: string, timeoutMs = 5000): MonitorRow => ({
  id: "00000000-0000-4000-8000-000000000001",
  name: "Test",
  url: `${baseUrl}${path}`,
  method: "GET",
  intervalSeconds: 60,
  timeoutMs,
  expectedStatusCode: 200,
  failureThreshold: 2,
  consecutiveFailures: 0,
  isPaused: false,
  status: "pending",
  lastCheckedAt: null,
  lastResponseTimeMs: null,
  uptimePercent: null,
  requestHeaders: [],
  requestBody: null,
  requestContentType: null,
  serviceId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe("runHttpCheck", () => {
  it("reports up for the expected status", async () => {
    const result = await runHttpCheck(monitorFor("/ok"));
    expect(result.outcome).toBe("up");
    expect(result.statusCode).toBe(200);
  });

  it("reports down for an unexpected status", async () => {
    const result = await runHttpCheck(monitorFor("/broken"));
    expect(result.outcome).toBe("down");
    expect(result.errorMessage).toBe("Expected HTTP 200, got 500");
  });

  it("reports degraded when slower than half the timeout", async () => {
    const result = await runHttpCheck(monitorFor("/slow", 1000));
    expect(result.outcome).toBe("degraded");
  });

  it("reports down on timeout", async () => {
    const result = await runHttpCheck(monitorFor("/slow", 300));
    expect(result.outcome).toBe("down");
    expect(result.errorMessage).toBe("Timed out after 300 ms");
  });

  it("reports a blocked private target without internal details", async () => {
    const result = await runCheck(monitorFor("/ok"), publicOnlyFetch);
    expect(result.outcome).toBe("down");
    expect(result.statusCode).toBeNull();
    expect(result.errorMessage).toBe("Blocked: private network address");
  });
});

describe("runHttpCheck request configuration", () => {
  it("sends the default user agent without a body", async () => {
    received.length = 0;
    await runHttpCheck(monitorFor("/echo"));

    expect(received[0]?.headers["user-agent"]).toBe("PulseMonitor/1.0");
    expect(received[0]?.headers["content-type"]).toBeUndefined();
    expect(received[0]?.body).toBe("");
  });

  it("sends custom headers, decrypted secrets and the body with its content type", async () => {
    received.length = 0;
    const result = await runHttpCheck({
      ...monitorFor("/echo"),
      method: "POST",
      requestHeaders: [
        { name: "X-Api-Key", value: secretBox.encrypt("top-secret"), secret: true },
        { name: "Accept", value: "text/xml", secret: false },
        { name: "user-agent", value: "CustomAgent/2.0", secret: false },
      ],
      requestBody: "<ping/>",
      requestContentType: "text/xml",
    });

    expect(result.outcome).toBe("up");
    expect(received[0]).toMatchObject({
      method: "POST",
      body: "<ping/>",
      headers: {
        "x-api-key": "top-secret",
        accept: "text/xml",
        "user-agent": "CustomAgent/2.0",
        "content-type": "text/xml",
      },
    });
  });

  it("reports down without calling the target when a secret cannot be decrypted", async () => {
    received.length = 0;
    const result = await runHttpCheck({
      ...monitorFor("/echo"),
      requestHeaders: [{ name: "X-Api-Key", value: "v1:broken", secret: true }],
    });

    expect(result.outcome).toBe("down");
    expect(result.errorMessage).toBe(
      "A secret header could not be decrypted. Re-enter it.",
    );
    expect(received).toHaveLength(0);
  });
});
