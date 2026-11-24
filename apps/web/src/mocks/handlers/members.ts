import {
  type UpdateMemberInput,
  type User,
  endpoints,
  resources,
} from "@pulse/contracts";
import { db } from "../db";
import { findById } from "../lib/collection";
import { crudHandlers } from "../lib/crud";
import { errorResponse } from "../lib/responses";
import { route } from "../lib/route";
import { deleteUser, verifyPassword } from "../lib/users";

const assertManageable = (actor: User, target: User) => {
  if (target.role === "owner") {
    throw errorResponse(
      "FORBIDDEN",
      "The workspace owner cannot be changed or removed",
    );
  }

  if (target.id === actor.id) {
    throw errorResponse("FORBIDDEN", "You cannot change your own access");
  }
};

const applyMemberUpdate = (
  member: User,
  { role }: UpdateMemberInput,
  actor: User,
): User => {
  assertManageable(actor, member);

  return { ...member, role };
};

const removeMember = (member: User, actor: User) => {
  assertManageable(actor, member);
  deleteUser(member.id);
};

const transferOwnership = route(
  endpoints.transferOwnership,
  ({ params, body, user, respond }) => {
    if (user.role !== "owner") {
      throw errorResponse(
        "FORBIDDEN",
        "Only the workspace owner can transfer ownership",
      );
    }

    const target = findById(db.users, params, "Member");

    if (target.id === user.id) {
      throw errorResponse("FORBIDDEN", "You already own this workspace");
    }

    if (!verifyPassword(user.id, body.currentPassword)) {
      throw errorResponse("VALIDATION_ERROR", "Current password is incorrect", {
        fieldErrors: { currentPassword: ["Current password is incorrect"] },
      });
    }

    if (!target.emailVerifiedAt) {
      throw errorResponse(
        "CONFLICT",
        "Ownership can only go to a member with a verified email address",
      );
    }

    const previousOwner: User = { ...user, role: "admin" };
    const newOwner: User = { ...target, role: "owner" };
    db.users.set(previousOwner.id, previousOwner);
    db.users.set(newOwner.id, newOwner);

    return respond({ previousOwner, newOwner });
  },
);

export const memberHandlers = [
  transferOwnership,
  ...crudHandlers(resources.members, {
    label: "Member",
    store: db.users,
    sortKey: (member) => member.createdAt,
    applyUpdate: applyMemberUpdate,
    onDelete: removeMember,
  }),
];
