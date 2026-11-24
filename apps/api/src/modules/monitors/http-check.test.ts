import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSafeFetch, isPublicAddress } from "../../lib/outbound-http.ts";
import type { MonitorRow } from "../../models/index.ts";
import { runHttpCheck as runCheck } from "./http-check.ts";

const localFetch = createSafeFetch({ isAllowedAddress: () => true });
const publicOnlyFetch = createSafeFetch({ isAllowedAddress: isPublicAddress });

const runHttpCheck = (monitor: MonitorRow) => runCheck(monitor, localFetch);

let baseUrl = "";

const target = createServer((req, res) => {
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
