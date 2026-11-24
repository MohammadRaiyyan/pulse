import { createHash } from "node:crypto";
import type {
  OAuthCallbackInput,
  OAuthIntent,
  OAuthProvider,
} from "@pulse/contracts";
import { env } from "../../config/env.ts";
import { AppError, forbidden, unauthorized } from "../../lib/errors.ts";
import { redis } from "../../lib/redis.ts";
import { OAUTH_NONCE_TTL_SECONDS } from "../../security/oauth-nonce-cookie.ts";
import { generateToken, hashToken } from "../../security/tokens.ts";
import { startSession } from "../auth/auth.service.ts";
import {
  findUserByEmail,
  findUserById,
  insertFirstUserAsOwner,
} from "../users/user.repository.ts";
import {
  findLinkedAccountByProviderAccount,
  saveLinkedAccount,
} from "./linked-account.repository.ts";
import {
  type OAuthProfile,
  callbackUrlFor,
  fetchProfile,
  isProviderConfigured,
  providerConfigs,
} from "./oauth-providers.ts";

type StoredState = {
  provider: OAuthProvider;
  intent: OAuthIntent;
  redirectTo: string;
  codeVerifier: string;
  nonceHash: string;
  userId: string | null;
};

const stateKey = (state: string) => `oauth:state:${state}`;

const defaultRedirect: Record<OAuthIntent, string> = {
  "sign-in": "/",
  link: "/settings",
};

const assertConfigured = (provider: OAuthProvider) => {
  if (!isProviderConfigured(provider)) {
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
  const nonce = generateToken();
  const storedState: StoredState = {
    provider,
    intent,
    redirectTo: redirectTo ?? defaultRedirect[intent],
    codeVerifier,
    nonceHash: hashToken(nonce),
    userId,
  };

  await redis.set(
    stateKey(state),
    JSON.stringify(storedState),
    "EX",
    OAUTH_NONCE_TTL_SECONDS,
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

  return { authorizationUrl: url.href, nonce };
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

const createOwnerFromProfile = async (profile: OAuthProfile) => {
  const owner = env.OWNER_SIGNUP_ENABLED
    ? await insertFirstUserAsOwner({
        name: profile.name,
        email: profile.email,
        passwordHash: null,
        emailVerifiedAt: new Date(),
      })
    : undefined;

  if (!owner) {
    throw forbidden(
      `No Pulse account uses ${profile.email}. Pulse is invite-only, so ask a workspace admin to send you an invitation.`,
    );
  }

  return owner;
};

const findUserForProfile = async (
  provider: OAuthProvider,
  profile: OAuthProfile,
) => {
  const existingUser = await findUserByEmail(profile.email);

  if (!existingUser) {
    return createOwnerFromProfile(profile);
  }

  if (!existingUser.emailVerifiedAt) {
    throw forbidden(
      `The Pulse account for ${profile.email} has not verified its email yet. Sign in with your password, verify your email, then connect ${providerConfigs[provider].label} from account settings.`,
    );
  }

  return existingUser;
};

const signInWithProvider = async (
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

  const user = await findUserForProfile(provider, profile);

  await saveLinkedAccount({ userId: user.id, provider, ...profile });

  return user;
};

const invalidState = () => unauthorized("OAuth state or code is invalid");

export const completeOAuth = async (
  provider: OAuthProvider,
  input: OAuthCallbackInput,
  nonce: string | undefined,
) => {
  const rawState = await redis.getdel(stateKey(input.state));
  const state = rawState ? (JSON.parse(rawState) as StoredState) : null;

  if (!state || state.provider !== provider) {
    throw invalidState();
  }

  if (!nonce || hashToken(nonce) !== state.nonceHash) {
    throw invalidState();
  }

  const profile = await fetchProfile(provider, input.code, state.codeVerifier);

  const user =
    state.intent === "link" && state.userId
      ? await linkToExistingUser(state.userId, provider, profile)
      : await signInWithProvider(provider, profile);

  const session = await startSession(user);

  return { ...session, redirectTo: state.redirectTo };
};
