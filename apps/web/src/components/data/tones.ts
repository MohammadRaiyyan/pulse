import type { LucideIcon } from "lucide-react";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

export type StatusMeta = {
  label: string;
  tone: StatusTone;
  icon?: LucideIcon;
};

type ToneStyle = {
  soft: string;
  solid: string;
  text: string;
};

export const toneStyles: Record<StatusTone, ToneStyle> = {
  success: {
    soft: "bg-success/12 text-success",
    solid: "bg-success",
    text: "text-success",
  },
  warning: {
    soft: "bg-warning/14 text-warning",
    solid: "bg-warning",
    text: "text-warning",
  },
  danger: {
    soft: "bg-destructive/12 text-destructive",
    solid: "bg-destructive",
    text: "text-destructive",
  },
  neutral: {
    soft: "bg-muted text-muted-foreground",
    solid: "bg-muted-foreground/40",
    text: "text-muted-foreground",
  },
  info: {
    soft: "bg-chart-2/14 text-chart-2",
    solid: "bg-chart-2",
    text: "text-chart-2",
  },
};
