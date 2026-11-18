import { Button } from "@pulse/ui/components/button";
import {
  CircleAlertIcon,
  FileQuestionIcon,
  type LucideIcon,
  ShieldXIcon,
} from "lucide-react";
import {
  type ClientErrorCode,
  getErrorMessage,
  isApiError,
} from "@/lib/api/api-error";
import { EmptyState } from "./empty-state";

type ErrorPresentation = {
  icon: LucideIcon;
  title: string;
  isRetryable: boolean;
};

const DEFAULT_PRESENTATION: ErrorPresentation = {
  icon: CircleAlertIcon,
  title: "Something went wrong",
  isRetryable: true,
};

const presentations: Partial<Record<ClientErrorCode, ErrorPresentation>> = {
  FORBIDDEN: {
    icon: ShieldXIcon,
    title: "You don't have access",
    isRetryable: false,
  },
  NOT_FOUND: { icon: FileQuestionIcon, title: "Not found", isRetryable: false },
};

const getPresentation = (error: unknown) =>
  (isApiError(error) && presentations[error.code]) || DEFAULT_PRESENTATION;

type ErrorStateProps = {
  error: unknown;
  onRetry?: () => void;
};

export const ErrorState = ({ error, onRetry }: ErrorStateProps) => {
  const { icon, title, isRetryable } = getPresentation(error);

  return (
    <EmptyState
      icon={icon}
      title={title}
      description={getErrorMessage(error)}
      action={
        onRetry && isRetryable ? (
          <Button variant="outline" onClick={onRetry}>
            Try again
          </Button>
        ) : null
      }
    />
  );
};
