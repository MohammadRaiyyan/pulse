import { uniqueSuffix, waitFor } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";
import { confirmDialog, expect, goTo, tableRow, test, toast } from "../../support/fixtures.ts";

test.describe("incidents", () => {
  test("acknowledge then resolve an incident, showing severity, who acted and history after deletion", async ({
    pageAs,
    ownerApi,
  }) => {
    const name = `Billing ${uniqueSuffix()}`;
    const monitor = await ownerApi.post("/monitors", {
      name,
      url: `${API_ORIGIN}/api/billing-missing`,
      method: "GET",
      intervalSeconds: 600,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      failureThreshold: 1,
      alertChannelIds: [],
    });
    await waitFor(
      () => ownerApi.get("/incidents?status=open&pageSize=100"),
      (response) => response.body.items.some((item: { source: { id: string } }) => item.source.id === monitor.body.id),
    );

    const page = await pageAs("owner");
    await goTo(page, "Incidents");
    await expect(page.getByRole("tab", { name: "Active" })).toHaveAttribute("data-state", "active");
    await page.getByRole("tab", { name: "Open" }).click();
    await expect(page).toHaveURL(/status=open/);

    const row = tableRow(page, name);
    await expect(row.getByText("Expected HTTP 200, got 404")).toBeVisible();
    await expect(row.getByText("Critical")).toBeVisible();
    await row.getByRole("button", { name: "Acknowledge" }).click();
    await toast(page, "Incident acknowledged");

    await page.getByRole("tab", { name: "Acknowledged" }).click();
    const acknowledged = tableRow(page, name);
    await expect(acknowledged.getByText("Acknowledged by Olivia Owner")).toBeVisible();
    await expect(acknowledged.getByRole("button", { name: "Acknowledge" })).toHaveCount(0);

    await page.getByRole("tab", { name: "Active" }).click();
    await expect(tableRow(page, name).getByText("Acknowledged by Olivia Owner")).toBeVisible();

    await tableRow(page, name).getByRole("button", { name: "Resolve" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("opens a new incident after its next failed checks");
    await confirmDialog(page, "Resolve incident");
    await toast(page, "Incident resolved");

    await page.getByRole("tab", { name: "Resolved" }).click();
    const resolved = tableRow(page, name).first();
    await expect(resolved).toBeVisible();
    await expect(resolved.getByText("Resolved by Olivia Owner")).toBeVisible();
    await expect(resolved.getByRole("button")).toHaveCount(0);

    await resolved.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`/monitors/${monitor.body.id}`));

    await ownerApi.delete(`/monitors/${monitor.body.id}`);

    await goTo(page, "Incidents");
    await page.getByRole("tab", { name: "Resolved" }).click();
    const kept = tableRow(page, name).first();
    await expect(kept).toBeVisible();
    await expect(kept.getByText("(deleted)")).toBeVisible();
    await expect(kept.getByRole("link", { name })).toHaveCount(0);
  });

  test("pausing a monitor resolves its incident automatically", async ({ pageAs, ownerApi }) => {
    const name = `Paused billing ${uniqueSuffix()}`;
    const monitor = await ownerApi.post("/monitors", {
      name,
      url: `${API_ORIGIN}/api/paused-billing-missing`,
      method: "GET",
      intervalSeconds: 600,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      failureThreshold: 1,
      alertChannelIds: [],
    });
    await waitFor(
      () => ownerApi.get("/incidents?status=open&pageSize=100"),
      (response) => response.body.items.some((item: { source: { id: string } }) => item.source.id === monitor.body.id),
    );
    await ownerApi.patch(`/monitors/${monitor.body.id}`, { isPaused: true });

    const page = await pageAs("owner");
    await goTo(page, "Incidents");
    await page.getByRole("tab", { name: "Resolved" }).click();
    await expect(tableRow(page, name).getByText("Resolved automatically: Monitor paused")).toBeVisible();

    await ownerApi.delete(`/monitors/${monitor.body.id}`);
  });
});
