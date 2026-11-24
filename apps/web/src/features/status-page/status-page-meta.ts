import type { OverallStatus, PublicIncidentState } from "@pulse/contracts";
import {
  CircleCheckIcon,
  CircleXIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { StatusMeta } from "@/components/data/tones";

export const overallStatusMeta: Record<OverallStatus, StatusMeta> = {
  operational: {
    label: "All systems operational",
    tone: "success",
    icon: CircleCheckIcon,
  },
  degraded: {
    label: "Degraded performance",
    tone: "warning",
    icon: TriangleAlertIcon,
  },
  partial_outage: {
    label: "Partial outage",
    tone: "danger",
    icon: OctagonAlertIcon,
  },
  major_outage: { label: "Major outage", tone: "danger", icon: CircleXIcon },
};

export const publicIncidentStateMeta: Record<PublicIncidentState, StatusMeta> =
  {
    investigating: { label: "Investigating", tone: "danger" },
    identified: { label: "Identified", tone: "warning" },
    resolved: { label: "Resolved", tone: "success" },
  };
