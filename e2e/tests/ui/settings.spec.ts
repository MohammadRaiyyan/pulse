import { createTeammate } from "../../support/api-client.ts";
import { WEB_ORIGIN } from "../../support/environment.ts";
import { expect, sidebar, signInContext, test, toast } from "../../support/fixtures.ts";

test.describe("account settings", () => {
  test("profile changes show everywhere and taken emails are reported", async ({ browser, ownerApi }) => {
    const teammate = await createTeammate(ownerApi, "member", "Paula Profile");
    const context = await browser.newContext({ baseURL: WEB_ORIGIN });
    await signInContext(context, teammate.email);
    const page = await context.newPage();

    await page.goto("/settings");
    await page.getByLabel("Full name").fill("Paula Updated");
    await page.getByRole("button", { name: "Save profile" }).click();
    await toast(page, "Profile updated");
    await expect(page.getByRole("button", { name: /Paula Updated/ })).toBeVisible();

    await page.getByLabel("Email").fill("owner@pulse.dev");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("An account with this email already exists")).toBeVisible();

    const members = (await ownerApi.get("/members?pageSize=100")).body.items;
    expect(members.find((member: { id: string }) => member.id === teammate.user.id)).toMatchObject({
      name: "Paula Updated",
      email: teammate.email,
    });
    await context.close();
  });

  test("changing the password keeps this device signed in and the new password works", async ({ browser, ownerApi }) => {
    const teammate = await createTeammate(ownerApi, "member", "Pete Password");
    const context = await browser.newContext({ baseURL: WEB_ORIGIN });
    await signInContext(context, teammate.email);
    const page = await context.newPage();

    await page.goto("/settings");
    await page.getByLabel("Current password").fill("not-my-password");
    await page.getByLabel("New password", { exact: true }).fill("password456");
    await page.getByLabel("Confirm new password").fill("password456");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Current password is incorrect")).toBeVisible();

    await page.getByLabel("Current password").fill(teammate.password);
    await page.getByLabel("New password", { exact: true }).fill("password456");
    await page.getByLabel("Confirm new password").fill("password456");
    await page.getByRole("button", { name: "Change password" }).click();
    await toast(page, "Password changed");

    await sidebar(page).getByRole("link", { name: "Monitors", exact: true }).click();
    await expect(page.getByRole("link", { name: "Public API" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: "Public API" })).toBeVisible();

    const fresh = await browser.newContext({ baseURL: WEB_ORIGIN });
    const login = await fresh.request.post("/api/auth/login", { data: { email: teammate.email, password: "password456" } });
    expect(login.ok()).toBe(true);
    await fresh.close();
    await context.close();
  });

  test("sign out everywhere ends every session immediately", async ({ browser, ownerApi }) => {
    const teammate = await createTeammate(ownerApi, "viewer", "Sam Sessions");
    const first = await browser.newContext({ baseURL: WEB_ORIGIN });
    const second = await browser.newContext({ baseURL: WEB_ORIGIN });
    await signInContext(first, teammate.email);
    await signInContext(second, teammate.email);

    const laptop = await first.newPage();
    const phone = await second.newPage();
    await laptop.goto("/settings");
    await phone.goto("/");
    await expect(phone.getByRole("heading", { name: "Hi, Sam" })).toBeVisible();

    await laptop.getByRole("button", { name: "Sign out everywhere" }).click();
    await laptop.getByRole("alertdialog").getByRole("button", { name: "Sign out everywhere" }).click();
    await expect(laptop).toHaveURL(/\/login/);

    await sidebar(phone).getByRole("link", { name: "Monitors", exact: true }).click();
    await expect(phone).toHaveURL(/\/login/);

    await first.close();
    await second.close();
  });

  test("connecting a provider that is not configured explains why", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await page.goto("/settings");
    await expect(page.getByText("Not connected").first()).toBeVisible();
    await page.getByRole("button", { name: "Connect" }).first().click();
    await toast(page, /not configured/);
  });
});
