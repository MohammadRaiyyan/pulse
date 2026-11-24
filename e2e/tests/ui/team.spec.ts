import { type ApiClient, createTeammate, demoUsers, uniqueEmail, uniqueSuffix } from "../../support/api-client.ts";
import { choose, confirmDialog, expect, goTo, signInContext, tableRow, test, toast } from "../../support/fixtures.ts";
import { WEB_ORIGIN } from "../../support/environment.ts";

const restoreSeededOwner = async (seededOwner: ApiClient, temporaryOwner: ApiClient) => {
  const members = await seededOwner.get("/members?pageSize=100");
  const items = members.body.items as { id: string; email: string; role: string }[];
  const seeded = items.find((item) => item.email === demoUsers.owner);
  const currentOwner = items.find((item) => item.role === "owner");

  if (seeded && currentOwner && currentOwner.id !== seeded.id && currentOwner.email === temporaryOwner.email) {
    await temporaryOwner.post(`/members/${seeded.id}/transfer-ownership`, { currentPassword: temporaryOwner.password });
  }
};

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

  test("admins cannot change or remove other admins", async ({ pageAs, ownerApi }) => {
    const otherAdmin = await createTeammate(ownerApi, "admin", `Ada Admin ${uniqueSuffix()}`);
    const member = await createTeammate(ownerApi, "member", `Milo Member ${uniqueSuffix()}`);

    const adminPage = await pageAs("admin");
    await goTo(adminPage, "Team");
    await expect(tableRow(adminPage, otherAdmin.email)).toBeVisible();
    await expect(adminPage.getByLabel(`Role for ${otherAdmin.name}`)).toHaveCount(0);
    await expect(adminPage.getByRole("button", { name: `Remove ${otherAdmin.name}` })).toHaveCount(0);
    await expect(adminPage.getByLabel(`Role for ${member.name}`)).toBeVisible();

    const ownerPage = await pageAs("owner");
    await goTo(ownerPage, "Team");
    await expect(ownerPage.getByLabel(`Role for ${otherAdmin.name}`)).toBeVisible();
    await expect(ownerPage.getByRole("button", { name: `Remove ${otherAdmin.name}` })).toBeVisible();
  });

  test("the owner transfers ownership to a teammate and gets it back", async ({ pageAs, ownerApi, browser }) => {
    const successor = await createTeammate(ownerApi, "member", `Sam Successor ${uniqueSuffix()}`);
    const unverified = await createTeammate(ownerApi, "viewer", `Uma Unverified ${uniqueSuffix()}`);
    await unverified.client.patch("/me", {
      name: unverified.name,
      email: uniqueEmail("unverified"),
      currentPassword: unverified.password,
    });

    try {
      const page = await pageAs("owner");
      await page.goto("/team?pageSize=100");
      await expect(page.getByRole("button", { name: `Transfer ownership to ${unverified.name}` })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expect(page.getByRole("button", { name: "Transfer ownership to Olivia Owner" })).toHaveCount(0);

      await page.getByRole("button", { name: `Transfer ownership to ${successor.name}` }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText(`${successor.name} becomes the workspace owner.`)).toBeVisible();
      await dialog.getByLabel("Your current password").fill("not-my-password");
      await dialog.getByRole("button", { name: "Transfer ownership" }).click();
      await expect(dialog.getByText("Current password is incorrect")).toBeVisible();

      await dialog.getByLabel("Your current password").fill("password123");
      await dialog.getByRole("button", { name: "Transfer ownership" }).click();
      await expect(dialog).toBeHidden();
      await toast(page, `${successor.name} is now the owner`);

      await expect(tableRow(page, successor.email).getByText("Owner", { exact: true })).toBeVisible();
      await expect(tableRow(page, "owner@pulse.dev").getByText("Admin", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Transfer ownership to/ })).toHaveCount(0);
      await expect(page.getByLabel(`Role for ${successor.name}`)).toHaveCount(0);

      const successorContext = await browser.newContext({ baseURL: WEB_ORIGIN });
      await signInContext(successorContext, successor.email);
      const successorPage = await successorContext.newPage();
      await successorPage.goto("/team?pageSize=100");
      await expect(successorPage.getByLabel("Role for Olivia Owner")).toBeVisible();
      await successorPage.getByRole("button", { name: "Transfer ownership to Olivia Owner" }).click();
      const backDialog = successorPage.getByRole("dialog");
      await backDialog.getByLabel("Your current password").fill(successor.password);
      await backDialog.getByRole("button", { name: "Transfer ownership" }).click();
      await toast(successorPage, "Olivia Owner is now the owner");
      await expect(tableRow(successorPage, "owner@pulse.dev").getByText("Owner", { exact: true })).toBeVisible();
      await successorContext.close();

      await page.reload();
      await expect(tableRow(page, "owner@pulse.dev").getByText("Owner", { exact: true })).toBeVisible();
      await expect(page.getByLabel(`Role for ${successor.name}`)).toBeVisible();
    } finally {
      await restoreSeededOwner(ownerApi, successor.client);
    }
  });

  test("the owner row is protected", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await page.goto("/team?pageSize=100");
    await expect(tableRow(page, "owner@pulse.dev")).toBeVisible();
    await expect(page.getByLabel("Role for Olivia Owner")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove Olivia Owner" })).toHaveCount(0);
  });

});
