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
    await toast(page, `Test alert delivered to ${name}`);
    await expect(tableRow(page, name).getByText("Delivered")).toBeVisible();
    const events = await waitFor(
      () => ownerApi.get(`/webhooks/${sink.body.id}/events`),
      (response) => response.body.total > 0,
    );
    expect(JSON.parse(events.body.items[0].body)).toMatchObject({ event: "test", incident: null });

    await page.getByRole("button", { name: `Signing secret for ${name}` }).click();
    const secretDialog = page.getByRole("dialog");
    const secret = secretDialog.getByLabel("Signing secret", { exact: true });
    await expect(secret).toHaveText(/^whsec_[0-9a-f]{64}$/);
    const originalSecret = await secret.textContent();
    await secretDialog.getByRole("button", { name: "Rotate secret" }).click();
    await confirmDialog(page, "Rotate");
    await toast(page, "Signing secret rotated");
    await expect(secret).not.toHaveText(originalSecret ?? "");
    await page.keyboard.press("Escape");
    await expect(secretDialog).toBeHidden();

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

  test("a failing test alert shows the receiver error", async ({ pageAs, ownerApi }) => {
    const name = `Broken hook ${uniqueSuffix()}`;
    const channel = await ownerApi.post("/alert-channels", {
      name,
      isEnabled: true,
      destination: { type: "webhook", target: `${API_ORIGIN}/hooks/does-not-exist-${uniqueSuffix()}` },
    });

    const page = await pageAs("owner");
    await goTo(page, "Alert channels");
    await page.getByRole("button", { name: `Send test alert to ${name}` }).click();
    await toast(page, `Test alert to ${name} failed`);
    await toast(page, "Receiver answered with HTTP 404");
    await expect(tableRow(page, name).getByText("Failed")).toBeVisible();
    await expect(tableRow(page, name).getByText("Receiver answered with HTTP 404")).toBeVisible();

    await ownerApi.delete(`/alert-channels/${channel.body.id}`);
  });
});
