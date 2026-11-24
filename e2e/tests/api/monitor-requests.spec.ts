import { expect, test } from "../../support/fixtures.ts";
import { uniqueSuffix, waitFor } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";

const SECRET_VALUE = `probe-${uniqueSuffix()}`;

test.describe("monitor request headers and body", () => {
  test("checks send secret headers and the body, and the API never returns the secret", async ({
    ownerApi: owner,
  }) => {
    const webhook = await owner.post("/webhooks", {
      name: `Probe target ${uniqueSuffix()}`,
      expectedIntervalSeconds: null,
      alertChannelIds: [],
    });
    expect(webhook.status).toBe(201);
    const ingestPath = new URL(webhook.body.ingestUrl).pathname;

    const created = await owner.post("/monitors", {
      name: `Private health ${uniqueSuffix()}`,
      url: `${API_ORIGIN}${ingestPath}`,
      method: "POST",
      intervalSeconds: 30,
      timeoutMs: 5000,
      expectedStatusCode: 202,
      alertChannelIds: [],
      requestHeaders: [
        { name: "X-Probe-Credential", value: SECRET_VALUE, secret: true },
        { name: "X-Region", value: "eu-west", secret: false },
      ],
      requestBody: '{"ping":true}',
      requestContentType: "application/json",
    });
    expect(created.status).toBe(201);
    expect(created.body.requestHeaders).toEqual([
      { name: "X-Probe-Credential", value: null, secret: true },
      { name: "X-Region", value: "eu-west", secret: false },
    ]);
    const monitorId = created.body.id;

    const events = await waitFor(
      () => owner.get(`/webhooks/${webhook.body.id}/events`),
      (response) => response.body.total > 0,
    );
    const [event] = events.body.items;
    expect(event).toMatchObject({
      method: "POST",
      body: '{"ping":true}',
      contentType: "application/json",
    });
    expect(event.headers["x-probe-credential"]).toBe(SECRET_VALUE);
    expect(event.headers["x-region"]).toBe("eu-west");
    expect(event.headers["user-agent"]).toBe("PulseMonitor/1.0");

    const up = await waitFor(
      () => owner.get(`/monitors/${monitorId}`),
      (response) => response.body.status === "up",
    );
    const listed = await owner.get("/monitors?pageSize=100");
    for (const body of [created.body, up.body, listed.body]) {
      expect(JSON.stringify(body)).not.toContain(SECRET_VALUE);
    }

    const kept = await owner.patch(`/monitors/${monitorId}`, {
      requestHeaders: [{ name: "X-Probe-Credential", value: null, secret: true }],
    });
    expect(kept.status).toBe(200);
    expect(JSON.stringify(kept.body)).not.toContain(SECRET_VALUE);

    const bodyOnGet = await owner.patch(`/monitors/${monitorId}`, { method: "GET" });
    expect(bodyOnGet.status).toBe(400);
    expect(bodyOnGet.body.error.fieldErrors.requestBody).toEqual(["GET requests cannot send a body"]);

    expect((await owner.delete(`/monitors/${monitorId}`)).status).toBe(204);
    expect((await owner.delete(`/webhooks/${webhook.body.id}`)).status).toBe(204);
  });
});
