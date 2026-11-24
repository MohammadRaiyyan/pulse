import { uniqueSuffix, waitFor } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";
import { confirmDialog, expect, goTo, tableRow, test, toast } from "../../support/fixtures.ts";

test.describe("integrations", () => {
  test("connect a webhook, toggle, send a real test alert, edit and delete", async ({ pageAs, ownerApi }) => {
    const sink = await ownerApi.post("/webhooks", {
      name: `Channel sink ${uniqueSuffix()}`,
      expectedIntervalSeconds: null,
      alertChannelIds: [],
    });
    const sinkUrl = `${API_ORIGIN}${new URL(sink.body.ingestUrl).pathname}`;
    const name = `Ops hook ${uniqueSuffix()}`;

    const page = await pageAs("owner");
    await goTo(page, "Integrations");
    await page.getByRole("button", { name: "Connect Webhook" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("region", { name: "How to set up Webhook" })).toContainText("X-Pulse-Signature");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Endpoint URL").fill("not a url");
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(dialog.getByText("Enter a valid http(s) URL")).toBeVisible();
    await dialog.getByLabel("Endpoint URL").fill(sinkUrl);
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(dialog).toBeHidden();
    await toast(page, `${name} connected`);
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
    await confirmDialog(page, "Delete integration");
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
    await goTo(page, "Integrations");
    await page.getByRole("button", { name: `Send test alert to ${name}` }).click();
    await toast(page, `Test alert to ${name} failed`);
    await toast(page, "Receiver answered with HTTP 404");
    await expect(tableRow(page, name).getByText("Failed")).toBeVisible();
    await expect(tableRow(page, name).getByText("Receiver answered with HTTP 404")).toBeVisible();

    await ownerApi.delete(`/alert-channels/${channel.body.id}`);
  });

  test("connect PagerDuty and keep the masked integration key on edit", async ({ pageAs, ownerApi }) => {
    const name = `Primary on-call ${uniqueSuffix()}`;
    const routingKey = `R0123456789abcdef${uniqueSuffix()}`.replace(/[^A-Za-z0-9]/g, "").padEnd(32, "x").slice(0, 32);
    const masked = `••••${routingKey.slice(-4)}`;

    const page = await pageAs("owner");
    await goTo(page, "Integrations");
    const card = page.getByRole("article", { name: "PagerDuty" });
    await expect(card).toContainText("Trigger and resolve PagerDuty incidents");
    await card.getByRole("button", { name: "Connect PagerDuty" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("region", { name: "How to set up PagerDuty" })).toContainText("Events API V2");
    await dialog.getByLabel("Name").fill(name);
    await dialog.getByLabel("Integration key").fill("too-short");
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(dialog.getByText("Enter the 32-character integration key from PagerDuty")).toBeVisible();
    await dialog.getByLabel("Integration key").fill(routingKey);
    await dialog.getByRole("button", { name: "Connect", exact: true }).click();
    await expect(dialog).toBeHidden();
    await toast(page, `${name} connected`);

    const row = tableRow(page, name);
    await expect(row.getByText("PagerDuty")).toBeVisible();
    await expect(row.getByText(masked)).toBeVisible();
    await expect(page.getByText(routingKey)).toHaveCount(0);
    await expect(card).not.toContainText("Not connected");

    await page.getByRole("button", { name: `Edit ${name}` }).click();
    const edit = page.getByRole("dialog");
    await expect(edit.getByLabel("Integration key")).toHaveValue(masked);
    await expect(edit.getByText(`Saved value ending in ${routingKey.slice(-4)}`)).toBeVisible();
    await edit.getByLabel("Name").fill(`${name} v2`);
    await edit.getByRole("button", { name: /save/i }).click();
    await expect(edit).toBeHidden();
    await expect(tableRow(page, `${name} v2`).getByText(masked)).toBeVisible();

    const channels = await ownerApi.get("/alert-channels?pageSize=100");
    const saved = channels.body.items.find((channel: { name: string }) => channel.name === `${name} v2`);
    expect(saved.destination).toEqual({ type: "pagerduty", target: masked, region: null, isMasked: true });
    expect(JSON.stringify(channels.body)).not.toContain(routingKey);

    await ownerApi.delete(`/alert-channels/${saved.id}`);
  });

  test("the old alert channels address opens the integrations page", async ({ pageAs }) => {
    const page = await pageAs("owner");
    await page.goto("/alert-channels");
    await expect(page).toHaveURL(/\/integrations/);
    await expect(page.getByRole("heading", { level: 1, name: "Integrations" })).toBeVisible();
  });
});
