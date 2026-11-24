import type {
  ChangePasswordInput,
  OAuthProvider,
  UpdateProfileInput,
} from "@pulse/contracts";
import { badRequest, conflict, notFound } from "../../lib/errors.ts";
import { publishChange } from "../../lib/realtime.ts";
import { hashPassword, verifyPassword } from "../../security/passwords.ts";
import { rejectAccessTokensIssuedBeforeNow } from "../../security/session-revocation.ts";
import { startSession } from "../auth/auth.service.ts";
import {
  resendVerificationEmail,
  trySendVerificationEmail,
} from "../auth/email-verification.service.ts";
import { revokeAllUserSessions } from "../auth/session.repository.ts";
import {
  countLinkedAccounts,
  deleteLinkedAccount,
  listLinkedAccounts,
} from "../oauth/linked-account.repository.ts";
import { findPasswordHash, updateUser } from "../users/user.repository.ts";
import { type AuthUser, forgetCachedUser } from "../users/user.service.ts";

const incorrectPassword = () =>
  badRequest("Current password is incorrect", {
    currentPassword: ["Current password is incorrect"],
  });

const assertCanChangeEmail = async (
  user: AuthUser,
  currentPassword: string | undefined,
) => {
  const passwordHash = await findPasswordHash(user.id);

  if (!passwordHash) {
    throw badRequest("Set a password before changing your email", {
      currentPassword: ["Set a password before changing your email"],
    });
  }

  if (!currentPassword) {
    throw badRequest("Enter your current password to change your email", {
      currentPassword: ["Enter your current password to change your email"],
    });
  }

  if (!(await verifyPassword(passwordHash, currentPassword))) {
    throw incorrectPassword();
  }
};

export const updateProfile = async (
  user: AuthUser,
  input: UpdateProfileInput,
) => {
  const isEmailChange = input.email !== user.email.toLowerCase();

  if (isEmailChange) {
    await assertCanChangeEmail(user, input.currentPassword);
  }

  const updated = await updateUser(user.id, {
    name: input.name,
    email: input.email,
    ...(isEmailChange ? { emailVerifiedAt: null } : {}),
  });

  if (!updated) {
    throw notFound("User");
  }

  await forgetCachedUser(user.id);
  publishChange({ type: "member.updated", id: user.id });

  if (isEmailChange) {
    await trySendVerificationEmail(updated);
  }

  return updated;
};

export const changePassword = async (
  user: AuthUser,
  input: ChangePasswordInput,
) => {
  const passwordHash = await findPasswordHash(user.id);
  const isValid = passwordHash
    ? await verifyPassword(passwordHash, input.currentPassword)
    : false;

  if (!isValid) {
    throw incorrectPassword();
  }

  const updated = await updateUser(user.id, {
    passwordHash: await hashPassword(input.newPassword),
  });

  if (!updated) {
    throw notFound("User");
  }

  await revokeAllUserSessions(user.id);
  await rejectAccessTokensIssuedBeforeNow(user.id);

  return startSession(updated);
};

export const getConnections = (user: AuthUser) => listLinkedAccounts(user.id);

export const disconnectProvider = async (
  user: AuthUser,
  provider: OAuthProvider,
) => {
  const [passwordHash, linkedCount] = await Promise.all([
    findPasswordHash(user.id),
    countLinkedAccounts(user.id),
  ]);

  if (!passwordHash && linkedCount <= 1) {
    throw conflict(
      "Set a password before disconnecting your only sign-in method",
    );
  }

  const removed = await deleteLinkedAccount(user.id, provider);

  if (!removed) {
    throw notFound("Connection");
  }
};

export const resendEmailVerification = (user: AuthUser) =>
  resendVerificationEmail(user);
