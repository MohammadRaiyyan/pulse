import { expect, sidebar, statusPill, test } from "../../support/fixtures.ts";

test.describe("dashboard", () => {
  test("cards, status pill and sidebar badge agree with the API", async ({ pageAs, ownerApi }) => {
    const page = await pageAs("owner");
    await expect(page.getByRole("heading", { name: "Hi, Olivia" })).toBeVisible();

    const summary = (await ownerApi.get("/dashboard/summary")).body;
    const main = page.locator("main");

    await expect(main.getByText(`/ ${summary.monitors.total}`)).toBeVisible();

    const expectedPill =
      summary.openIncidents > 0
        ? `${summary.openIncidents} open incident`
        : summary.monitors.byStatus.degraded > 0
          ? "Degraded performance"
          : "All systems operational";
    await expect(statusPill(page)).toContainText(expectedPill);

    if (summary.openIncidents > 0) {
      await expect(sidebar(page).getByRole("link", { name: /Incidents/ }).locator("..")).toContainText(
        String(summary.openIncidents),
      );
    }
  });

  test("the status pill links to open incidents", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await statusPill(page).click();
    await expect(page).toHaveURL(/\/incidents\?status=open/);
    await expect(page.getByRole("tab", { name: "Open" })).toHaveAttribute("data-state", "active");
  });
});
