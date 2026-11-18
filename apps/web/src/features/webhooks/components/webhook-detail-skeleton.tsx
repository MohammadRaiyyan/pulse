import { ActionsSkeleton } from "@/components/skeleton/actions-skeleton";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import { TitleSkeleton } from "@/components/skeleton/title-skeleton";
import { WEBHOOK_EVENTS_PAGE_SIZE } from "../webhook-constants";
import { WebhookDetailLayout } from "./webhook-detail-layout";
import { WebhookDetailsSkeleton } from "./webhook-details";
import { WebhookEventsTableSkeleton } from "./webhook-events-table";

export const WebhookDetailSkeleton = () => (
  <WebhookDetailLayout
    title={<TitleSkeleton />}
    badge={<BadgeSkeleton />}
    actions={<ActionsSkeleton count={2} />}
    details={<WebhookDetailsSkeleton />}
    events={<WebhookEventsTableSkeleton rows={WEBHOOK_EVENTS_PAGE_SIZE} />}
  />
);
