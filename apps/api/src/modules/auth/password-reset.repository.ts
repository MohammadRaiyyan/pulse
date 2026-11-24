import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { passwordResetTokens, sessions, users } from "../../models/index.ts";

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
  tokenId: string,
  userId: string,
  passwordHash: string,
) =>
  db.transaction(async (tx) => {
    const now = new Date();

    await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, tokenId));
    await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
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
