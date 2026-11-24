import { type BrowserContext, type Page, test as base, expect } from "@playwright/test";
import { ApiClient, DEMO_PASSWORD, type DemoRole, demoUsers, postRespectingRateLimit } from "./api-client.ts";
import { WEB_ORIGIN } from "./environment.ts";

type WorkerFixtures = {
  ownerApi: ApiClient;
  roleContexts: Record<DemoRole, BrowserContext>;
};

type TestFixtures = {
  pageAs: (role: DemoRole) => Promise<Page>;
};

const recordServerErrors = (page: Page, errors: string[]) => {
  page.on("response", (response) => {
    if (response.status() >= 500) {
      errors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
};

export const signInContext = async (context: BrowserContext, email: string, password = DEMO_PASSWORD) => {
  const response = await postRespectingRateLimit(context.request, `${WEB_ORIGIN}/api/auth/login`, { email, password });
  expect(response.ok(), `sign in as ${email}`).toBeTruthy();
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  ownerApi: [
    async ({ playwright }, use) => {
      const request = await playwright.request.newContext();
      await use(await ApiClient.signIn(request, demoUsers.owner));
      await request.dispose();
    },
    { scope: "worker" },
  ],

  roleContexts: [
    async ({ browser }, use) => {
      const contexts = {} as Record<DemoRole, BrowserContext>;

      for (const role of Object.keys(demoUsers) as DemoRole[]) {
        contexts[role] = await browser.newContext({ baseURL: WEB_ORIGIN, viewport: { width: 1400, height: 900 } });
        await signInContext(contexts[role], demoUsers[role]);
      }

      await use(contexts);

      for (const context of Object.values(contexts)) {
        await context.close();
      }
    },
    { scope: "worker" },
  ],

  pageAs: async ({ roleContexts }, use) => {
    const pages: Page[] = [];
    const errors: string[] = [];

    await use(async (role) => {
      const page = await roleContexts[role].newPage();
      recordServerErrors(page, errors);
      pages.push(page);
      await page.goto("/");
      await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
      return page;
    });

    for (const page of pages) {
      await page.close();
    }

    expect(errors, "server errors or page crashes during the test").toEqual([]);
  },

  page: async ({ page }, use) => {
    const errors: string[] = [];
    recordServerErrors(page, errors);
    await use(page);
    expect(errors, "server errors or page crashes during the test").toEqual([]);
  },
});

export { expect };

export const sidebar = (page: Page) => page.getByRole("navigation", { name: "Main" });

export const statusPill = (page: Page) => page.locator("header").getByRole("link");

export const goTo = async (page: Page, section: string) => {
  await sidebar(page).getByRole("link", { name: section, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
};

export const toast = (page: Page, text: string | RegExp) =>
  expect(page.locator("[data-sonner-toast]").filter({ hasText: text }).first()).toBeVisible();

export const choose = async (page: Page, trigger: ReturnType<Page["getByLabel"]>, option: string) => {
  await trigger.click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

export const confirmDialog = async (page: Page, label: string) => {
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: label }).click();
  await expect(dialog).toBeHidden();
};

export const tableRow = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
