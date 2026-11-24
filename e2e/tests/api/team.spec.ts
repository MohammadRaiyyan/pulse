import { expect, test } from "../../support/fixtures.ts";
import { DEMO_PASSWORD, createTeammate, demoUsers, tokenFromInviteUrl, uniqueEmail } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";
import { latestEmailLink } from "../../support/mailbox.ts";

const publicPost = (path: string, body: unknown) =>
  fetch(`${API_ORIGIN}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test.describe("team and invitations", () => {
  test("invite, preview, accept, then the link is spent", async ({ ownerApi: owner }) => {
    const email = uniqueEmail("invitee");

    const invitation = await owner.post("/invitations", { email: email.toUpperCase(), role: "member" });
    expect(invitation.status).toBe(201);
    expect(invitation.body).toMatchObject({ email, role: "member", status: "pending", invitedBy: { name: "Olivia Owner" } });
    expect(latestEmailLink(email, "/invite/")).toBe(invitation.body.inviteUrl);

    const token = tokenFromInviteUrl(invitation.body.inviteUrl);
    const preview = await fetch(`${API_ORIGIN}/api/invitations/preview/${token}`);
    expect(await preview.json()).toMatchObject({ email, role: "member", invitedBy: { name: "Olivia Owner" } });

    const accepted = await publicPost("/invitations/accept", { token, name: "New Member", password: DEMO_PASSWORD });
    expect(accepted.status).toBe(201);
    expect((await accepted.json()).user).toMatchObject({ email, role: "member", name: "New Member" });

    const login = await publicPost("/auth/login", { email, password: DEMO_PASSWORD });
    expect(login.status).toBe(200);

    const spent = await publicPost("/invitations/accept", { token, name: "Again", password: DEMO_PASSWORD });
    expect(spent.status).toBe(404);

    const list = await owner.get("/invitations?status=accepted&pageSize=100");
    expect(list.body.items.some((item: { email: string }) => item.email === email)).toBe(true);

  });

  test("only the owner can change or remove an admin", async ({ ownerApi: owner }) => {
    const firstAdmin = await createTeammate(owner, "admin");
    const secondAdmin = await createTeammate(owner, "admin");

    const demote = await firstAdmin.client.patch(`/members/${secondAdmin.user.id}`, { role: "viewer" });
    expect(demote.status).toBe(403);
    expect(demote.body.error.message).toBe("Only the workspace owner can change or remove an admin");
    expect((await firstAdmin.client.delete(`/members/${secondAdmin.user.id}`)).status).toBe(403);

    expect((await owner.patch(`/members/${secondAdmin.user.id}`, { role: "member" })).status).toBe(200);
    expect((await owner.delete(`/members/${secondAdmin.user.id}`)).status).toBe(204);
  });

  test("invitation rules are enforced", async ({ ownerApi: owner }) => {
    const email = uniqueEmail("rules");

    const existingUser = await owner.post("/invitations", { email: demoUsers.member, role: "viewer" });
    expect(existingUser.status).toBe(409);
    expect(existingUser.body.error.fieldErrors.email).toEqual(["An account with this email already exists"]);

    const first = await owner.post("/invitations", { email, role: "viewer" });
    const duplicate = await owner.post("/invitations", { email, role: "admin" });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.fieldErrors.email).toEqual(["An invitation is already pending for this email"]);

    const ownerRole = await owner.post("/invitations", { email: uniqueEmail("owner"), role: "owner" });
    expect(ownerRole.status).toBe(400);

    const token = tokenFromInviteUrl(first.body.inviteUrl);
    const tampered = await fetch(`${API_ORIGIN}/api/invitations/preview/${token.slice(0, -2)}xx`);
    expect(tampered.status).toBe(404);

    expect((await owner.delete(`/invitations/${first.body.id}`)).status).toBe(204);
    expect((await owner.delete(`/invitations/${first.body.id}`)).status).toBe(409);
    expect((await fetch(`${API_ORIGIN}/api/invitations/preview/${token}`)).status).toBe(404);

    const reinvite = await owner.post("/invitations", { email, role: "viewer" });
    expect(reinvite.status).toBe(201);

  });
});
