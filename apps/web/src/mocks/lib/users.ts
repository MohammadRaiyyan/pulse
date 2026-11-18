import type { User } from "@pulse/contracts";
import { db } from "../db";
import { newId } from "./ids";
import { errorResponse } from "./responses";
import { now } from "./time";

type NewUser = Pick<User, "name" | "email" | "role"> & { password: string };

export const findUserByEmail = (email: string) =>
  [...db.users.values()].find((user) => user.email === email);

export const assertEmailAvailable = (email: string, exceptUserId?: string) => {
  const owner = findUserByEmail(email);

  if (owner && owner.id !== exceptUserId) {
    throw errorResponse("CONFLICT", "Email already in use", {
      fieldErrors: { email: ["An account with this email already exists"] },
    });
  }
};

export const verifyPassword = (userId: string, password: string) =>
  db.passwords.get(userId) === password;

export const setPassword = (userId: string, password: string) => {
  db.passwords.set(userId, password);
};

export const createUser = ({ password, ...profile }: NewUser) => {
  assertEmailAvailable(profile.email);
  const user: User = { ...profile, id: newId(), createdAt: now() };
  db.users.set(user.id, user);
  setPassword(user.id, password);

  return user;
};

export const deleteUser = (userId: string) => {
  db.users.delete(userId);
  db.passwords.delete(userId);
  db.linkedAccounts.delete(userId);
};
