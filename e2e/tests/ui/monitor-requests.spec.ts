import { uniqueSuffix, waitFor } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";
import { choose, expect, goTo, test } from "../../support/fixtures.ts";

test.describe("monitor request settings", () => {
  test("adds a secret header and a JSON body in the form", async ({ pageAs, ownerApi }) => {
    const secretValue = `probe-${uniqueSuffix()}`;
    const webhook = await ownerApi.post("/webhooks", {
      name: `UI probe target ${uniqueSuffix()}`,
      expectedIntervalSeconds: null,
      alertChannelIds: [],
    });
    const ingestPath = new URL(webhook.body.ingestUrl).pathname;

    const page = await pageAs("owner");
    const name = `Private health ${uniqueSuffix()}`;
    await goTo(page, "Monitors");
    await page.getByRole("button", { name: "New monitor" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("URL").fill(`${API_ORIGIN}${ingestPath}`);
    await dialog.getByLabel("Interval (seconds)").fill("30");
    await dialog.getByLabel("Expected status").fill("202");
    await dialog.getByRole("button", { name: /^Request/ }).click();

    await expect(dialog.getByLabel("Body")).toBeDisabled();
    await expect(dialog.getByText("GET requests cannot send a body.", { exact: false })).toBeVisible();
    await choose(page, dialog.getByLabel("Method"), "POST");
    await expect(dialog.getByLabel("Body")).toBeEnabled();

    await dialog.getByRole("button", { name: "Add header" }).click();
    await dialog.getByLabel("Header 1", { exact: true }).fill("Host");
    await expect(dialog.getByText("This header is managed by Pulse and cannot be set")).toBeVisible();
    await dialog.getByLabel("Header 1", { exact: true }).fill("X-Probe-Credential");
    await dialog.getByLabel("Header 1 is secret").click();
    await dialog.getByLabel("Header 1 value").fill(secretValue);
    await expect(dialog.getByLabel("Header 1 value")).toHaveAttribute("type", "password");

    await dialog.getByLabel("Body").fill('{"ping": ');
    await expect(dialog.getByText("Enter valid JSON")).toBeVisible();
    await dialog.getByLabel("Body").fill('{"ping": true}');
    await expect(dialog.getByText("Enter valid JSON")).toBeHidden();
    await dialog.getByRole("button", { name: "Create monitor" }).click();

    await expect(page).toHaveURL(/\/monitors\/[0-9a-f-]{36}/);
    const summary = page.getByTestId("monitor-request-summary");
    await expect(summary.getByText("X-Probe-Credential")).toBeVisible();
    await expect(summary.getByText(/JSON, 14 B/)).toBeVisible();
    await expect(page.getByText(secretValue)).toHaveCount(0);

    const events = await waitFor(
      () => ownerApi.get(`/webhooks/${webhook.body.id}/events`),
      (response) => response.body.total > 0,
    );
    expect(events.body.items[0].headers["x-probe-credential"]).toBe(secretValue);
    expect(events.body.items[0].body).toBe('{"ping": true}');

    await page.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog");
    await expect(edit.getByText("Saved")).toBeVisible();
    await expect(edit.getByRole("button", { name: "Replace" })).toBeVisible();
    await edit.getByRole("button", { name: /save/i }).click();
    await expect(edit).toBeHidden();

    const monitorId = new URL(page.url()).pathname.split("/").pop() ?? "";
    const monitor = await ownerApi.get(`/monitors/${monitorId}`);
    expect(monitor.body.requestHeaders).toEqual([{ name: "X-Probe-Credential", value: null, secret: true }]);
    expect(JSON.stringify(monitor.body)).not.toContain(secretValue);

    expect((await ownerApi.delete(`/monitors/${monitorId}`)).status).toBe(204);
    expect((await ownerApi.delete(`/webhooks/${webhook.body.id}`)).status).toBe(204);
  });
});
