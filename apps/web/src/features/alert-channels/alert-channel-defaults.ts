import {
  type AlertChannel,
  type AlertChannelType,
  type CreateAlertChannelInput,
  alertDestinationUpdateSchema,
  nameSchema,
} from "@pulse/contracts";
import { z } from "zod";

export const editAlertChannelSchema = z.object({
  name: nameSchema,
  isEnabled: z.boolean(),
  destination: alertDestinationUpdateSchema,
});

export type AlertChannelFormValues = z.input<typeof editAlertChannelSchema>;

export const alertChannelDefaults = (
  type: AlertChannelType,
): CreateAlertChannelInput => ({
  name: "",
  isEnabled: true,
  destination:
    type === "opsgenie"
      ? { type, target: "", region: "us" }
      : { type, target: "" },
});

export const toAlertChannelFormValues = ({
  name,
  isEnabled,
  destination: { type, target, region },
}: AlertChannel): AlertChannelFormValues => ({
  name,
  isEnabled,
  destination:
    type === "opsgenie"
      ? { type, target, region: region ?? "us" }
      : { type, target },
});
