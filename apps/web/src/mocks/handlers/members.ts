import { type UpdateMemberInput, type User, resources } from "@pulse/contracts";
import { db } from "../db";
import { crudHandlers } from "../lib/crud";
import { errorResponse } from "../lib/responses";
import { deleteUser } from "../lib/users";

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

export const memberHandlers = crudHandlers(resources.members, {
  label: "Member",
  store: db.users,
  sortKey: (member) => member.createdAt,
  applyUpdate: applyMemberUpdate,
  onDelete: removeMember,
});
