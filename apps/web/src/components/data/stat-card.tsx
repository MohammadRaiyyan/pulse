import { cn } from "@pulse/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { type StatusTone, toneStyles } from "./tones";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: StatusTone;
};

export const StatCard = ({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: StatCardProps) => (
  <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "flex size-7 items-center justify-center rounded-md",
          toneStyles[tone].soft,
        )}
      >
        <Icon className="size-3.5" />
      </span>
    </div>
    <div className="flex flex-col gap-1">
      <span className="font-heading text-[26px] leading-none font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  </div>
);
