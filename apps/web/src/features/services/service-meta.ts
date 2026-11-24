import type { ServiceStatus } from "@pulse/contracts";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { StatusMeta } from "@/components/data/tones";

export const serviceStatusMeta: Record<ServiceStatus, StatusMeta> = {
  up: { label: "Operational", tone: "success", icon: CircleCheckIcon },
  degraded: {
    label: "Degraded performance",
    tone: "warning",
    icon: TriangleAlertIcon,
  },
  down: { label: "Outage", tone: "danger", icon: CircleXIcon },
  pending: { label: "Pending", tone: "neutral", icon: CircleDashedIcon },
  no_data: { label: "No data", tone: "neutral", icon: CircleDashedIcon },
};
