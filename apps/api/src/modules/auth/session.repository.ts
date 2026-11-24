import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { sessions } from "../../models/index.ts";

type NewSession = {
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
};

export const insertSession = async (values: NewSession) => {
  await db.insert(sessions).values(values);
};

export const findSessionByTokenHash = async (tokenHash: string) => {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash));
  return session;
};

export const replaceSession = (oldSessionId: string, next: NewSession) =>
  db.transaction(async (tx) => {
    const [revoked] = await tx
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(sessions.id, oldSessionId), isNull(sessions.revokedAt)))
      .returning({ id: sessions.id });

    if (!revoked) {
      return false;
    }

    await tx.insert(sessions).values(next);

    return true;
  });

export const revokeSessionByTokenHash = async (tokenHash: string) => {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
};

export const revokeSessionFamily = async (familyId: string) => {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));
};

export const revokeAllUserSessions = async (userId: string) => {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
};

export const deleteStaleSessions = async (olderThan: Date) => {
  await db
    .delete(sessions)
    .where(
      or(lt(sessions.expiresAt, new Date()), lt(sessions.revokedAt, olderThan)),
    );
};
