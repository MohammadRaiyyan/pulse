import { expect, goTo, test } from "../../support/fixtures.ts";

test.describe("role-based UI", () => {
  test("viewer sees a read-only app", async ({ pageAs }) => {
    const page = await pageAs("viewer");

    await goTo(page, "Monitors");
    await expect(page.getByRole("button", { name: "New monitor" })).toHaveCount(0);
    await page.getByRole("link", { name: "Public API" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await goTo(page, "Webhooks");
    await expect(page.getByRole("button", { name: "New endpoint" })).toHaveCount(0);

    await goTo(page, "Incidents");
    await expect(page.getByRole("button", { name: "Acknowledge" })).toHaveCount(0);

    await goTo(page, "Alert channels");
    await expect(page.getByRole("button", { name: "New channel" })).toHaveCount(0);
    await expect(page.getByLabel("Toggle On-call email")).toBeDisabled();

    await goTo(page, "Team");
    await expect(page.getByRole("button", { name: "Invite member" })).toHaveCount(0);
    await expect(page.getByRole("combobox")).toHaveCount(0);
  });

  test("member can manage monitors and incidents but not channels or the team", async ({ pageAs }) => {
    const page = await pageAs("member");

    await goTo(page, "Monitors");
    await expect(page.getByRole("button", { name: "New monitor" }).first()).toBeVisible();

    await goTo(page, "Webhooks");
    await expect(page.getByRole("button", { name: "New endpoint" }).first()).toBeVisible();

    await goTo(page, "Alert channels");
    await expect(page.getByRole("button", { name: "New channel" })).toHaveCount(0);
    await expect(page.getByLabel("Toggle On-call email")).toBeDisabled();

    await goTo(page, "Team");
    await expect(page.getByRole("button", { name: "Invite member" })).toHaveCount(0);
  });

  test("admin manages the team but cannot touch the owner or themself", async ({ pageAs }) => {
    const page = await pageAs("admin");
    await page.goto("/team?pageSize=100");

    await expect(page.getByRole("button", { name: "Invite member" }).first()).toBeVisible();
    await expect(page.getByLabel("Role for Maya Member")).toBeVisible();
    await expect(page.getByLabel("Role for Olivia Owner")).toHaveCount(0);
    await expect(page.getByLabel("Role for Adam Admin")).toHaveCount(0);
  });
});
