import { uniqueSuffix, waitFor } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";
import { choose, confirmDialog, expect, goTo, tableRow, test, toast } from "../../support/fixtures.ts";

test.describe("alert channels", () => {
  test("validate, create, toggle, send a real test alert, edit and delete", async ({ pageAs, ownerApi }) => {
    const sink = await ownerApi.post("/webhooks", {
      name: `Channel sink ${uniqueSuffix()}`,
      expectedIntervalSeconds: null,
      alertChannelIds: [],
    });
    const sinkUrl = `${API_ORIGIN}${new URL(sink.body.ingestUrl).pathname}`;
    const name = `Ops hook ${uniqueSuffix()}`;

    const page = await pageAs("owner");
    await goTo(page, "Alert channels");
    await page.getByRole("button", { name: "New channel" }).first().click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(name);
    await choose(page, dialog.getByLabel("Type"), "Webhook");
    await dialog.getByLabel("Endpoint URL").fill("not a url");
    await dialog.getByRole("button", { name: /create/i }).click();
    await expect(dialog.getByText("Enter a valid http(s) URL")).toBeVisible();
    await dialog.getByLabel("Endpoint URL").fill(sinkUrl);
    await dialog.getByRole("button", { name: /create/i }).click();
    await expect(dialog).toBeHidden();
    await expect(tableRow(page, name)).toBeVisible();

    await page.getByLabel(`Toggle ${name}`).click();
    await toast(page, `${name} disabled`);
    await expect(page.getByRole("button", { name: `Send test alert to ${name}` })).toBeDisabled();
    await page.getByLabel(`Toggle ${name}`).click();
    await toast(page, `${name} enabled`);

    await page.getByRole("button", { name: `Send test alert to ${name}` }).click();
    const events = await waitFor(
      () => ownerApi.get(`/webhooks/${sink.body.id}/events`),
      (response) => response.body.total > 0,
    );
    expect(JSON.parse(events.body.items[0].body)).toMatchObject({ event: "test", incident: null });

    await page.getByRole("button", { name: `Edit ${name}` }).click();
    const edit = page.getByRole("dialog");
    await edit.getByLabel("Name").fill(`${name} v2`);
    await edit.getByRole("button", { name: /save/i }).click();
    await expect(edit).toBeHidden();
    await expect(tableRow(page, `${name} v2`)).toBeVisible();

    await page.getByRole("button", { name: `Delete ${name} v2` }).click();
    await confirmDialog(page, "Delete alert channel");
    await expect(tableRow(page, `${name} v2`)).toHaveCount(0);

    await ownerApi.delete(`/webhooks/${sink.body.id}`);
  });
});
