import type { Webhook } from "@pulse/contracts";
import {
  type DetailDefinition,
  DetailList,
  DetailListSkeleton,
} from "@/components/data/detail-list";
import { formatDateTime } from "@/lib/format/date";
import { formatCount, formatDuration } from "@/lib/format/number";
import { IngestUrl } from "./ingest-url";

const webhookDetails: readonly DetailDefinition<Webhook>[] = [
  {
    label: "Ingest URL",
    value: ({ ingestUrl }) => <IngestUrl url={ingestUrl} />,
  },
  {
    label: "Silence alert",
    value: ({ expectedIntervalSeconds }) =>
      formatDuration(expectedIntervalSeconds),
  },
  {
    label: "Events received (all time)",
    value: ({ eventCount }) => formatCount(eventCount),
  },
  {
    label: "Last event",
    value: ({ lastReceivedAt }) => formatDateTime(lastReceivedAt),
  },
];

export const WebhookDetails = ({ webhook }: { webhook: Webhook }) => (
  <DetailList definitions={webhookDetails} data={webhook} />
);

export const WebhookDetailsSkeleton = () => (
  <DetailListSkeleton definitions={webhookDetails} />
);
