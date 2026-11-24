import type {
  ChangePasswordInput,
  OAuthProvider,
  UpdateProfileInput,
} from "@pulse/contracts";
import { badRequest, conflict, notFound } from "../../lib/errors.ts";
import { hashPassword, verifyPassword } from "../../security/passwords.ts";
import { rejectAccessTokensIssuedBeforeNow } from "../../security/session-revocation.ts";
import { startSession } from "../auth/auth.service.ts";
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

export const updateProfile = async (
  user: AuthUser,
  input: UpdateProfileInput,
) => {
  const updated = await updateUser(user.id, {
    name: input.name,
    email: input.email,
  });

  if (!updated) {
    throw notFound("User");
  }

  await forgetCachedUser(user.id);

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
