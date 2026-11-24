import {
  type AcceptInvitationInput,
  type CreateInvitationInput,
  INVITATION_TTL_DAYS,
  type InvitationListQuery,
  type InvitationStatus,
  resolveInvitationStatus,
} from "@pulse/contracts";
import { env } from "../../config/env.ts";
import { daysFromNow } from "../../lib/dates.ts";
import { AppError, conflict, notFound } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import { publishChange } from "../../lib/realtime.ts";
import { hashPassword } from "../../security/passwords.ts";
import { startSession } from "../auth/auth.service.ts";
import { findUserByEmail } from "../users/user.repository.ts";
import type { AuthUser } from "../users/user.service.ts";
import {
  acceptPendingInvitation,
  findInvitation,
  insertInvitation,
  listInvitations,
  revokePendingInvitation,
} from "./invitation.repository.ts";
import {
  createInvitationToken,
  readInvitationToken,
} from "./invitation-token.ts";

const LABEL = "Invitation";

type StoredInvitation = {
  id: string;
  status: InvitationStatus;
  expiresAt: Date;
};

export const inviteUrlFor = (invitationId: string) =>
  new URL(`/invite/${createInvitationToken(invitationId)}`, env.APP_URL).href;

const withPublicFields = <TInvitation extends StoredInvitation>(
  invitation: TInvitation,
) => ({
  ...invitation,
  status: resolveInvitationStatus(
    {
      status: invitation.status,
      expiresAt: invitation.expiresAt.toISOString(),
    },
    new Date().toISOString(),
  ),
  inviteUrl: inviteUrlFor(invitation.id),
});

const invalidInvitation = () =>
  new AppError("NOT_FOUND", "This invitation is invalid or has expired");

const findPendingInvitationByToken = async (token: string) => {
  const invitationId = readInvitationToken(token);
  const invitation = invitationId
    ? await findInvitation(invitationId)
    : undefined;

  if (!invitation || withPublicFields(invitation).status !== "pending") {
    throw invalidInvitation();
  }

  return invitation;
};

export const getInvitations = async (query: InvitationListQuery) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listInvitations(query.status, limit, offset);
  return toPage(rows.map(withPublicFields), total, query);
};

export const getInvitation = async (id: string) => {
  const invitation = await findInvitation(id);

  if (!invitation) {
    throw notFound(LABEL);
  }

  return withPublicFields(invitation);
};

export const createInvitation = async (
  inviter: AuthUser,
  input: CreateInvitationInput,
) => {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    throw conflict("Email already in use", {
      email: ["An account with this email already exists"],
    });
  }

  const invitation = await insertInvitation({
    email: input.email,
    role: input.role,
    invitedBy: inviter.id,
    expiresAt: daysFromNow(INVITATION_TTL_DAYS),
  });

  const created = {
    ...withPublicFields(invitation),
    invitedBy: { id: inviter.id, name: inviter.name },
  };

  logger.info(
    { email: created.email, inviteUrl: created.inviteUrl },
    "Invitation created",
  );
  publishChange({ type: "invitation.updated", id: created.id });

  return created;
};

export const revokeInvitation = async (id: string) => {
  const revoked = await revokePendingInvitation(id);

  if (!revoked) {
    const current = await getInvitation(id);
    throw conflict(`Cannot revoke an invitation that is ${current.status}`);
  }

  publishChange({ type: "invitation.updated", id });
};

export const previewInvitation = async (token: string) => {
  const invitation = await findPendingInvitationByToken(token);

  return {
    email: invitation.email,
    role: invitation.role,
    invitedBy: invitation.invitedBy,
    expiresAt: invitation.expiresAt,
  };
};

export const acceptInvitationWithToken = async (
  input: AcceptInvitationInput,
) => {
  const invitationId = readInvitationToken(input.token);

  const user = invitationId
    ? await acceptPendingInvitation(invitationId, {
        name: input.name,
        passwordHash: await hashPassword(input.password),
      })
    : undefined;

  if (!user) {
    throw invalidInvitation();
  }

  publishChange({ type: "member.updated", id: user.id });

  return startSession(user);
};
