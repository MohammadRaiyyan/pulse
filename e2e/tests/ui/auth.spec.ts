import { createTeammate, uniqueEmail } from "../../support/api-client.ts";
import { latestEmailLink } from "../../support/mailbox.ts";
import { expect, test, toast } from "../../support/fixtures.ts";

const signIn = async (page: import("@playwright/test").Page, email: string, password: string) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
};

test.describe("authentication", () => {
  test("wrong password shows an inline error, right password signs in and survives reload", async ({ page, ownerApi }) => {
    const teammate = await createTeammate(ownerApi, "member", "Mira Member");

    await signIn(page, teammate.email, "not-the-password");
    await expect(page.getByText("Invalid email or password")).toBeVisible();

    await signIn(page, teammate.email, teammate.password);
    await expect(page.getByRole("heading", { name: "Hi, Mira" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Hi, Mira" })).toBeVisible();
  });

  test("log out ends the session and protected pages redirect to sign in", async ({ page, ownerApi }) => {
    const teammate = await createTeammate(ownerApi, "viewer", "Luca Logout");
    await signIn(page, teammate.email, teammate.password);
    await expect(page.getByRole("heading", { name: "Hi, Luca" })).toBeVisible();

    await page.getByRole("button", { name: /Luca Logout/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/monitors");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a new sign-up becomes a viewer and duplicate emails are rejected inline", async ({ page }) => {
    const email = uniqueEmail("signup");

    await page.goto("/register");
    await page.getByLabel("Full name").fill("Rita Register");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Hi, Rita" })).toBeVisible();

    await page.getByRole("button", { name: /Rita Register/ }).click();
    await expect(page.getByRole("menu").getByText("Viewer")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Rita Register/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();

    await page.goto("/register");
    await page.getByLabel("Full name").fill("Rita Again");
    await page.getByLabel("Email").fill(email.toUpperCase());
    await page.getByLabel("Password", { exact: true }).fill("password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("An account with this email already exists")).toBeVisible();
  });

  test("forgot password sends a link that resets the password exactly once", async ({ page, ownerApi, browser }) => {
    const teammate = await createTeammate(ownerApi, "member", "Rex Reset");

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(teammate.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(`If an account exists for ${teammate.email}`)).toBeVisible();

    await expect.poll(() => latestEmailLink(teammate.email, "/reset-password")).toBeTruthy();
    const resetUrl = latestEmailLink(teammate.email, "/reset-password") ?? "";

    await page.goto(resetUrl);
    await page.getByLabel("New password").fill("password789");
    await page.getByLabel("Confirm password").fill("password789");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page).toHaveURL(/\/login/);
    await toast(page, "Password updated");

    await signIn(page, teammate.email, teammate.password);
    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await signIn(page, teammate.email, "password789");
    await expect(page.getByRole("heading", { name: "Hi, Rex" })).toBeVisible();

    const signedOut = await browser.newContext({ baseURL: page.url() });
    const reuse = await signedOut.newPage();
    await reuse.goto(resetUrl);
    await reuse.getByLabel("New password").fill("password000");
    await reuse.getByLabel("Confirm password").fill("password000");
    await reuse.getByRole("button", { name: "Update password" }).click();
    await expect(reuse.getByText("This reset link is invalid or has expired")).toBeVisible();
    await signedOut.close();
  });

  test("password fields can be revealed and hidden without submitting", async ({ page }) => {
    await page.goto("/login");
    const password = page.getByLabel("Password", { exact: true });
    await password.fill("secret-value");
    await expect(password).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("secret-value");
    await expect(page).toHaveURL(/\/login/);

    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("repeated failed logins show a countdown", async ({ page }) => {
    const email = uniqueEmail("locked");
    await page.goto("/login");

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password", { exact: true }).fill(`guess-${attempt}`);
      await Promise.all([
        page.waitForResponse((response) => response.url().endsWith("/api/auth/login")),
        page.getByRole("button", { name: "Sign in" }).click(),
      ]);
    }

    await expect(page.getByText(/Too many attempts\. Try again in \d+s/)).toBeVisible();
  });
});
