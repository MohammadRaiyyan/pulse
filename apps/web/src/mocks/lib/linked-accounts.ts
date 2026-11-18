import type { OAuthProvider, User } from "@pulse/contracts";
import { db } from "../db";
import { now } from "./time";

export const linkedAccountsOf = (userId: string) =>
  db.linkedAccounts.get(userId) ?? [];

export const unlinkProvider = (userId: string, provider: OAuthProvider) => {
  db.linkedAccounts.set(
    userId,
    linkedAccountsOf(userId).filter((account) => account.provider !== provider),
  );
};

export const linkProvider = (
  userId: string,
  provider: OAuthProvider,
  email: string,
) => {
  unlinkProvider(userId, provider);
  db.linkedAccounts.set(userId, [
    ...linkedAccountsOf(userId),
    { provider, email, linkedAt: now() },
  ]);
};

export const findLinkedUser = (provider: OAuthProvider, email: string) =>
  [...db.linkedAccounts.entries()]
    .filter(([, accounts]) =>
      accounts.some(
        (account) => account.provider === provider && account.email === email,
      ),
    )
    .map(([userId]) => db.users.get(userId))
    .find((user): user is User => user !== undefined);
