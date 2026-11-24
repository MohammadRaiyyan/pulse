import { safeFetch } from "../../lib/outbound-http.ts";
import type { MonitorRow } from "../../models/index.ts";
import type { CheckMeasurement } from "./monitor.repository.ts";

const DEGRADED_RATIO = 0.5;

const elapsedSince = (startedAt: number) =>
  Math.round(performance.now() - startedAt);

const describeFailure = (error: unknown, timeoutMs: number) => {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return `Timed out after ${timeoutMs} ms`;
  }

  if (error instanceof Error && error.message.startsWith("Refusing")) {
    return error.message;
  }

  return "Connection failed";
};

export const runHttpCheck = async (
  monitor: MonitorRow,
): Promise<CheckMeasurement> => {
  const startedAt = performance.now();

  try {
    const response = await safeFetch(monitor.url, {
      method: monitor.method,
      timeoutMs: monitor.timeoutMs,
      headers: { "User-Agent": "PulseMonitor/1.0" },
    });
    await response.body?.cancel();

    const responseTimeMs = elapsedSince(startedAt);

    if (response.status !== monitor.expectedStatusCode) {
      return {
        outcome: "down",
        statusCode: response.status,
        responseTimeMs,
        errorMessage: `Expected HTTP ${monitor.expectedStatusCode}, got ${response.status}`,
      };
    }

    const isSlow = responseTimeMs > monitor.timeoutMs * DEGRADED_RATIO;

    return {
      outcome: isSlow ? "degraded" : "up",
      statusCode: response.status,
      responseTimeMs,
      errorMessage: isSlow ? `Response took ${responseTimeMs} ms` : null,
    };
  } catch (error) {
    return {
      outcome: "down",
      statusCode: null,
      responseTimeMs: elapsedSince(startedAt),
      errorMessage: describeFailure(error, monitor.timeoutMs),
    };
  }
};
