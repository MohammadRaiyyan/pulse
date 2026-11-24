import { StatusBadge } from "@/components/data/status-badge";

export const VisibilityBadge = ({ isPublic }: { isPublic: boolean }) =>
  isPublic ? (
    <StatusBadge label="Public" tone="info" />
  ) : (
    <StatusBadge label="Private" tone="neutral" />
  );
