import type { Page } from "@playwright/test";
import { uniqueSuffix } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";
import { expect, goTo, tableRow, test } from "../../support/fixtures.ts";

const INCIDENT_WAIT_MS = 150_000;

const monitorInput = (name: string, url: string) => ({
  name,
  url,
  method: "GET",
  intervalSeconds: 30,
  timeoutMs: 5000,
  expectedStatusCode: 200,
  alertChannelIds: [],
});

const liveIndicator = (page: Page) => page.locator("header").getByRole("status");

const markPage = (page: Page) =>
  page.evaluate(() => {
    Object.assign(window, { liveUpdatesMarker: true });
  });

const isSamePage = (page: Page) => page.evaluate(() => "liveUpdatesMarker" in window);

test.describe("live updates", () => {
  test("an incident opened by the worker appears on an open dashboard", async ({ pageAs, ownerApi }) => {
    test.setTimeout(INCIDENT_WAIT_MS + 30_000);

    const name = `Live outage ${uniqueSuffix()}`;
    const page = await pageAs("owner");
    await expect(liveIndicator(page)).toContainText("Live");
    await markPage(page);

    await expect(tableRow(page, name)).toHaveCount(0);

    const monitor = await ownerApi.post("/monitors", monitorInput(name, `${API_ORIGIN}/api/live-missing`));
    expect(monitor.status).toBe(201);

    await expect(tableRow(page, name).first()).toBeVisible({ timeout: INCIDENT_WAIT_MS });
    expect(await isSamePage(page)).toBe(true);

    await ownerApi.delete(`/monitors/${monitor.body.id}`);
  });

  test("a monitor created through the API appears in an open monitors list", async ({ pageAs, ownerApi }) => {
    const name = `Live monitor ${uniqueSuffix()}`;
    const page = await pageAs("viewer");
    await goTo(page, "Monitors");
    await expect(liveIndicator(page)).toContainText("Live");
    await markPage(page);
    await expect(tableRow(page, name)).toHaveCount(0);

    const monitor = await ownerApi.post("/monitors", monitorInput(name, `${API_ORIGIN}/api/health`));
    expect(monitor.status).toBe(201);

    await expect(tableRow(page, name)).toBeVisible();
    expect(await isSamePage(page)).toBe(true);

    await ownerApi.delete(`/monitors/${monitor.body.id}`);
    await expect(tableRow(page, name)).toHaveCount(0);
  });
});
