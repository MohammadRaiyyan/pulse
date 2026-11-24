import { UPTIME_HISTORY_DAYS } from "@pulse/contracts";
import { describe, expect, it } from "vitest";
import {
  buildUptimeHistory,
  deriveOverallStatus,
  deriveServiceStatus,
  historyStartDay,
} from "./service-health.ts";

const active = (status: Parameters<typeof deriveServiceStatus>[0][number]["status"]) => ({
  status,
  isPaused: false,
});

describe("service status", () => {
  it("has no data without members", () => {
    expect(deriveServiceStatus([])).toBe("no_data");
  });

  it("lets the worst member win", () => {
    expect(deriveServiceStatus([active("up"), active("pending")])).toBe("pending");
    expect(deriveServiceStatus([active("up"), active("degraded"), active("pending")])).toBe("degraded");
    expect(deriveServiceStatus([active("silent"), active("active")])).toBe("degraded");
    expect(deriveServiceStatus([active("degraded"), active("down"), active("silent")])).toBe("down");
    expect(deriveServiceStatus([active("active"), active("up")])).toBe("up");
  });

  it("ignores paused members", () => {
    expect(deriveServiceStatus([{ status: "down", isPaused: true }, active("up")])).toBe("up");
    expect(deriveServiceStatus([{ status: "down", isPaused: true }])).toBe("no_data");
  });

  it("summarises services into one overall status", () => {
    expect(deriveOverallStatus([])).toBe("operational");
    expect(deriveOverallStatus(["up", "pending", "no_data"])).toBe("operational");
    expect(deriveOverallStatus(["up", "degraded"])).toBe("degraded");
    expect(deriveOverallStatus(["up", "down", "degraded"])).toBe("partial_outage");
    expect(deriveOverallStatus(["down", "down", "no_data"])).toBe("major_outage");
  });
});

describe("uptime history", () => {
  const now = new Date("2026-11-24T12:00:00Z");

  it("returns one bar per day ending today, with gaps as no data", () => {
    const history = buildUptimeHistory([], now);

    expect(history.days).toHaveLength(UPTIME_HISTORY_DAYS);
    expect(history.days[0]?.date).toBe(historyStartDay(now));
    expect(history.days[0]?.date).toBe("2026-08-27");
    expect(history.days.at(-1)?.date).toBe("2026-11-24");
    expect(history.days.every((day) => day.uptimePercent === null)).toBe(true);
    expect(history.uptimePercent).toBeNull();
  });

  it("computes uptime as one minus down over checks, rounding down", () => {
    const history = buildUptimeHistory(
      [
        { day: "2026-11-24", checkCount: 200, downCount: 1 },
        { day: "2026-11-23", checkCount: 3, downCount: 3 },
        { day: "2026-11-22", checkCount: 30_000, downCount: 1 },
        { day: "2026-11-21", checkCount: 0, downCount: 0 },
      ],
      now,
    );
    const byDate = new Map(history.days.map((day) => [day.date, day.uptimePercent]));

    expect(byDate.get("2026-11-24")).toBe(99.5);
    expect(byDate.get("2026-11-23")).toBe(0);
    expect(byDate.get("2026-11-22")).toBe(99.99);
    expect(byDate.get("2026-11-21")).toBeNull();
    expect(byDate.get("2026-11-20")).toBeNull();
    expect(history.uptimePercent).toBe(Math.floor((1 - 5 / 30_203) * 10_000) / 100);
  });

  it("ignores rows outside the window", () => {
    const history = buildUptimeHistory([{ day: "2026-01-01", checkCount: 10, downCount: 10 }], now);

    expect(history.uptimePercent).toBeNull();
  });
});
