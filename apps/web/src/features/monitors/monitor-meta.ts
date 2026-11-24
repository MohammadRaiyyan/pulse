import {
  type MonitorStatus,
  type RequestContentType,
  httpMethodSchema,
  monitorStatusSchema,
} from "@pulse/contracts";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { StatusMeta, StatusTone } from "@/components/data/tones";
import { type Option, findOption, metaOptions, valueOptions } from "@/lib/options";

export const monitorStatusMeta: Record<MonitorStatus, StatusMeta> = {
  up: { label: "Up", tone: "success", icon: CircleCheckIcon },
  down: { label: "Down", tone: "danger", icon: CircleXIcon },
  degraded: { label: "Degraded", tone: "warning", icon: TriangleAlertIcon },
  pending: { label: "Pending", tone: "neutral", icon: CircleDashedIcon },
};

export const pausedMeta: StatusMeta = { label: "Paused", tone: "neutral" };

export const monitorStatusOptions = metaOptions(
  monitorStatusSchema.options,
  monitorStatusMeta,
);

export const httpMethodOptions = valueOptions(httpMethodSchema.options);

const UPTIME_HEALTHY_PERCENT = 99;
const UPTIME_WARNING_PERCENT = 95;

export const getUptimeTone = (percent: number | null): StatusTone => {
  if (percent === null) {
    return "neutral";
  }

  if (percent >= UPTIME_HEALTHY_PERCENT) {
    return "success";
  }

  return percent >= UPTIME_WARNING_PERCENT ? "warning" : "danger";
};

export const requestContentTypeOptions: Option<RequestContentType>[] = [
  { value: "application/json", label: "JSON" },
  { value: "application/x-www-form-urlencoded", label: "Form (URL encoded)" },
  { value: "text/plain", label: "Text" },
  { value: "application/xml", label: "XML (application/xml)" },
  { value: "text/xml", label: "XML (text/xml)" },
];

export const requestContentTypeLabel = (contentType: RequestContentType) =>
  findOption(requestContentTypeOptions, contentType)?.label ?? contentType;
