import type { ReactNode } from "react";
import { useAuthConfig } from "../hooks/use-auth-config";
import { AuthDivider } from "./auth-divider";
import { OAuthButtons } from "./oauth-buttons";

type SocialSignInProps = {
  redirectTo?: string;
  children: ReactNode;
};

export const SocialSignIn = ({ redirectTo, children }: SocialSignInProps) => {
  const { oauthProviders } = useAuthConfig();

  if (oauthProviders.length === 0) {
    return children;
  }

  return (
    <div className="flex flex-col gap-4">
      <OAuthButtons providers={oauthProviders} redirectTo={redirectTo} />
      <AuthDivider label="or with email" />
      {children}
    </div>
  );
};
