import { expect, test } from "../../support/fixtures.ts";
import { ApiClient, DEMO_PASSWORD, createTeammate, demoUsers, uniqueEmail } from "../../support/api-client.ts";
import { latestEmailTo } from "../../support/mailbox.ts";

const transferPath = (memberId: string) => `/members/${memberId}/transfer-ownership`;

const roleOf = async (client: ApiClient, memberId: string) =>
  (await client.get(`/members/${memberId}`)).body.role as string;

test.describe("ownership transfer", () => {
  test("only the owner can transfer, with the password, to a verified member", async ({ ownerApi: owner }) => {
    const admin = await createTeammate(owner, "admin");
    const member = await createTeammate(owner, "member");

    const byAdmin = await admin.client.post(transferPath(member.user.id), { currentPassword: DEMO_PASSWORD });
    expect(byAdmin.status).toBe(403);
    expect(byAdmin.body.error.message).toBe("Only the workspace owner can transfer ownership");

    const wrongPassword = await owner.post(transferPath(member.user.id), { currentPassword: "not-the-password" });
    expect(wrongPassword.status).toBe(400);
    expect(wrongPassword.body.error.fieldErrors.currentPassword).toEqual(["Current password is incorrect"]);

    const missingPassword = await owner.post(transferPath(member.user.id), {});
    expect(missingPassword.status).toBe(400);

    const changedEmail = await member.client.patch("/me", {
      name: member.name,
      email: uniqueEmail("unverified"),
      currentPassword: DEMO_PASSWORD,
    });
    expect(changedEmail.status).toBe(200);
    expect(changedEmail.body.emailVerifiedAt).toBeNull();

    const toUnverified = await owner.post(transferPath(member.user.id), { currentPassword: DEMO_PASSWORD });
    expect(toUnverified.status).toBe(409);
    expect(toUnverified.body.error.message).toBe("Ownership can only go to a member with a verified email address");

    const me = await owner.get("/members?pageSize=100");
    const ownerRow = me.body.items.find((item: { email: string }) => item.email === demoUsers.owner);
    expect(ownerRow.role).toBe("owner");
    expect((await owner.post(transferPath(ownerRow.id), { currentPassword: DEMO_PASSWORD })).status).toBe(403);
  });

  test("transferring swaps the roles and the new owner can transfer it back", async ({ ownerApi: owner }) => {
    const successor = await createTeammate(owner, "member");
    const members = await owner.get("/members?pageSize=100");
    const ownerId = members.body.items.find((item: { email: string }) => item.email === demoUsers.owner).id as string;

    try {
      const transferred = await owner.post(transferPath(successor.user.id), { currentPassword: DEMO_PASSWORD });
      expect(transferred.status).toBe(200);
      expect(transferred.body.previousOwner).toMatchObject({ id: ownerId, role: "admin" });
      expect(transferred.body.newOwner).toMatchObject({ id: successor.user.id, role: "owner" });

      expect(await roleOf(owner, successor.user.id)).toBe("owner");
      expect(await roleOf(owner, ownerId)).toBe("admin");
      expect((await owner.post(transferPath(successor.user.id), { currentPassword: DEMO_PASSWORD })).status).toBe(403);

      expect(latestEmailTo(successor.email)?.subject).toBe("You are now the owner of your Pulse workspace");
      expect(latestEmailTo(demoUsers.owner)?.subject).toBe("You transferred ownership of your Pulse workspace");
    } finally {
      if ((await roleOf(owner, successor.user.id)) === "owner") {
        const back = await successor.client.post(transferPath(ownerId), { currentPassword: DEMO_PASSWORD });
        expect(back.status).toBe(200);
      }
    }

    expect(await roleOf(owner, ownerId)).toBe("owner");
    expect(await roleOf(owner, successor.user.id)).toBe("admin");
  });
});

test.describe("security notifications", () => {
  test("password and email changes notify the account holder without links", async ({ ownerApi: owner }) => {
    const teammate = await createTeammate(owner, "member");

    const changed = await teammate.client.post("/me/password", {
      currentPassword: DEMO_PASSWORD,
      newPassword: "password456",
    });
    expect(changed.status).toBe(204);

    await expect.poll(() => latestEmailTo(teammate.email)?.subject).toBe("Your Pulse password was changed");
    expect(latestEmailTo(teammate.email)?.text).not.toMatch(/https?:\/\//);

    const client = await ApiClient.signIn(owner.request, teammate.email, "password456");
    const newEmail = uniqueEmail("moved");
    const moved = await client.patch("/me", { name: teammate.name, email: newEmail, currentPassword: "password456" });
    expect(moved.status).toBe(200);

    await expect.poll(() => latestEmailTo(teammate.email)?.subject).toBe("Your email address was changed");
    const notice = latestEmailTo(teammate.email);
    expect(notice?.text).toContain(newEmail);
    expect(notice?.text).not.toMatch(/https?:\/\//);
  });
});
