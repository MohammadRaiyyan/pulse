import { describe, expect, it, vi } from "vitest";
import { registerUser, request, useTestServer } from "../../test/client.ts";

vi.mock("../../lib/mailer.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/mailer.ts")>()),
  sendEmail: vi.fn().mockRejectedValue(new Error("SMTP unavailable")),
}));

useTestServer();

describe("invitation email failures", () => {
  it("still creates the invitation and tells the admin the email was not sent", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");

    const response = await request("/api/invitations", {
      method: "POST",
      token: owner.token,
      body: { email: "sam@test.dev", role: "member" },
    });

    expect(response.status).toBe(201);
    expect(response.body.emailSent).toBe(false);
    expect(response.body.inviteUrl).toContain("/invite/");
  });
});
