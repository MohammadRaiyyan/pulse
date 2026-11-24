import type { OverallStatus } from "@pulse/contracts";
import { cn } from "@pulse/ui/lib/utils";
import { CircleCheckIcon } from "lucide-react";
import { toneStyles } from "@/components/data/tones";
import { overallStatusMeta } from "../status-page-meta";

export const OverallStatusBanner = ({ status }: { status: OverallStatus }) => {
  const { label, tone, icon: Icon = CircleCheckIcon } = overallStatusMeta[status];

  return (
    <div
      aria-live="polite"
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-4 text-base font-semibold sm:text-lg",
        toneStyles[tone].soft,
      )}
    >
      <Icon className="size-6 shrink-0" aria-hidden />
      {label}
    </div>
  );
};
