import type { CreateAlertChannelInput } from "@pulse/contracts";

export const defaultAlertChannelInput: CreateAlertChannelInput = {
  name: "",
  isEnabled: true,
  destination: { type: "email", target: "" },
};
