import { type Monitor, byteLength } from "@pulse/contracts";
import { Badge } from "@pulse/ui/components/badge";
import { LockIcon } from "lucide-react";
import { requestContentTypeLabel } from "../monitor-meta";

type MonitorRequestSummaryProps = {
  monitor: Pick<
    Monitor,
    "requestHeaders" | "requestBody" | "requestContentType"
  >;
};

const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

export const MonitorRequestSummary = ({
  monitor,
}: MonitorRequestSummaryProps) => (
  <dl
    data-testid="monitor-request-summary"
    className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]"
  >
    <dt className="text-muted-foreground">Headers</dt>
    <dd className="flex flex-wrap gap-1.5">
      {monitor.requestHeaders.length === 0
        ? "Default headers only"
        : monitor.requestHeaders.map((header) => (
            <Badge key={header.name} variant="outline" className="font-mono">
              {header.secret ? <LockIcon aria-label="Secret" /> : null}
              {header.name}
            </Badge>
          ))}
    </dd>
    <dt className="text-muted-foreground">Body</dt>
    <dd>
      {monitor.requestBody
        ? `${monitor.requestContentType ? requestContentTypeLabel(monitor.requestContentType) : "Body"}, ${formatBytes(byteLength(monitor.requestBody))}`
        : "No body sent"}
    </dd>
  </dl>
);
