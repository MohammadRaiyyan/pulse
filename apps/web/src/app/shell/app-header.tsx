import { SidebarTrigger } from "@pulse/ui/components/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@pulse/ui/components/tooltip";
import { SystemStatusPill } from "@/features/dashboard/components/system-status-pill";
import type { LiveStatus } from "@/features/live-updates/api/live-stream";
import { LiveIndicator } from "@/features/live-updates/components/live-indicator";
import { ThemeToggle } from "./theme-toggle";

export const AppHeader = ({ liveStatus }: { liveStatus: LiveStatus }) => (
  <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/75 px-4 backdrop-blur-md">
    <Tooltip>
      <TooltipTrigger asChild>
        <SidebarTrigger className="size-9" />
      </TooltipTrigger>
      <TooltipContent>Toggle sidebar</TooltipContent>
    </Tooltip>
    <SystemStatusPill />
    <div className="ml-auto flex items-center gap-2">
      <LiveIndicator status={liveStatus} />
      <ThemeToggle />
    </div>
  </header>
);
