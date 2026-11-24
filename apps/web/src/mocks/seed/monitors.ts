import {
  type CheckOutcome,
  type CheckResult,
  type CreateMonitorInput,
  DEFAULT_FAILURE_THRESHOLD,
  type Monitor,
  type MonitorStatus,
} from "@pulse/contracts";
import { seedId } from "../lib/ids";
import { minutesAgo } from "../lib/time";

const MONITOR_NAMESPACE = 3;
const CHECK_NAMESPACE = 4;
const CHECKS_PER_MONITOR = 120;

type MonitorScenario = {
  input: CreateMonitorInput;
  status: MonitorStatus;
  isPaused?: boolean;
  baseResponseMs: number;
  outcomeAt: (index: number) => CheckOutcome;
};

const always = (outcome: CheckOutcome) => () => outcome;

const scenarios = (channelIds: readonly string[]): MonitorScenario[] => [
  {
    input: {
      name: "Public API",
      url: "https://api.pulse.dev/health",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 5_000,
      expectedStatusCode: 200,
      alertChannelIds: channelIds.slice(0, 2),
    },
    status: "up",
    baseResponseMs: 120,
    outcomeAt: (index) => (index === 40 ? "down" : "up"),
  },
  {
    input: {
      name: "Payments service",
      url: "https://payments.pulse.dev/v1/status",
      method: "GET",
      intervalSeconds: 30,
      timeoutMs: 3_000,
      expectedStatusCode: 200,
      alertChannelIds: channelIds.slice(0, 1),
    },
    status: "degraded",
    baseResponseMs: 850,
    outcomeAt: (index) => (index < 10 ? "degraded" : "up"),
  },
  {
    input: {
      name: "Legacy SOAP gateway",
      url: "https://legacy.pulse.dev/soap",
      method: "POST",
      intervalSeconds: 300,
      timeoutMs: 10_000,
      expectedStatusCode: 200,
      alertChannelIds: channelIds.slice(1, 2),
    },
    status: "down",
    baseResponseMs: 2_400,
    outcomeAt: (index) => (index < 6 ? "down" : "up"),
  },
  {
    input: {
      name: "Docs site",
      url: "https://docs.pulse.dev",
      method: "HEAD",
      intervalSeconds: 600,
      timeoutMs: 5_000,
      expectedStatusCode: 200,
      alertChannelIds: [],
    },
    status: "up",
    isPaused: true,
    baseResponseMs: 60,
    outcomeAt: always("up"),
  },
];

const responseTimeAt = (baseMs: number, index: number) =>
  Math.round(baseMs + baseMs * 0.25 * Math.sin(index / 4) + (index % 7) * 4);

const errorMessageFor = (outcome: CheckOutcome) =>
  ({
    up: null,
    degraded: "Response slower than threshold",
    down: "Connection timed out",
  })[outcome];

const statusCodeFor = (outcome: CheckOutcome, expected: number) =>
  outcome === "down" ? null : expected;

const buildChecks = (
  monitorId: string,
  monitorIndex: number,
  scenario: MonitorScenario,
) =>
  Array.from({ length: CHECKS_PER_MONITOR }, (_, index): CheckResult => {
    const outcome = scenario.outcomeAt(index);

    return {
      id: seedId(CHECK_NAMESPACE + monitorIndex, index + 1),
      monitorId,
      outcome,
      statusCode: statusCodeFor(outcome, scenario.input.expectedStatusCode),
      responseTimeMs: responseTimeAt(scenario.baseResponseMs, index),
      errorMessage: errorMessageFor(outcome),
      checkedAt: minutesAgo((index * scenario.input.intervalSeconds) / 60),
    };
  });

const calculateUptime = (checks: readonly CheckResult[]) =>
  checks.length === 0
    ? null
    : (checks.filter((check) => check.outcome !== "down").length /
        checks.length) *
      100;

export const seedMonitors = (channelIds: readonly string[]) =>
  scenarios(channelIds).map((scenario, index) => {
    const id = seedId(MONITOR_NAMESPACE, index + 1);
    const checks = buildChecks(id, index + 1, scenario);
    const latestCheck = checks[0];
    const firstHealthyIndex = checks.findIndex(
      (check) => check.outcome === "up",
    );

    const monitor: Monitor = {
      ...scenario.input,
      id,
      status: scenario.status,
      isPaused: scenario.isPaused ?? false,
      failureThreshold:
        scenario.input.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD,
      consecutiveFailures: Math.max(firstHealthyIndex, 0),
      lastCheckedAt: latestCheck?.checkedAt ?? null,
      lastResponseTimeMs: latestCheck?.responseTimeMs ?? null,
      uptimePercent: calculateUptime(checks),
      createdAt: minutesAgo(40_000),
      updatedAt: minutesAgo(1_000),
    };

    return { monitor, checks };
  });
