import { randomUUID } from "node:crypto";
import {
  DEFAULT_SIGNUP_ROLE,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@pulse/contracts";
import { env } from "../../config/env.ts";
import { minutesFromNow } from "../../lib/dates.ts";
import { AppError, unauthorized } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { signAccessToken } from "../../security/access-token.ts";
import {
  burnPasswordCheckTime,
  hashPassword,
  verifyPassword,
} from "../../security/passwords.ts";
import { REFRESH_TOKEN_TTL_MS } from "../../security/refresh-cookie.ts";
import { generateToken, hashToken } from "../../security/tokens.ts";
import {
  type UserRecord,
  countUsers,
  findUserByEmail,
  findUserById,
  findUserWithPasswordByEmail,
  insertUser,
} from "../users/user.repository.ts";
import { forgetCachedUser } from "../users/user.service.ts";
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

export const register = async (input: RegisterInput) => {
  const isFirstUser = (await countUsers()) === 0;

  const user = await insertUser({
    name: input.name,
    email: input.email,
    role: isFirstUser ? "owner" : DEFAULT_SIGNUP_ROLE,
    passwordHash: await hashPassword(input.password),
  });

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

  logger.info(
    { email, resetUrl: resetUrl.href },
    "Password reset link created",
  );
};

export const resetPassword = async (input: ResetPasswordInput) => {
  const token = await findUsablePasswordResetToken(hashToken(input.token));

  if (!token) {
    throw new AppError(
      "NOT_FOUND",
      "This reset link is invalid or has expired",
    );
  }

  await completePasswordReset(
    token.id,
    token.userId,
    await hashPassword(input.password),
  );
  await forgetCachedUser(token.userId);
};
