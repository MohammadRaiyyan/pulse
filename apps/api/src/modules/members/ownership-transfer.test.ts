import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../db/client.ts";
import { users } from "../../models/index.ts";
import { hashPassword } from "../../security/passwords.ts";
import {
  registerUser,
  request,
  signInWithRole,
  useTestServer,
} from "../../test/client.ts";
import { readSentEmails, waitForEmail } from "../../test/mail.ts";
import { insertUser } from "../users/user.repository.ts";

useTestServer();

const transfer = (
  token: string,
  memberId: string,
  currentPassword = "password123",
) =>
  request(`/api/members/${memberId}/transfer-ownership`, {
    method: "POST",
    token,
    body: { currentPassword },
  });

const rolesByEmail = async () => {
  const rows = await db
    .select({ email: users.email, role: users.role })
    .from(users)
    .orderBy(asc(users.email));
  return Object.fromEntries(rows.map((row) => [row.email, row.role]));
};

describe("ownership transfer", () => {
  it("lets only the owner transfer ownership", async () => {
    await registerUser("Owner", "owner@test.dev");
    const admin = await signInWithRole("admin", "admin@test.dev");
    const member = await signInWithRole("member", "member@test.dev");

    const byAdmin = await transfer(admin.token, member.user.id);
    expect(byAdmin.status).toBe(403);
    expect(byAdmin.body.error.message).toBe(
      "Only the workspace owner can transfer ownership",
    );

    const byMember = await transfer(member.token, admin.user.id);
    expect(byMember.status).toBe(403);

    expect(await rolesByEmail()).toEqual({
      "admin@test.dev": "admin",
      "member@test.dev": "member",
      "owner@test.dev": "owner",
    });
  });

  it("requires the owner's current password", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const admin = await signInWithRole("admin", "admin@test.dev");

    const missing = await request(
      `/api/members/${admin.user.id}/transfer-ownership`,
      { method: "POST", token: owner.token, body: {} },
    );
    expect(missing.status).toBe(400);

    const wrong = await transfer(owner.token, admin.user.id, "not-my-password");
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fieldErrors.currentPassword).toEqual([
      "Current password is incorrect",
    ]);

    expect((await rolesByEmail())["owner@test.dev"]).toBe("owner");
  });

  it("only transfers to an existing member with a verified email", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const unverified = await insertUser({
      name: "Unverified",
      email: "unverified@test.dev",
      role: "admin",
      passwordHash: await hashPassword("password123"),
    });

    const toUnverified = await transfer(owner.token, unverified.id);
    expect(toUnverified.status).toBe(409);
    expect(toUnverified.body.error.message).toBe(
      "Ownership can only go to a member with a verified email address",
    );

    const toMissing = await transfer(
      owner.token,
      "00000000-0000-4000-8000-000000000000",
    );
    expect(toMissing.status).toBe(404);

    const toSelf = await transfer(owner.token, owner.user.id);
    expect(toSelf.status).toBe(403);

    expect(await rolesByEmail()).toEqual({
      "owner@test.dev": "owner",
      "unverified@test.dev": "admin",
    });
  });

  it("swaps the roles, applies them immediately and emails both people", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const target = await signInWithRole("viewer", "target@test.dev");
    const admin = await signInWithRole("admin", "admin@test.dev");

    expect((await request("/api/members", { token: owner.token })).status).toBe(
      200,
    );
    expect(
      (await request("/api/members", { token: target.token })).status,
    ).toBe(200);

    const response = await transfer(owner.token, target.user.id);
    expect(response.status).toBe(200);
    expect(response.body.previousOwner).toMatchObject({
      id: owner.user.id,
      role: "admin",
    });
    expect(response.body.newOwner).toMatchObject({
      id: target.user.id,
      role: "owner",
    });

    expect(await rolesByEmail()).toEqual({
      "admin@test.dev": "admin",
      "owner@test.dev": "admin",
      "target@test.dev": "owner",
    });

    const oldOwnerChangesAdmin = await request(
      `/api/members/${admin.user.id}`,
      {
        method: "PATCH",
        token: owner.token,
        body: { role: "viewer" },
      },
    );
    expect(oldOwnerChangesAdmin.status).toBe(403);

    const newOwnerChangesAdmin = await request(
      `/api/members/${admin.user.id}`,
      {
        method: "PATCH",
        token: target.token,
        body: { role: "member" },
      },
    );
    expect(newOwnerChangesAdmin.status).toBe(200);

    const oldOwnerEmail = await waitForEmail("owner@test.dev");
    expect(oldOwnerEmail.subject).toBe(
      "You transferred ownership of your Pulse workspace",
    );
    expect(oldOwnerEmail.text).toContain("You are now an admin");

    const newOwnerEmail = await waitForEmail("target@test.dev");
    expect(newOwnerEmail.subject).toBe(
      "You are now the owner of your Pulse workspace",
    );
    expect(newOwnerEmail.text).toContain("Owner transferred ownership");
    expect(newOwnerEmail.text).not.toMatch(/https?:\/\//);
  });

  it("lets exactly one of two concurrent transfers succeed", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const first = await signInWithRole("admin", "first@test.dev");
    const second = await signInWithRole("member", "second@test.dev");

    const results = await Promise.all([
      transfer(owner.token, first.user.id),
      transfer(owner.token, second.user.id),
    ]);

    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(
      results.filter((result) => [403, 409].includes(result.status)),
    ).toHaveLength(1);

    const owners = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "owner"));
    expect(owners).toHaveLength(1);
    expect([first.user.id, second.user.id]).toContain(owners[0]?.id);
    expect((await rolesByEmail())["owner@test.dev"]).toBe("admin");

    const ownershipEmails = (await readSentEmails()).filter((email) =>
      [
        "You transferred ownership of your Pulse workspace",
        "You are now the owner of your Pulse workspace",
      ].includes(email.subject),
    );
    expect(ownershipEmails).toHaveLength(2);
  });

  it("lets the new owner transfer ownership back", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const target = await signInWithRole("admin", "target@test.dev");
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, owner.user.id));

    expect((await transfer(owner.token, target.user.id)).status).toBe(200);
    expect((await transfer(owner.token, target.user.id)).status).toBe(403);
    expect((await transfer(target.token, owner.user.id)).status).toBe(200);

    expect(await rolesByEmail()).toEqual({
      "owner@test.dev": "owner",
      "target@test.dev": "admin",
    });
  });
});
