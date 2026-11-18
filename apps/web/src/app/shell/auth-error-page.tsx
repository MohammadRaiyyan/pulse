import type { ErrorComponentProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { AuthShell } from "./auth-layout";

type AuthErrorPageProps = Pick<ErrorComponentProps, "error"> & {
  children?: ReactNode;
};

export const AuthErrorPage = ({ error, children }: AuthErrorPageProps) => (
  <AuthShell>
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <ErrorState error={error} />
      {children}
    </div>
  </AuthShell>
);
