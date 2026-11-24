import { uniqueEmail } from "../../support/api-client.ts";
import { choose, confirmDialog, expect, goTo, tableRow, test, toast } from "../../support/fixtures.ts";
import { WEB_ORIGIN } from "../../support/environment.ts";

test.describe("team", () => {
  test("invite validation shows field errors", async ({ pageAs, ownerApi }) => {
    const pending = uniqueEmail("pending");
    await ownerApi.post("/invitations", { email: pending, role: "viewer" });

    const page = await pageAs("owner");
    await goTo(page, "Team");
    await page.getByRole("button", { name: "Invite member" }).first().click();
    const dialog = page.getByRole("dialog");

    await dialog.getByPlaceholder("teammate@company.com").fill("admin@pulse.dev");
    await dialog.getByRole("button", { name: /invite|send/i }).last().click();
    await expect(dialog.getByText("An account with this email already exists")).toBeVisible();

    await dialog.getByPlaceholder("teammate@company.com").fill(pending);
    await dialog.getByRole("button", { name: /invite|send/i }).last().click();
    await expect(dialog.getByText("An invitation is already pending for this email")).toBeVisible();
  });

  test("invite, accept, change role, and remove a teammate", async ({ pageAs, browser }) => {
    const email = uniqueEmail("nina");
    const page = await pageAs("owner");
    await goTo(page, "Team");
    await page.getByRole("button", { name: "Invite member" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("teammate@company.com").fill(email);
    await choose(page, dialog.getByLabel("Role"), "Member");
    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().endsWith("/api/invitations") && res.request().method() === "POST"),
      dialog.getByRole("button", { name: /invite|send/i }).last().click(),
    ]);
    const { inviteUrl } = await response.json();
    await expect(dialog).toBeHidden();
    await expect(tableRow(page, email).getByText("Invited", { exact: true })).toBeVisible();

    const inviteeContext = await browser.newContext({ baseURL: WEB_ORIGIN });
    const invitee = await inviteeContext.newPage();
    await invitee.goto(inviteUrl);
    await expect(invitee.getByText("Olivia Owner invited you to join as Member.")).toBeVisible();
    await expect(invitee.getByLabel("Email")).toHaveValue(email);
    await invitee.getByLabel("Full name").fill("Nina Newhire");
    await invitee.getByLabel("Password", { exact: true }).fill("password123");
    await invitee.getByRole("button", { name: "Join workspace" }).click();
    await expect(invitee.getByRole("heading", { name: "Hi, Nina" })).toBeVisible();

    await page.reload();
    await expect(tableRow(page, "Nina Newhire").getByText("Active", { exact: true })).toBeVisible();
    await expect(tableRow(page, "Invited").filter({ hasText: email })).toHaveCount(0);

    await choose(page, page.getByLabel("Role for Nina Newhire"), "Viewer");
    await toast(page, "Nina Newhire is now viewer");

    await invitee.goto("/monitors");
    await expect(invitee.getByRole("link", { name: "Public API" })).toBeVisible();
    await expect(invitee.getByRole("button", { name: "New monitor" })).toHaveCount(0);

    await page.getByRole("button", { name: "Remove Nina Newhire" }).click();
    await confirmDialog(page, "Remove member");
    await toast(page, "Nina Newhire removed");

    await invitee.reload();
    await expect(invitee).toHaveURL(/\/login/);
    await inviteeContext.close();
  });

  test("a revoked invitation link stops working", async ({ pageAs, ownerApi, page: guest }) => {
    const email = uniqueEmail("revoked");
    const invitation = (await ownerApi.post("/invitations", { email, role: "member" })).body;

    const page = await pageAs("owner");
    await goTo(page, "Team");
    await page.getByRole("button", { name: `Revoke the invitation for ${email}` }).click();
    await confirmDialog(page, "Revoke invitation");
    await toast(page, `Invitation for ${email} revoked`);
    await expect(tableRow(page, email)).toHaveCount(0);

    await guest.goto(invitation.inviteUrl);
    await expect(guest.getByText("This invitation is invalid or has expired")).toBeVisible();
  });

  test("the owner row is protected", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await goTo(page, "Team");
    await expect(tableRow(page, "owner@pulse.dev")).toBeVisible();
    await expect(page.getByLabel("Role for Olivia Owner")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove Olivia Owner" })).toHaveCount(0);
  });

});
