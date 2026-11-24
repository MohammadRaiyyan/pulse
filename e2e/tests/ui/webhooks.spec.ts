import { uniqueSuffix } from "../../support/api-client.ts";
import { confirmDialog, expect, goTo, tableRow, test } from "../../support/fixtures.ts";

test.describe("webhooks", () => {
  test("create, receive, inspect, edit and delete an endpoint", async ({ pageAs, ownerApi }) => {
    const name = `CI pipeline ${uniqueSuffix()}`;
    const page = await pageAs("owner");
    await goTo(page, "Webhooks");
    await page.getByRole("button", { name: "New endpoint" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Silence alert (seconds)").fill("3600");
    await dialog.getByRole("button", { name: /create/i }).click();
    await expect(dialog).toBeHidden();

    if (!/\/webhooks\/[0-9a-f-]{36}/.test(page.url())) {
      await page.getByRole("link", { name }).click();
    }

    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("No events received")).toBeVisible();
    await expect(page.getByText("1h", { exact: true })).toBeVisible();

    const webhookId = new URL(page.url()).pathname.split("/").pop() ?? "";
    const { ingestUrl } = (await ownerApi.get(`/webhooks/${webhookId}`)).body;
    await expect(page.getByText(ingestUrl)).toBeVisible();

    const sent = await fetch(ingestUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Build": "42" },
      body: '{"build":42,"result":"passed"}',
    });
    expect(sent.status).toBe(202);

    await page.reload();
    await expect(page.getByText("Active").first()).toBeVisible();
    await page.getByRole("button", { name: "Inspect" }).first().click();
    const inspector = page.getByRole("dialog");
    await expect(inspector.getByText('"passed"')).toBeVisible();
    await inspector.getByRole("tab", { name: "Headers" }).click();
    await expect(inspector.getByText("x-build: 42")).toBeVisible();
    await inspector.getByRole("button", { name: /close/i }).click();
    await expect(inspector).toBeHidden();

    await page.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog");
    await edit.getByLabel("Name").fill(`${name} main`);
    await edit.getByRole("button", { name: /save/i }).click();
    await expect(edit).toBeHidden();
    await expect(page.getByRole("heading", { name: `${name} main` })).toBeVisible();
    await expect(page.getByText(ingestUrl)).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await confirmDialog(page, "Delete webhook");
    await expect(page).toHaveURL(/\/webhooks(\?|$)/);
    await expect(tableRow(page, `${name} main`)).toHaveCount(0);
    expect((await fetch(ingestUrl, { method: "POST", body: "{}" })).status).toBe(404);
  });
});
