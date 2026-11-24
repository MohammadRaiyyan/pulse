import type { PaginationQuery, UpdateMemberInput } from "@pulse/contracts";
import { forbidden, notFound } from "../../lib/errors.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import {
  deleteMember,
  findUserById,
  listUsers,
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

  return member;
};

export const removeMember = async (actor: AuthUser, id: string) => {
  assertNotSelf(actor, id);

  const member = await deleteMember(id, actor.role);

  if (!member) {
    throw await explainBlockedChange(id);
  }

  await forgetCachedUser(id);
};
