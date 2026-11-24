import type { IncidentSource } from "@pulse/contracts";
import { ActivityIcon, WebhookIcon } from "lucide-react";
import { TableLink } from "@/components/data/table-link";

const linkClassName = "flex items-center gap-2";
const iconClassName = "size-4 text-muted-foreground";

const DeletedSource = ({ source }: { source: IncidentSource }) => {
  const Icon = source.type === "monitor" ? ActivityIcon : WebhookIcon;

  return (
    <span className={linkClassName}>
      <Icon className={iconClassName} />
      <span className="font-medium">{source.name}</span>
      <span className="text-xs text-muted-foreground">(deleted)</span>
    </span>
  );
};

export const IncidentSourceLink = ({ source }: { source: IncidentSource }) => {
  if (source.isDeleted) {
    return <DeletedSource source={source} />;
  }

  return source.type === "monitor" ? (
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
};
