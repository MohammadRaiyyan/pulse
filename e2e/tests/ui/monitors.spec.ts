import { uniqueSuffix, waitFor } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";
import { choose, confirmDialog, expect, goTo, tableRow, test, toast } from "../../support/fixtures.ts";

test.describe("monitors", () => {
  test("search and status filter narrow the list and match the API", async ({ pageAs, ownerApi }) => {
    const page = await pageAs("owner");
    await goTo(page, "Monitors");

    for (const name of ["Public API", "Payments service", "Legacy SOAP gateway", "Docs site"]) {
      await expect(tableRow(page, name).first()).toBeVisible();
    }
    await expect(tableRow(page, "Docs site").getByText("Paused")).toBeVisible();

    await page.getByLabel("Search monitors").fill("legacy");
    await page.getByLabel("Search monitors").press("Enter");
    await expect(page).toHaveURL(/search=legacy/);
    await expect(tableRow(page, "Legacy SOAP gateway")).toBeVisible();
    await expect(tableRow(page, "Public API")).toHaveCount(0);

    await page.getByLabel("Search monitors").fill("");
    await page.getByLabel("Search monitors").press("Enter");
    await choose(page, page.getByLabel("Statuses"), "Up");
    await expect(page).toHaveURL(/status=up/);
    const up = (await ownerApi.get("/monitors?status=up&pageSize=100")).body;
    await expect(page.getByRole("row")).toHaveCount(up.total + 1);
  });

  test("the form rejects invalid input inline", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await goTo(page, "Monitors");
    await page.getByRole("button", { name: "New monitor" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Bad monitor");
    await dialog.getByLabel("URL").fill("ftp://example.com");
    await dialog.getByRole("button", { name: "Create monitor" }).click();
    await expect(dialog.getByText("Enter a valid http(s) URL")).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("create, watch it go down, fix it, pause, resume and delete", async ({ pageAs, ownerApi }) => {
    const page = await pageAs("owner");
    const name = `Orders API ${uniqueSuffix()}`;
    await goTo(page, "Monitors");
    await page.getByRole("button", { name: "New monitor" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("URL").fill(`${API_ORIGIN}/api/orders-missing`);
    await dialog.getByLabel("Interval (seconds)").fill("30");
    await expect(dialog.getByLabel("Failures before alerting")).toHaveValue("2");
    await dialog.getByLabel("Failures before alerting").fill("1");
    await dialog.getByLabel("On-call email").check();
    await dialog.getByRole("button", { name: "Create monitor" }).click();

    await expect(page).toHaveURL(/\/monitors\/[0-9a-f-]{36}/);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Expects HTTP 200")).toBeVisible();

    await expect(async () => {
      await page.reload();
      await expect(page.getByText("Expected HTTP 200, got 404").first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 45_000 });

    const monitorId = new URL(page.url()).pathname.split("/").pop() ?? "";
    const incidents = (await ownerApi.get("/incidents?status=open&pageSize=100")).body.items;
    expect(incidents.some((incident: { source: { id: string } }) => incident.source.id === monitorId)).toBe(true);

    await page.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog");
    await expect(edit.getByLabel("On-call email")).toBeChecked();
    await expect(edit.getByLabel("Failures before alerting")).toHaveValue("1");
    await edit.getByLabel("URL").fill(`${API_ORIGIN}/api/health`);
    await edit.getByRole("button", { name: /save/i }).click();
    await expect(edit).toBeHidden();

    await waitFor(
      () => ownerApi.get(`/monitors/${monitorId}`),
      (response) => response.body.status === "up",
      { timeout: 60_000 },
    );
    await page.reload();
    await expect(page.getByText("Up", { exact: true }).first()).toBeVisible();
    const resolved = (await ownerApi.get("/incidents?status=resolved&pageSize=100")).body.items;
    expect(resolved.some((incident: { source: { id: string } }) => incident.source.id === monitorId)).toBe(true);

    await page.getByRole("button", { name: "Pause" }).click();
    await toast(page, "Monitor paused");
    await expect(page.getByText("Paused").first()).toBeVisible();
    await page.getByRole("button", { name: "Resume" }).click();
    await toast(page, "Monitor resumed");

    await page.getByRole("button", { name: "Delete" }).click();
    await confirmDialog(page, "Delete monitor");
    await expect(page).toHaveURL(/\/monitors(\?|$)/);
    await expect(tableRow(page, name)).toHaveCount(0);
  });

  test("check history pages through results", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await goTo(page, "Monitors");
    await page.getByRole("link", { name: "Public API" }).click();
    await expect(page.getByText(/Showing 1–10 of/)).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Showing 11–20 of/)).toBeVisible();
  });
});
