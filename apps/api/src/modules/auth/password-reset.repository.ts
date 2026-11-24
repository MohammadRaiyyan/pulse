import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "../../db/client.ts";
import {
  linkedAccounts,
  passwordResetTokens,
  sessions,
  users,
} from "../../models/index.ts";

export const insertPasswordResetToken = async (
  userId: string,
  tokenHash: string,
  expiresAt: Date,
) => {
  await db.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
};

export const findUsablePasswordResetToken = async (tokenHash: string) => {
  const [token] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    );
  return token;
};

export const completePasswordReset = (
  tokenHash: string,
  passwordHash: string,
) =>
  db.transaction(async (tx) => {
    const now = new Date();

    const [token] = await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .returning({ userId: passwordResetTokens.userId });

    if (!token) {
      return undefined;
    }

    const [user] = await tx
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, token.userId))
      .returning({ id: users.id, email: users.email });

    if (!user) {
      return undefined;
    }

    const unlinked = await tx
      .delete(linkedAccounts)
      .where(eq(linkedAccounts.userId, token.userId))
      .returning({ provider: linkedAccounts.provider });
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, token.userId),
          isNull(passwordResetTokens.usedAt),
        ),
      );
    await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(eq(sessions.userId, token.userId), isNull(sessions.revokedAt)),
      );

    return {
      ...user,
      unlinkedProviders: unlinked.map((account) => account.provider),
    };
  });

export const deleteUsedOrExpiredResetTokens = async () => {
  await db
    .delete(passwordResetTokens)
    .where(
      or(
        isNotNull(passwordResetTokens.usedAt),
        lt(passwordResetTokens.expiresAt, new Date()),
      ),
    );
};
