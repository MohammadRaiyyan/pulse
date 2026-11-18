import type { ReactNode } from "react";
import { AuthDivider } from "./auth-divider";
import { OAuthButtons } from "./oauth-buttons";

type SocialSignInProps = {
  redirectTo?: string;
  children: ReactNode;
};

export const SocialSignIn = ({ redirectTo, children }: SocialSignInProps) => (
  <div className="flex flex-col gap-4">
    <OAuthButtons redirectTo={redirectTo} />
    <AuthDivider label="or with email" />
    {children}
  </div>
);
