import { expect, test } from "../../support/fixtures.ts";
import { createTeammate, demoUsers, uniqueSuffix } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";

type Role = "admin" | "member" | "viewer";

const monitorInput = () => ({
  name: `Permission check ${uniqueSuffix()}`,
  url: "https://example.com",
  method: "GET",
  intervalSeconds: 600,
  timeoutMs: 5000,
  expectedStatusCode: 200,
  alertChannelIds: [],
});

const channelInput = () => ({
  name: `Channel ${uniqueSuffix()}`,
  isEnabled: false,
  destination: { type: "email", target: "ops@example.com" },
});

const expectations: Record<Role, { monitor: number; channel: number; invite: number; readMembers: number }> = {
  admin: { monitor: 201, channel: 201, invite: 201, readMembers: 200 },
  member: { monitor: 201, channel: 403, invite: 403, readMembers: 200 },
  viewer: { monitor: 403, channel: 403, invite: 403, readMembers: 200 },
};

test.describe("role-based access", () => {
  for (const role of Object.keys(expectations) as Role[]) {
    test(`${role} permissions match the matrix`, async ({ ownerApi: owner }) => {
      const { client } = await createTeammate(owner, role);
      const expected = expectations[role];

      expect((await client.post("/monitors", monitorInput())).status).toBe(expected.monitor);
      expect((await client.post("/alert-channels", channelInput())).status).toBe(expected.channel);
      expect((await client.post("/invitations", { email: `x-${uniqueSuffix()}@e2e.pulse.dev`, role: "viewer" })).status).toBe(
        expected.invite,
      );
      expect((await client.get("/members")).status).toBe(expected.readMembers);
      expect((await client.get("/dashboard/summary")).status).toBe(200);
    });
  }

  test("nobody can change the owner, promote to owner, or change themselves", async ({ ownerApi: owner }) => {
    const admin = await createTeammate(owner, "admin");
    const ownerUser = (await owner.get("/members?pageSize=100")).body.items.find(
      (member: { email: string }) => member.email === demoUsers.owner,
    );

    expect((await admin.client.patch(`/members/${ownerUser.id}`, { role: "viewer" })).status).toBe(403);
    expect((await admin.client.delete(`/members/${ownerUser.id}`)).status).toBe(403);
    expect((await admin.client.patch(`/members/${admin.user.id}`, { role: "viewer" })).status).toBe(403);
    expect((await owner.patch(`/members/${admin.user.id}`, { role: "owner" })).status).toBe(400);

  });

  test("a demoted user loses write access on the very next request", async ({ ownerApi: owner }) => {
    const member = await createTeammate(owner, "member");

    expect((await member.client.post("/monitors", monitorInput())).status).toBe(201);
    expect((await owner.patch(`/members/${member.user.id}`, { role: "viewer" })).status).toBe(200);
    expect((await member.client.post("/monitors", monitorInput())).status).toBe(403);

    await owner.delete(`/members/${member.user.id}`);
    const afterRemoval = await owner.request.get(`${API_ORIGIN}/api/monitors`, {
      headers: { Authorization: `Bearer ${member.client.token}` },
    });
    expect(afterRemoval.status()).toBe(401);

  });
});
