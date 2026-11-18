import {
  type CreateInvitationInput,
  INVITATION_TTL_DAYS,
  type Invitation,
  type User,
  defineEndpoint,
  endpoints,
  itemPath,
  resolveInvitationStatus,
  resources,
} from "@pulse/contracts";
import { db } from "../db";
import { inviteUrlFor } from "../lib/app-url";
import { findById, matchesStatus } from "../lib/collection";
import { crudHandlers } from "../lib/crud";
import { newId } from "../lib/ids";
import { getParam } from "../lib/request";
import { errorResponse, noContent } from "../lib/responses";
import { route } from "../lib/route";
import { authResponse, withSession } from "../lib/session";
import { daysFromNow, now } from "../lib/time";
import { assertEmailAvailable, createUser } from "../lib/users";

const LABEL = "Invitation";

const withResolvedStatus = (invitation: Invitation): Invitation => ({
  ...invitation,
  status: resolveInvitationStatus(invitation, now()),
});

const isPending = (invitation: Invitation) =>
  withResolvedStatus(invitation).status === "pending";

const findPendingInvitation = (token: string) => {
  const inviteUrl = inviteUrlFor(token);
  const invitation = [...db.invitations.values()].find(
    (candidate) => candidate.inviteUrl === inviteUrl && isPending(candidate),
  );

  if (!invitation) {
    throw errorResponse(
      "NOT_FOUND",
      "This invitation is invalid or has expired",
    );
  }

  return invitation;
};

const assertInvitable = (email: string) => {
  assertEmailAvailable(email);

  const hasPendingInvite = [...db.invitations.values()].some(
    (invitation) => invitation.email === email && isPending(invitation),
  );

  if (hasPendingInvite) {
    throw errorResponse("CONFLICT", "Already invited", {
      fieldErrors: {
        email: ["An invitation is already pending for this email"],
      },
    });
  }
};

const toInvitation = (
  { email, role }: CreateInvitationInput,
  inviter: User,
): Invitation => {
  assertInvitable(email);

  return {
    id: newId(),
    email,
    role,
    status: "pending",
    inviteUrl: inviteUrlFor(newId()),
    invitedBy: { id: inviter.id, name: inviter.name },
    expiresAt: daysFromNow(INVITATION_TTL_DAYS),
    createdAt: now(),
  };
};

const revokeInvitation = route(
  defineEndpoint({
    method: "DELETE",
    path: itemPath(resources.invitations),
    access: resources.invitations.permissions.write,
  }),
  ({ params }) => {
    const invitation = withResolvedStatus(
      findById(db.invitations, params, LABEL),
    );

    if (invitation.status !== "pending") {
      return errorResponse(
        "CONFLICT",
        `Cannot revoke an invitation that is ${invitation.status}`,
      );
    }

    db.invitations.set(invitation.id, { ...invitation, status: "revoked" });

    return noContent();
  },
);

const previewInvitation = route(
  endpoints.previewInvitation,
  ({ params, respond }) =>
    respond(findPendingInvitation(getParam(params, "token"))),
);

const acceptInvitation = route(
  endpoints.acceptInvitation,
  ({ body: { token, ...profile }, respond }) => {
    const invitation = findPendingInvitation(token);
    const user = createUser({
      ...profile,
      email: invitation.email,
      role: invitation.role,
    });
    db.invitations.set(invitation.id, { ...invitation, status: "accepted" });

    return respond(authResponse(user), withSession(user, 201));
  },
);

export const invitationHandlers = [
  ...crudHandlers(resources.invitations, {
    label: LABEL,
    store: db.invitations,
    sortKey: (invitation) => invitation.createdAt,
    present: withResolvedStatus,
    matches: matchesStatus,
    toItem: toInvitation,
  }),
  previewInvitation,
  acceptInvitation,
  revokeInvitation,
];
