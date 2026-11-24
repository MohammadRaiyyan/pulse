import { cn } from "@pulse/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@pulse/ui/components/tooltip";
import { LiveDot } from "@/components/data/live-dot";
import { type StatusTone, toneStyles } from "@/components/data/tones";
import type { LiveStatus } from "../api/live-stream";

type LiveStatusMeta = {
  label: string;
  description: string;
  tone: StatusTone;
};

const liveStatusMeta: Record<LiveStatus, LiveStatusMeta> = {
  connecting: {
    label: "Connecting",
    description: "Connecting to live updates",
    tone: "neutral",
  },
  live: {
    label: "Live",
    description: "Changes appear automatically",
    tone: "success",
  },
  reconnecting: {
    label: "Reconnecting",
    description: "Live updates are interrupted, retrying",
    tone: "warning",
  },
  paused: {
    label: "Paused",
    description: "Live updates resume when you return to this tab",
    tone: "neutral",
  },
};

export const LiveIndicator = ({ status }: { status: LiveStatus }) => {
  const meta = liveStatusMeta[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <output
          aria-label={`Live updates: ${meta.label}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
            toneStyles[meta.tone].text,
          )}
        >
          <LiveDot isLive={status === "live"} />
          {meta.label}
        </output>
      </TooltipTrigger>
      <TooltipContent>{meta.description}</TooltipContent>
    </Tooltip>
  );
};
