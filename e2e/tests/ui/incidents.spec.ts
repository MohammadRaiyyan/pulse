import { uniqueSuffix, waitFor } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";
import { expect, goTo, tableRow, test, toast } from "../../support/fixtures.ts";

test.describe("incidents", () => {
  test("acknowledge then resolve an incident, with filters and counts updating", async ({ pageAs, ownerApi }) => {
    const name = `Billing ${uniqueSuffix()}`;
    const monitor = await ownerApi.post("/monitors", {
      name,
      url: `${API_ORIGIN}/api/billing-missing`,
      method: "GET",
      intervalSeconds: 600,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      alertChannelIds: [],
    });
    await waitFor(
      () => ownerApi.get("/incidents?status=open&pageSize=100"),
      (response) => response.body.items.some((item: { source: { id: string } }) => item.source.id === monitor.body.id),
    );

    const page = await pageAs("owner");
    await goTo(page, "Incidents");
    await page.getByRole("tab", { name: "Open" }).click();
    await expect(page).toHaveURL(/status=open/);

    const row = tableRow(page, name);
    await expect(row.getByText("Expected HTTP 200, got 404")).toBeVisible();
    await row.getByRole("button", { name: "Acknowledge" }).click();
    await toast(page, "Incident acknowledged");

    await page.getByRole("tab", { name: "Acknowledged" }).click();
    await expect(tableRow(page, name).getByRole("button", { name: "Acknowledge" })).toHaveCount(0);
    await tableRow(page, name).getByRole("button", { name: "Resolve" }).click();
    await toast(page, "Incident resolved");

    await page.getByRole("tab", { name: "Resolved" }).click();
    await expect(tableRow(page, name).first()).toBeVisible();
    await expect(tableRow(page, name).first().getByRole("button")).toHaveCount(0);

    await tableRow(page, name).first().getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`/monitors/${monitor.body.id}`));

    await ownerApi.delete(`/monitors/${monitor.body.id}`);
  });
});
