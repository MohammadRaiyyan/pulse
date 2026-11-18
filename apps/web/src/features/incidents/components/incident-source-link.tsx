import type { IncidentSource } from "@pulse/contracts";
import { ActivityIcon, WebhookIcon } from "lucide-react";
import { TableLink } from "@/components/data/table-link";

const linkClassName = "flex items-center gap-2";
const iconClassName = "size-4 text-muted-foreground";

export const IncidentSourceLink = ({ source }: { source: IncidentSource }) =>
  source.type === "monitor" ? (
    <TableLink
      to="/monitors/$monitorId"
      params={{ monitorId: source.id }}
      className={linkClassName}
    >
      <ActivityIcon className={iconClassName} />
      {source.name}
    </TableLink>
  ) : (
    <TableLink
      to="/webhooks/$webhookId"
      params={{ webhookId: source.id }}
      className={linkClassName}
    >
      <WebhookIcon className={iconClassName} />
      {source.name}
    </TableLink>
  );
