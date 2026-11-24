import { and, eq, gt, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { emailVerificationTokens, users } from "../../models/index.ts";
import { userColumns } from "../users/user.repository.ts";

type NewEmailVerificationToken = {
  userId: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
};

export const insertEmailVerificationToken = async (
  values: NewEmailVerificationToken,
) => {
  await db.insert(emailVerificationTokens).values(values);
};

export const consumeEmailVerificationToken = (tokenHash: string) =>
  db.transaction(async (tx) => {
    const now = new Date();

    const [token] = await tx
      .update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, tokenHash),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, now),
        ),
      )
      .returning({
        userId: emailVerificationTokens.userId,
        email: emailVerificationTokens.email,
      });

    if (!token) {
      return undefined;
    }

    const [user] = await tx
      .update(users)
      .set({ emailVerifiedAt: now })
      .where(
        and(
          eq(users.id, token.userId),
          sql`lower(${users.email}) = ${token.email.toLowerCase()}`,
        ),
      )
      .returning(userColumns);

    if (!user) {
      return undefined;
    }

    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(emailVerificationTokens.userId, user.id),
          isNull(emailVerificationTokens.usedAt),
        ),
      );

    return user;
  });

export const deleteUsedOrExpiredEmailVerificationTokens = async () => {
  await db
    .delete(emailVerificationTokens)
    .where(
      or(
        isNotNull(emailVerificationTokens.usedAt),
        lt(emailVerificationTokens.expiresAt, new Date()),
      ),
    );
};
