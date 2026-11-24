import { uniqueSuffix } from "../../support/api-client.ts";
import { choose, confirmDialog, expect, goTo, tableRow, test, toast } from "../../support/fixtures.ts";

test.describe("services and status page", () => {
  test("create a service, assign a monitor, publish the status page and view it signed out", async ({
    pageAs,
    ownerApi,
    browser,
  }) => {
    const serviceName = `Storefront ${uniqueSuffix()}`;
    const monitorName = `Storefront backend ${uniqueSuffix()}`;
    const title = `Acme status ${uniqueSuffix()}`;
    const monitor = await ownerApi.post("/monitors", {
      name: monitorName,
      url: "https://storefront.internal.example.com/health",
      method: "GET",
      intervalSeconds: 600,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      alertChannelIds: [],
    });
    expect(monitor.status).toBe(201);

    const page = await pageAs("owner");
    await goTo(page, "Services");
    await expect(tableRow(page, "Public API")).toBeVisible();
    await page.getByRole("button", { name: "New service" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(serviceName);
    await dialog.getByLabel("Description").fill("Shop front and checkout");
    await dialog.getByLabel("Show on status page").click();
    await dialog.getByRole("button", { name: "Create service" }).click();
    await expect(dialog).toBeHidden();

    await expect(page).toHaveURL(/\/services\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name: serviceName })).toBeVisible();
    const servicePath = new URL(page.url()).pathname;
    await expect(page.getByText("No data").first()).toBeVisible();
    await expect(page.getByText("No members", { exact: true }).first()).toBeVisible();

    await page.goto(`/monitors/${monitor.body.id}`);
    await page.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog");
    await choose(page, edit.getByLabel("Service"), serviceName);
    await edit.getByRole("button", { name: /save/i }).click();
    await expect(edit).toBeHidden();

    await goTo(page, "Services");
    await expect(tableRow(page, serviceName).getByText("1 monitor, 0 webhooks")).toBeVisible();
    await expect(tableRow(page, serviceName).getByText("Public")).toBeVisible();
    await page.getByRole("link", { name: serviceName }).click();
    await expect(tableRow(page, monitorName)).toBeVisible();
    await expect(page.getByLabel("Daily uptime")).toBeVisible();

    await goTo(page, "Status page");
    const publish = page.getByLabel("Publish the status page");
    if ((await publish.getAttribute("aria-checked")) !== "true") {
      await publish.click();
    }
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Short description").fill("Live health of the Acme shop.");
    await page.getByRole("button", { name: "Save settings" }).click();
    await toast(page, "Status page settings saved");
    await expect(page.getByRole("link", { name: "View public page" })).toHaveAttribute("href", "/status");

    const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const publicPage = await visitor.newPage();
    await publicPage.goto(new URL("/status", page.url()).href);
    await expect(publicPage.getByRole("heading", { name: title })).toBeVisible();
    await expect(publicPage.getByText("Live health of the Acme shop.")).toBeVisible();
    await expect(
      publicPage.getByText(/All systems operational|Degraded performance|Partial outage|Major outage/),
    ).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: serviceName })).toBeVisible();
    await expect(publicPage.getByText("Shop front and checkout")).toBeVisible();
    await expect(publicPage.getByRole("heading", { name: "Internal", exact: true })).toHaveCount(0);
    await expect(publicPage.getByText(monitorName)).toHaveCount(0);
    await expect(publicPage.getByText("storefront.internal.example.com")).toHaveCount(0);
    await expect(publicPage.getByRole("navigation", { name: "Main" })).toHaveCount(0);
    await visitor.close();

    await page.goto(servicePath);
    await page.getByRole("button", { name: "Delete" }).click();
    await confirmDialog(page, "Delete service");
    await expect(page).toHaveURL(/\/services(\?|$)/);
    await expect(tableRow(page, serviceName)).toHaveCount(0);
    await ownerApi.delete(`/monitors/${monitor.body.id}`);
  });
});
