import type { AlertDelivery } from "@pulse/contracts";
import { createStatusBadge } from "@/components/data/create-status-badge";
import { formatDateTime, formatRelativeTime } from "@/lib/format/date";
import { deliveryStatusMeta } from "../alert-channel-meta";

const DeliveryStatusBadge = createStatusBadge(deliveryStatusMeta);

export const LastDelivery = ({
  delivery,
}: {
  delivery: AlertDelivery | null;
}) => {
  if (!delivery) {
    return <span className="text-xs text-muted-foreground">Never sent</span>;
  }

  return (
    <div className="flex max-w-72 flex-col gap-1">
      <span className="flex items-center gap-2">
        <DeliveryStatusBadge value={delivery.status} />
        <time
          dateTime={delivery.updatedAt}
          title={formatDateTime(delivery.updatedAt)}
          className="text-xs text-muted-foreground"
        >
          {formatRelativeTime(delivery.updatedAt)}
        </time>
      </span>
      {delivery.lastError ? (
        <span
          className="truncate text-xs text-destructive"
          title={delivery.lastError}
        >
          {delivery.lastError}
        </span>
      ) : null}
    </div>
  );
};
