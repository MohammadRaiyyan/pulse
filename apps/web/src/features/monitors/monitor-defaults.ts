import {
  type CreateMonitorInput,
  DEFAULT_FAILURE_THRESHOLD,
} from "@pulse/contracts";

export const defaultMonitorInput: CreateMonitorInput = {
  name: "",
  url: "https://",
  method: "GET",
  intervalSeconds: 60,
  timeoutMs: 5_000,
  expectedStatusCode: 200,
  failureThreshold: DEFAULT_FAILURE_THRESHOLD,
  alertChannelIds: [],
  serviceId: null,
};
