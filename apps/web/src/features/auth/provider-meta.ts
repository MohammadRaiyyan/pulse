import type { OAuthProvider } from "@pulse/contracts";
import type { ComponentType, SVGProps } from "react";
import { GitHubIcon, GoogleIcon } from "./components/provider-icons";

type ProviderMeta = {
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const providerMeta: Record<OAuthProvider, ProviderMeta> = {
  github: { label: "GitHub", icon: GitHubIcon },
  google: { label: "Google", icon: GoogleIcon },
};
