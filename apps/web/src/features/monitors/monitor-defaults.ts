import type { CreateMonitorInput } from "@pulse/contracts";

export const defaultMonitorInput: CreateMonitorInput = {
  name: "",
  url: "https://",
  method: "GET",
  intervalSeconds: 60,
  timeoutMs: 5_000,
  expectedStatusCode: 200,
  alertChannelIds: [],
};
