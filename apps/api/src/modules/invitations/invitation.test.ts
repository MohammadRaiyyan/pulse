import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../db/client.ts";
import { invitations } from "../../models/index.ts";
import { registerUser, request, useTestServer } from "../../test/client.ts";
import { waitForEmail } from "../../test/mail.ts";

useTestServer();

const tokenFrom = (inviteUrl: string) => inviteUrl.split("/invite/")[1] ?? "";

describe("invitations", () => {
  it("invites, previews and accepts into a signed-in session", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");

    const invitation = await request("/api/invitations", {
      method: "POST",
      token: owner.token,
      body: { email: "sam@test.dev", role: "member" },
    });
    expect(invitation.status).toBe(201);
    expect(invitation.body.status).toBe("pending");

    const email = await waitForEmail("sam@test.dev");
    expect(email.subject).toBe("Owner invited you to Pulse");
    expect(email.text).toContain(invitation.body.inviteUrl);
    expect(email.text).toContain("as member");

    const token = tokenFrom(invitation.body.inviteUrl);

    const preview = await request(`/api/invitations/preview/${token}`);
    expect(preview.body).toMatchObject({
      email: "sam@test.dev",
      role: "member",
      invitedBy: { name: "Owner" },
    });

    const accepted = await request("/api/invitations/accept", {
      method: "POST",
      body: { token, name: "Sam", password: "password123" },
    });
    expect(accepted.status).toBe(201);
    expect(accepted.body.user).toMatchObject({
      email: "sam@test.dev",
      role: "member",
    });
    expect(accepted.refreshCookie).toBeDefined();

    const reused = await request("/api/invitations/accept", {
      method: "POST",
      body: { token, name: "Sam", password: "password123" },
    });
    expect(reused.status).toBe(404);
  });

  it("rejects tampered tokens and duplicate invites", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const body = { email: "sam@test.dev", role: "admin" };

    const first = await request("/api/invitations", {
      method: "POST",
      token: owner.token,
      body,
    });
    const duplicate = await request("/api/invitations", {
      method: "POST",
      token: owner.token,
      body,
    });
    expect(duplicate.status).toBe(409);

    const tampered = `${tokenFrom(first.body.inviteUrl)}x`;
    const preview = await request(`/api/invitations/preview/${tampered}`);
    expect(preview.status).toBe(404);
  });

  it("revokes only pending invitations", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const invitation = await request("/api/invitations", {
      method: "POST",
      token: owner.token,
      body: { email: "sam@test.dev", role: "viewer" },
    });

    const revoked = await request(`/api/invitations/${invitation.body.id}`, {
      method: "DELETE",
      token: owner.token,
    });
    expect(revoked.status).toBe(204);

    const again = await request(`/api/invitations/${invitation.body.id}`, {
      method: "DELETE",
      token: owner.token,
    });
    expect(again.status).toBe(409);
  });

  it("allows a new invite once the previous one has expired", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const body = { email: "late@test.dev", role: "member" };

    const first = await request("/api/invitations", {
      method: "POST",
      token: owner.token,
      body,
    });
    await db
      .update(invitations)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitations.id, first.body.id));

    const second = await request("/api/invitations", {
      method: "POST",
      token: owner.token,
      body,
    });
    expect(second.status).toBe(201);

    const expired = await request("/api/invitations?status=expired", {
      token: owner.token,
    });
    expect(
      expired.body.items.map((invitation: { id: string }) => invitation.id),
    ).toContain(first.body.id);
  });
});
