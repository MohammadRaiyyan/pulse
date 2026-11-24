import { expect, sidebar, statusPill, tableRow, test } from "../../support/fixtures.ts";

test.describe("dashboard", () => {
  test("cards, status pill and sidebar badge count active incidents like the API", async ({ pageAs, ownerApi }) => {
    const page = await pageAs("owner");
    await expect(page.getByRole("heading", { name: "Hi, Olivia" })).toBeVisible();

    const summary = (await ownerApi.get("/dashboard/summary")).body;
    const main = page.locator("main");

    await expect(main.getByText(`/ ${summary.monitors.total}`)).toBeVisible();

    const expectedPill =
      summary.activeIncidents > 0
        ? `${summary.activeIncidents} active incident`
        : summary.monitors.byStatus.degraded > 0
          ? "Degraded performance"
          : "All systems operational";
    await expect(statusPill(page)).toContainText(expectedPill);

    if (summary.activeIncidents > 0) {
      await expect(sidebar(page).getByRole("link", { name: /Incidents/ }).locator("..")).toContainText(
        String(summary.activeIncidents),
      );
    }
  });

  test("the active incidents card lists open and acknowledged incidents with their state", async ({ pageAs, ownerApi }) => {
    const active = (await ownerApi.get("/incidents?status=active&pageSize=5")).body.items;
    const page = await pageAs("owner");
    const card = page.locator("main");

    await expect(card.getByText("Active incidents").first()).toBeVisible();
    await expect(card.getByText("Issues that still need attention")).toBeVisible();

    for (const incident of active) {
      const row = tableRow(page, incident.source.name).first();
      await expect(row).toBeVisible();
      await expect(row.getByText(incident.status === "open" ? "Open" : "Acknowledged", { exact: true })).toBeVisible();
    }
  });

  test("the status pill links to active incidents", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await statusPill(page).click();
    await expect(page).toHaveURL(/\/incidents\?status=active/);
    await expect(page.getByRole("tab", { name: "Active" })).toHaveAttribute("data-state", "active");
  });
});
