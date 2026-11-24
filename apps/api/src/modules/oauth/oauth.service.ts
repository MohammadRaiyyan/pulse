import { createHash } from "node:crypto";
import {
  DEFAULT_SIGNUP_ROLE,
  type OAuthCallbackInput,
  type OAuthIntent,
  type OAuthProvider,
} from "@pulse/contracts";
import { AppError, unauthorized } from "../../lib/errors.ts";
import { redis } from "../../lib/redis.ts";
import { generateToken } from "../../security/tokens.ts";
import { startSession } from "../auth/auth.service.ts";
import {
  countUsers,
  findUserByEmail,
  findUserById,
  insertUser,
} from "../users/user.repository.ts";
import {
  findLinkedAccountByProviderAccount,
  saveLinkedAccount,
} from "./linked-account.repository.ts";
import {
  type OAuthProfile,
  callbackUrlFor,
  fetchProfile,
  providerConfigs,
} from "./oauth-providers.ts";

const STATE_TTL_SECONDS = 600;

type StoredState = {
  provider: OAuthProvider;
  intent: OAuthIntent;
  redirectTo: string;
  codeVerifier: string;
  userId: string | null;
};

const stateKey = (state: string) => `oauth:state:${state}`;

const defaultRedirect: Record<OAuthIntent, string> = {
  "sign-in": "/",
  link: "/settings",
};

const assertConfigured = (provider: OAuthProvider) => {
  if (
    !providerConfigs[provider].clientId ||
    !providerConfigs[provider].clientSecret
  ) {
    throw new AppError(
      "NOT_FOUND",
      `Sign-in with ${provider} is not configured on this server`,
    );
  }
};

const toCodeChallenge = (codeVerifier: string) =>
  createHash("sha256").update(codeVerifier).digest("base64url");

export const createAuthorizationUrl = async (
  provider: OAuthProvider,
  intent: OAuthIntent,
  redirectTo: string | undefined,
  userId: string | null,
) => {
  assertConfigured(provider);

  const state = generateToken();
  const codeVerifier = generateToken();
  const storedState: StoredState = {
    provider,
    intent,
    redirectTo: redirectTo ?? defaultRedirect[intent],
    codeVerifier,
    userId,
  };

  await redis.set(
    stateKey(state),
    JSON.stringify(storedState),
    "EX",
    STATE_TTL_SECONDS,
  );

  const config = providerConfigs[provider];
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", callbackUrlFor(provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", toCodeChallenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");

  return url.href;
};

const linkToExistingUser = async (
  userId: string,
  provider: OAuthProvider,
  profile: OAuthProfile,
) => {
  const user = await findUserById(userId);

  if (!user) {
    throw unauthorized("Sign in again to connect this account");
  }

  await saveLinkedAccount({ userId, provider, ...profile });

  return user;
};

const findOrCreateUser = async (
  provider: OAuthProvider,
  profile: OAuthProfile,
) => {
  const linked = await findLinkedAccountByProviderAccount(
    provider,
    profile.providerAccountId,
  );
  const linkedUser = linked ? await findUserById(linked.userId) : undefined;

  if (linkedUser) {
    return linkedUser;
  }

  const existingUser = await findUserByEmail(profile.email);
  const isFirstUser = (await countUsers()) === 0;

  const user =
    existingUser ??
    (await insertUser({
      name: profile.name,
      email: profile.email,
      role: isFirstUser ? "owner" : DEFAULT_SIGNUP_ROLE,
      passwordHash: null,
    }));

  await saveLinkedAccount({ userId: user.id, provider, ...profile });

  return user;
};

export const completeOAuth = async (
  provider: OAuthProvider,
  input: OAuthCallbackInput,
) => {
  const rawState = await redis.getdel(stateKey(input.state));
  const state = rawState ? (JSON.parse(rawState) as StoredState) : null;

  if (!state || state.provider !== provider) {
    throw unauthorized("OAuth state or code is invalid");
  }

  const profile = await fetchProfile(provider, input.code, state.codeVerifier);

  const user =
    state.intent === "link" && state.userId
      ? await linkToExistingUser(state.userId, provider, profile)
      : await findOrCreateUser(provider, profile);

  const session = await startSession(user);

  return { ...session, redirectTo: state.redirectTo };
};
