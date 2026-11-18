import { type OAuthProvider, buildPath } from "@pulse/contracts";

const appUrl = (path: string, query: Record<string, string> = {}) => {
  const url = new URL(path, window.location.origin);
  url.search = new URLSearchParams(query).toString();

  return url.href;
};

export const inviteUrlFor = (token: string) =>
  appUrl(buildPath("/invite/:token", { token }));

export const ingestUrlFor = (slug: string) =>
  appUrl(buildPath("/hooks/:slug", { slug }));

export const resetUrlFor = (token: string) =>
  appUrl("/reset-password", { token });

export const oauthCallbackUrlFor = (
  provider: OAuthProvider,
  query: { code: string; state: string },
) => appUrl(buildPath("/oauth/callback/:provider", { provider }), query);
