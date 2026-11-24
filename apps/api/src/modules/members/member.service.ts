import type { PaginationQuery, UpdateMemberInput } from "@pulse/contracts";
import { forbidden, notFound } from "../../lib/errors.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import { publishChange } from "../../lib/realtime.ts";
import {
  deleteUserUnlessOwner,
  findUserById,
  listUsers,
  updateRoleUnlessOwner,
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
  return member
    ? forbidden("The workspace owner cannot be changed or removed")
    : notFound(LABEL);
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

  const member = await updateRoleUnlessOwner(id, input.role);

  if (!member) {
    throw await explainBlockedChange(id);
  }

  await forgetCachedUser(id);
  publishChange({ type: "member.updated", id });

  return member;
};

export const removeMember = async (actor: AuthUser, id: string) => {
  assertNotSelf(actor, id);

  const member = await deleteUserUnlessOwner(id);

  if (!member) {
    throw await explainBlockedChange(id);
  }

  await forgetCachedUser(id);
  publishChange({ type: "member.deleted", id });
};
