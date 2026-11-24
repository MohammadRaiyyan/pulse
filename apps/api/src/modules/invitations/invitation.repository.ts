import type { AssignableRole, InvitationStatus } from "@pulse/contracts";
import { and, count, desc, eq, gt, lte, or } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { invitations, users } from "../../models/index.ts";
import { userColumns } from "../users/user.repository.ts";

const invitationColumns = {
  id: invitations.id,
  email: invitations.email,
  role: invitations.role,
  status: invitations.status,
  invitedBy: {
    id: users.id,
    name: users.name,
  },
  expiresAt: invitations.expiresAt,
  createdAt: invitations.createdAt,
};

type NewInvitation = {
  email: string;
  role: AssignableRole;
  invitedBy: string;
  expiresAt: Date;
};

type NewMember = {
  name: string;
  passwordHash: string;
};

const isPending = () =>
  and(eq(invitations.status, "pending"), gt(invitations.expiresAt, new Date()));

const statusFilter = (status: InvitationStatus | undefined) => {
  if (status === "pending") {
    return isPending();
  }

  if (status === "expired") {
    return or(
      eq(invitations.status, "expired"),
      and(
        eq(invitations.status, "pending"),
        lte(invitations.expiresAt, new Date()),
      ),
    );
  }

  return status ? eq(invitations.status, status) : undefined;
};

export const listInvitations = async (
  status: InvitationStatus | undefined,
  limit: number,
  offset: number,
) => {
  const where = statusFilter(status);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(invitationColumns)
      .from(invitations)
      .innerJoin(users, eq(users.id, invitations.invitedBy))
      .where(where)
      .orderBy(desc(invitations.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(invitations).where(where),
  ]);

  return { rows, total: totalRow?.total ?? 0 };
};

export const findInvitation = async (id: string) => {
  const [invitation] = await db
    .select(invitationColumns)
    .from(invitations)
    .innerJoin(users, eq(users.id, invitations.invitedBy))
    .where(eq(invitations.id, id));
  return invitation;
};

export const insertInvitation = (values: NewInvitation) =>
  db.transaction(async (tx) => {
    await tx
      .update(invitations)
      .set({ status: "expired" })
      .where(
        and(
          eq(invitations.email, values.email),
          eq(invitations.status, "pending"),
          lte(invitations.expiresAt, new Date()),
        ),
      );

    const [invitation] = await tx
      .insert(invitations)
      .values(values)
      .returning();

    if (!invitation) {
      throw new Error("Failed to insert invitation");
    }

    return invitation;
  });

export const revokePendingInvitation = async (id: string) => {
  const [invitation] = await db
    .update(invitations)
    .set({ status: "revoked" })
    .where(and(eq(invitations.id, id), isPending()))
    .returning({ id: invitations.id });
  return invitation;
};

export const acceptPendingInvitation = (
  invitationId: string,
  member: NewMember,
) =>
  db.transaction(async (tx) => {
    const [invitation] = await tx
      .update(invitations)
      .set({ status: "accepted" })
      .where(and(eq(invitations.id, invitationId), isPending()))
      .returning();

    if (!invitation) {
      return undefined;
    }

    const [user] = await tx
      .insert(users)
      .values({
        name: member.name,
        email: invitation.email,
        role: invitation.role,
        passwordHash: member.passwordHash,
        emailVerifiedAt: new Date(),
      })
      .returning(userColumns);

    return user;
  });
