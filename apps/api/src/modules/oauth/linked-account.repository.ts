import type { OAuthProvider } from "@pulse/contracts";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { linkedAccounts } from "../../models/index.ts";

type NewLinkedAccount = {
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
};

export const findLinkedAccountByProviderAccount = async (
  provider: OAuthProvider,
  providerAccountId: string,
) => {
  const [account] = await db
    .select()
    .from(linkedAccounts)
    .where(
      and(
        eq(linkedAccounts.provider, provider),
        eq(linkedAccounts.providerAccountId, providerAccountId),
      ),
    );
  return account;
};

export const listLinkedAccounts = (userId: string) =>
  db
    .select({
      provider: linkedAccounts.provider,
      email: linkedAccounts.email,
      linkedAt: linkedAccounts.linkedAt,
    })
    .from(linkedAccounts)
    .where(eq(linkedAccounts.userId, userId))
    .orderBy(asc(linkedAccounts.linkedAt));

export const countLinkedAccounts = async (userId: string) => {
  const [result] = await db
    .select({ total: count() })
    .from(linkedAccounts)
    .where(eq(linkedAccounts.userId, userId));
  return result?.total ?? 0;
};

export const saveLinkedAccount = async (values: NewLinkedAccount) => {
  await db
    .insert(linkedAccounts)
    .values(values)
    .onConflictDoUpdate({
      target: [linkedAccounts.userId, linkedAccounts.provider],
      set: {
        providerAccountId: values.providerAccountId,
        email: values.email,
        linkedAt: new Date(),
      },
    });
};

export const deleteLinkedAccount = async (
  userId: string,
  provider: OAuthProvider,
) => {
  const [account] = await db
    .delete(linkedAccounts)
    .where(
      and(
        eq(linkedAccounts.userId, userId),
        eq(linkedAccounts.provider, provider),
      ),
    )
    .returning({ provider: linkedAccounts.provider });
  return account;
};
