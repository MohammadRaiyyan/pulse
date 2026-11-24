import type { PublicStatus } from "@pulse/contracts";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { GlobeIcon } from "lucide-react";
import { ThemeToggle } from "@/app/shell/theme-toggle";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { SpinnerFallback } from "@/components/feedback/spinner-fallback";
import { publicStatusQuery } from "@/features/status-page/api/status-page-api";
import {
  PublicStatusShell,
  PublicStatusView,
} from "@/features/status-page/components/public-status-view";
import { hasErrorCode } from "@/lib/api/api-error";

const DEFAULT_TITLE = "Status";

type PublicStatusContentProps = {
  status: PublicStatus | undefined;
  isUnavailable: boolean;
  error: Error | null;
  onRetry: () => void;
};

const PublicStatusContent = ({
  status,
  isUnavailable,
  error,
  onRetry,
}: PublicStatusContentProps) => {
  if (isUnavailable) {
    return (
      <EmptyState
        icon={GlobeIcon}
        title="Status page unavailable"
        description="This status page has not been published."
      />
    );
  }

  if (status) {
    return <PublicStatusView status={status} />;
  }

  return error ? (
    <ErrorState error={error} onRetry={onRetry} />
  ) : (
    <SpinnerFallback />
  );
};

const PublicStatusPage = () => {
  const { data, error, refetch } = useQuery(publicStatusQuery);
  const isUnavailable = hasErrorCode(error, "NOT_FOUND");
  const status = isUnavailable ? undefined : data;

  return (
    <PublicStatusShell
      title={status?.title ?? DEFAULT_TITLE}
      description={status?.description}
      headerAction={<ThemeToggle />}
    >
      <PublicStatusContent
        status={status}
        isUnavailable={isUnavailable}
        error={error}
        onRetry={() => void refetch()}
      />
    </PublicStatusShell>
  );
};

export const Route = createFileRoute("/status")({
  component: PublicStatusPage,
});
