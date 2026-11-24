import type {
  PaginationQuery,
  TransferOwnershipInput,
  UpdateMemberInput,
} from "@pulse/contracts";
import {
  ownershipReceivedEmail,
  ownershipTransferredEmail,
} from "../../lib/email-templates.ts";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors.ts";
import { trySendEmail } from "../../lib/mailer.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import { publishChange } from "../../lib/realtime.ts";
import { verifyPassword } from "../../security/passwords.ts";
import {
  type UserRecord,
  deleteMember,
  findPasswordHash,
  findUserById,
  listUsers,
  transferOwnership as transferOwnershipInDatabase,
  updateMemberRole,
} from "../users/user.repository.ts";
import { type AuthUser, forgetCachedUser } from "../users/user.service.ts";

const LABEL = "Member";

const assertNotSelf = (actor: AuthUser, memberId: string) => {
  if (actor.id === memberId) {
    throw forbidden("You cannot change your own access");
  }
};

const explainBlockedChange = async (memberId: string) => {
  const member = await findUserById(memberId);

  if (!member) {
    return notFound(LABEL);
  }

  return member.role === "owner"
    ? forbidden("The workspace owner cannot be changed or removed")
    : forbidden("Only the workspace owner can change or remove an admin");
};

export const getMembers = async (query: PaginationQuery) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listUsers(limit, offset);
  return toPage(rows, total, query);
};

export const getMember = async (id: string) => {
  const member = await findUserById(id);

  if (!member) {
    throw notFound(LABEL);
  }

  return member;
};

export const changeMemberRole = async (
  actor: AuthUser,
  id: string,
  input: UpdateMemberInput,
) => {
  assertNotSelf(actor, id);

  const member = await updateMemberRole(id, input.role, actor.role);

  if (!member) {
    throw await explainBlockedChange(id);
  }

  await forgetCachedUser(id);
  publishChange({ type: "member.updated", id });

  return member;
};

const assertOwnerPassword = async (
  actor: AuthUser,
  currentPassword: string,
) => {
  const passwordHash = await findPasswordHash(actor.id);

  if (!passwordHash) {
    throw badRequest("Set a password before transferring ownership", {
      currentPassword: ["Set a password before transferring ownership"],
    });
  }

  if (!(await verifyPassword(passwordHash, currentPassword))) {
    throw badRequest("Current password is incorrect", {
      currentPassword: ["Current password is incorrect"],
    });
  }
};

const explainBlockedTransfer = async (targetId: string) => {
  const target = await findUserById(targetId);

  if (!target) {
    return notFound(LABEL);
  }

  if (!target.emailVerifiedAt) {
    return conflict(
      "Ownership can only go to a member with a verified email address",
    );
  }

  return conflict("Ownership was already transferred. Reload and try again.");
};

const sendOwnershipEmails = async (
  previousOwner: UserRecord,
  newOwner: UserRecord,
) => {
  const transferredAt = new Date();

  await Promise.all([
    trySendEmail({
      to: previousOwner.email,
      ...ownershipTransferredEmail({
        newOwnerName: newOwner.name,
        transferredAt,
      }),
    }),
    trySendEmail({
      to: newOwner.email,
      ...ownershipReceivedEmail({
        previousOwnerName: previousOwner.name,
        transferredAt,
      }),
    }),
  ]);
};

export const transferOwnership = async (
  actor: AuthUser,
  targetId: string,
  input: TransferOwnershipInput,
) => {
  if (actor.role !== "owner") {
    throw forbidden("Only the workspace owner can transfer ownership");
  }

  if (actor.id === targetId) {
    throw forbidden("You already own this workspace");
  }

  await assertOwnerPassword(actor, input.currentPassword);

  const transfer = await transferOwnershipInDatabase(actor.id, targetId);

  if (!transfer) {
    throw await explainBlockedTransfer(targetId);
  }

  const { previousOwner, newOwner } = transfer;

  await Promise.all([
    forgetCachedUser(previousOwner.id),
    forgetCachedUser(newOwner.id),
  ]);
  publishChange({ type: "member.updated", id: previousOwner.id });
  publishChange({ type: "member.updated", id: newOwner.id });
  await sendOwnershipEmails(previousOwner, newOwner);

  return transfer;
};

export const removeMember = async (actor: AuthUser, id: string) => {
  assertNotSelf(actor, id);

  const member = await deleteMember(id, actor.role);

  if (!member) {
    throw await explainBlockedChange(id);
  }

  await forgetCachedUser(id);
  publishChange({ type: "member.deleted", id });
};
