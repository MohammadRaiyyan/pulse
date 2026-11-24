import { randomUUID } from "node:crypto";
import type {
  AuthConfig,
  LoginInput,
  OAuthProvider,
  RegisterInput,
  ResetPasswordInput,
} from "@pulse/contracts";
import { env } from "../../config/env.ts";
import { minutesFromNow } from "../../lib/dates.ts";
import {
  passwordChangedEmail,
  passwordResetEmail,
} from "../../lib/email-templates.ts";
import { AppError, forbidden, unauthorized } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { sendEmail, trySendEmail } from "../../lib/mailer.ts";
import { signAccessToken } from "../../security/access-token.ts";
import {
  burnPasswordCheckTime,
  hashPassword,
  verifyPassword,
} from "../../security/passwords.ts";
import { REFRESH_TOKEN_TTL_MS } from "../../security/refresh-cookie.ts";
import { rejectAccessTokensIssuedBeforeNow } from "../../security/session-revocation.ts";
import { generateToken, hashToken } from "../../security/tokens.ts";
import {
  configuredProviders,
  providerConfigs,
} from "../oauth/oauth-providers.ts";
import {
  type UserRecord,
  findUserByEmail,
  findUserById,
  findUserWithPasswordByEmail,
  hasAnyUser,
  insertFirstUserAsOwner,
} from "../users/user.repository.ts";
import { forgetCachedUser } from "../users/user.service.ts";
import { trySendVerificationEmail } from "./email-verification.service.ts";
import {
  completePasswordReset,
  findUsablePasswordResetToken,
  insertPasswordResetToken,
} from "./password-reset.repository.ts";
import {
  findSessionByTokenHash,
  insertSession,
  replaceSession,
  revokeAllUserSessions,
  revokeSessionByTokenHash,
  revokeSessionFamily,
} from "./session.repository.ts";

const RESET_TOKEN_TTL_MINUTES = 30;

export type SignedInSession = {
  accessToken: string;
  refreshToken: string;
  user: UserRecord;
};

const refreshTokenExpiry = () => new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

export const startSession = async (
  user: UserRecord,
): Promise<SignedInSession> => {
  const refreshToken = generateToken();

  await insertSession({
    userId: user.id,
    familyId: randomUUID(),
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshTokenExpiry(),
  });

  return { accessToken: await signAccessToken(user.id), refreshToken, user };
};

const signupClosed = () =>
  forbidden(
    "Pulse is invite-only. Ask a workspace admin to send you an invitation.",
  );

const isSignupOpen = async () =>
  env.OWNER_SIGNUP_ENABLED && !(await hasAnyUser());

export const getAuthConfig = async (): Promise<AuthConfig> => ({
  signupOpen: await isSignupOpen(),
  oauthProviders: configuredProviders(),
});

export const register = async (input: RegisterInput) => {
  if (!(await isSignupOpen())) {
    throw signupClosed();
  }

  const user = await insertFirstUserAsOwner({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
  });

  if (!user) {
    throw signupClosed();
  }

  await trySendVerificationEmail(user);

  return startSession(user);
};

export const login = async (input: LoginInput) => {
  const row = await findUserWithPasswordByEmail(input.email);

  if (!row || !row.passwordHash) {
    await burnPasswordCheckTime(input.password);
    throw unauthorized("Invalid email or password");
  }

  const isValid = await verifyPassword(row.passwordHash, input.password);

  if (!isValid) {
    throw unauthorized("Invalid email or password");
  }

  return startSession({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    emailVerifiedAt: row.emailVerifiedAt,
    createdAt: row.createdAt,
  });
};

export const refresh = async (
  refreshToken: string,
): Promise<SignedInSession | null> => {
  const session = await findSessionByTokenHash(hashToken(refreshToken));

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  if (session.revokedAt) {
    logger.warn(
      { userId: session.userId },
      "Refresh token reuse detected, revoking session family",
    );
    await revokeSessionFamily(session.familyId);
    return null;
  }

  const user = await findUserById(session.userId);

  if (!user) {
    return null;
  }

  const nextRefreshToken = generateToken();

  const isReplaced = await replaceSession(session.id, {
    userId: session.userId,
    familyId: session.familyId,
    tokenHash: hashToken(nextRefreshToken),
    expiresAt: refreshTokenExpiry(),
  });

  if (!isReplaced) {
    return null;
  }

  return {
    accessToken: await signAccessToken(user.id),
    refreshToken: nextRefreshToken,
    user,
  };
};

export const logout = async (refreshToken: string | undefined) => {
  if (refreshToken) {
    await revokeSessionByTokenHash(hashToken(refreshToken));
  }
};

export const logoutEverywhere = async (userId: string) => {
  await revokeAllUserSessions(userId);
  await rejectAccessTokensIssuedBeforeNow(userId);
};

export const requestPasswordReset = async (email: string) => {
  const user = await findUserByEmail(email);

  if (!user) {
    return;
  }

  const token = generateToken();
  await insertPasswordResetToken(
    user.id,
    hashToken(token),
    minutesFromNow(RESET_TOKEN_TTL_MINUTES),
  );

  const resetUrl = new URL("/reset-password", env.APP_URL);
  resetUrl.searchParams.set("token", token);

  const content = passwordResetEmail({
    resetUrl: resetUrl.href,
    expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
  });

  void sendEmail({ to: user.email, ...content }).catch((error: unknown) => {
    logger.error(
      { userId: user.id, err: error },
      "Password reset email could not be sent",
    );
  });
};

const invalidResetLink = () =>
  new AppError("NOT_FOUND", "This reset link is invalid or has expired");

export const resetPassword = async (input: ResetPasswordInput) => {
  const tokenHash = hashToken(input.token);

  if (!(await findUsablePasswordResetToken(tokenHash))) {
    throw invalidResetLink();
  }

  const user = await completePasswordReset(
    tokenHash,
    await hashPassword(input.password),
  );

  if (!user) {
    throw invalidResetLink();
  }

  await rejectAccessTokensIssuedBeforeNow(user.id);
  await forgetCachedUser(user.id);
  await sendPasswordChangedEmail(user.email, user.unlinkedProviders);
};

export const sendPasswordChangedEmail = (
  email: string,
  disconnectedProviders: OAuthProvider[] = [],
) =>
  trySendEmail({
    to: email,
    ...passwordChangedEmail({
      changedAt: new Date(),
      disconnectedProviders: disconnectedProviders.map(
        (provider) => providerConfigs[provider].label,
      ),
    }),
  });
