import type { OAuthProvider } from "@pulse/contracts";
import { env } from "../../config/env.ts";
import { unauthorized } from "../../lib/errors.ts";

export type OAuthProfile = {
  providerAccountId: string;
  email: string;
  name: string;
};

type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  scope: string;
};

export const providerConfigs: Record<OAuthProvider, ProviderConfig> = {
  github: {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    authorizeUrl: "https://github.com/login/oauth/authorize",
    scope: "read:user user:email",
  },
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile",
  },
};

export const callbackUrlFor = (provider: OAuthProvider) =>
  new URL(`/oauth/callback/${provider}`, env.APP_URL).href;

const readJson = async (response: Response) => {
  if (!response.ok) {
    throw unauthorized("OAuth state or code is invalid");
  }

  return (await response.json()) as Record<string, unknown>;
};

const fetchGithubProfile = async (
  code: string,
  codeVerifier: string,
): Promise<OAuthProfile> => {
  const config = providerConfigs.github;

  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: callbackUrlFor("github"),
        code_verifier: codeVerifier,
      }),
    },
  );
  const tokenBody = await readJson(tokenResponse);

  if (typeof tokenBody.access_token !== "string") {
    throw unauthorized("OAuth state or code is invalid");
  }

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${tokenBody.access_token}`,
    "User-Agent": "Pulse",
  };

  const user = await readJson(
    await fetch("https://api.github.com/user", { headers }),
  );
  const emailsResponse = await fetch("https://api.github.com/user/emails", {
    headers,
  });
  const emails = emailsResponse.ok
    ? ((await emailsResponse.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>)
    : [];
  const primaryEmail = emails.find((email) => email.primary && email.verified);

  if (!primaryEmail) {
    throw unauthorized("Your GitHub account has no verified primary email");
  }

  return {
    providerAccountId: String(user.id),
    email: primaryEmail.email.toLowerCase(),
    name: String(user.name ?? user.login ?? primaryEmail.email),
  };
};

const fetchGoogleProfile = async (
  code: string,
  codeVerifier: string,
): Promise<OAuthProfile> => {
  const config = providerConfigs.google;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: callbackUrlFor("google"),
    }),
  });
  const tokenBody = await readJson(tokenResponse);

  if (typeof tokenBody.access_token !== "string") {
    throw unauthorized("OAuth state or code is invalid");
  }

  const profile = await readJson(
    await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    }),
  );

  if (profile.email_verified !== true || typeof profile.email !== "string") {
    throw unauthorized("Your Google account has no verified email");
  }

  return {
    providerAccountId: String(profile.sub),
    email: profile.email.toLowerCase(),
    name: String(profile.name ?? profile.email),
  };
};

export const fetchProfile = (
  provider: OAuthProvider,
  code: string,
  codeVerifier: string,
) =>
  provider === "github"
    ? fetchGithubProfile(code, codeVerifier)
    : fetchGoogleProfile(code, codeVerifier);
