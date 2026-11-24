import { z } from "zod";
import { idSchema } from "../common/index.ts";

export const LIVE_EVENTS_PATH = "/events";

export const liveStreamEvents = {
  ready: "ready",
  change: "change",
} as const;

export const changeEventTypeSchema = z.enum([
  "monitor.updated",
  "monitor.deleted",
  "monitor.checked",
  "incident.updated",
  "webhook.updated",
  "webhook.deleted",
  "webhook.event",
  "alertChannel.updated",
  "alertChannel.deleted",
  "member.updated",
  "member.deleted",
  "invitation.updated",
]);

export type ChangeEventType = z.infer<typeof changeEventTypeSchema>;

export const changeEventSchema = z.object({
  type: changeEventTypeSchema,
  id: idSchema,
});

export type ChangeEvent = z.infer<typeof changeEventSchema>;
