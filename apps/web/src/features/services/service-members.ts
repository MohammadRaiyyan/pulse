import type { Service } from "@pulse/contracts";
import { pluralize } from "@/lib/format/text";

export const describeMembers = ({
  monitorIds,
  webhookIds,
}: Pick<Service, "monitorIds" | "webhookIds">) =>
  monitorIds.length + webhookIds.length === 0
    ? "No members"
    : `${pluralize(monitorIds.length, "monitor")}, ${pluralize(webhookIds.length, "webhook")}`;
