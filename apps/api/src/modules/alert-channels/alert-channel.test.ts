import { randomUUID } from "node:crypto";
import { type IncomingHttpHeaders, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  registerUser,
  request,
  signInWithRole,
  useTestServer,
} from "../../test/client.ts";
import { waitForEmail } from "../../test/mail.ts";
import { deliverAlert } from "./alert-delivery.service.ts";
import { signWebhookPayload } from "./webhook-signature.ts";

useTestServer();

type ReceivedRequest = { url: string; headers: IncomingHttpHeaders; body: string };

let receiverUrl = "";
let received: ReceivedRequest[] = [];

const receiver = createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    received.push({ url: req.url ?? "", headers: req.headers, body });

    if (req.url === "/hang") {
      return;
    }

    res.statusCode = req.url === "/broken" ? 500 : 200;
    res.end("ok");
  });
});

beforeAll(() => {
  receiver.listen(0);
  receiverUrl = `http://localhost:${(receiver.address() as AddressInfo).port}`;
});

afterAll(() => {
  receiver.closeAllConnections();
  receiver.close();
});

beforeEach(() => {
  received = [];
});

const createChannel = async (
  token: string,
  destination: { type: string; target: string; region?: string },
) => {
  const response = await request("/api/alert-channels", {
    method: "POST",
    token,
    body: { name: `Channel ${randomUUID()}`, isEnabled: true, destination },
  });
  expect(response.status).toBe(201);
  return response.body;
};

const sendTest = (id: string, token: string) =>
  request(`/api/alert-channels/${id}/test`, { method: "POST", token });

describe("alert channels", () => {
  it("delivers a signed test webhook and reports success", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channel = await createChannel(token, {
      type: "webhook",
      target: `${receiverUrl}/ok`,
    });
    expect(channel.lastDelivery).toBeNull();
    expect(channel.signingSecret).toBeUndefined();

    const result = await sendTest(channel.id, token);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      event: "test",
      status: "success",
      attempts: 1,
      lastError: null,
      incidentId: null,
    });

    const [delivered] = received;
    expect(JSON.parse(delivered?.body ?? "")).toMatchObject({ event: "test" });

    const secret = await request(
      `/api/alert-channels/${channel.id}/signing-secret`,
      { token },
    );
    const timestamp = String(delivered?.headers["x-pulse-timestamp"]);
    expect(Math.abs(Number(timestamp) - Date.now() / 1000)).toBeLessThan(60);
    expect(delivered?.headers["x-pulse-signature"]).toBe(
      signWebhookPayload(
        secret.body.signingSecret,
        timestamp,
        delivered?.body ?? "",
      ),
    );

    const list = await request("/api/alert-channels", { token });
    expect(list.body.items[0].lastDelivery).toMatchObject({
      id: result.body.id,
      status: "success",
    });
  });

  it("reports a failed test delivery with the receiver error", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channel = await createChannel(token, {
      type: "slack",
      target: `${receiverUrl}/broken`,
    });

    const result = await sendTest(channel.id, token);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      status: "failed",
      lastError: "Receiver answered with HTTP 500",
    });
    expect(received[0]?.headers["x-pulse-signature"]).toBeUndefined();

    const fetched = await request(`/api/alert-channels/${channel.id}`, {
      token,
    });
    expect(fetched.body.lastDelivery.status).toBe("failed");
  });

  it("gives up on a test delivery that does not answer in time", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channel = await createChannel(token, {
      type: "webhook",
      target: `${receiverUrl}/hang`,
    });

    const result = await sendTest(channel.id, token);
    expect(result.body).toMatchObject({
      status: "failed",
      lastError: "Timed out waiting for the receiver",
    });
  }, 15_000);

  it("sends email alerts through the mailer", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channel = await createChannel(token, {
      type: "email",
      target: "oncall@test.dev",
    });

    const result = await sendTest(channel.id, token);
    expect(result.body.status).toBe("success");

    const email = await waitForEmail("oncall@test.dev");
    expect(email.subject).toBe("Pulse test alert");
    expect(email.text).toContain("Test alert from Pulse");
  });

  it("refuses a test alert for a disabled channel", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channel = await createChannel(token, {
      type: "webhook",
      target: `${receiverUrl}/ok`,
    });
    await request(`/api/alert-channels/${channel.id}`, {
      method: "PATCH",
      token,
      body: { isEnabled: false },
    });

    const result = await sendTest(channel.id, token);
    expect(result.status).toBe(409);
    expect(received).toHaveLength(0);
  });

  it("records every job attempt on one delivery and the final failure", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channel = await createChannel(token, {
      type: "webhook",
      target: `${receiverUrl}/broken`,
    });
    const job = {
      channelId: channel.id,
      event: "test" as const,
      deliveryId: randomUUID(),
    };

    await expect(
      deliverAlert(job, { attempt: 1, maxAttempts: 3 }),
    ).rejects.toThrow("HTTP 500");

    const retrying = await request(
      `/api/alert-channels/${channel.id}/deliveries`,
      { token },
    );
    expect(retrying.body.total).toBe(1);
    expect(retrying.body.items[0]).toMatchObject({
      id: job.deliveryId,
      status: "retrying",
      attempts: 1,
    });

    await expect(
      deliverAlert(job, { attempt: 3, maxAttempts: 3 }),
    ).rejects.toThrow("HTTP 500");

    const failed = await request(
      `/api/alert-channels/${channel.id}/deliveries`,
      { token },
    );
    expect(failed.body.total).toBe(1);
    expect(failed.body.items[0]).toMatchObject({
      status: "failed",
      attempts: 3,
      lastError: "Receiver answered with HTTP 500",
    });
  });

  it("shows and rotates signing secrets only for writers and webhook channels", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const member = await signInWithRole("member", "member@test.dev");
    const webhook = await createChannel(token, {
      type: "webhook",
      target: `${receiverUrl}/ok`,
    });
    const slack = await createChannel(token, {
      type: "slack",
      target: `${receiverUrl}/ok`,
    });
    const secretPath = `/api/alert-channels/${webhook.id}/signing-secret`;

    const forbidden = await request(secretPath, { token: member.token });
    expect(forbidden.status).toBe(403);

    const original = await request(secretPath, { token });
    expect(original.body.signingSecret).toMatch(/^whsec_[0-9a-f]{64}$/);

    const rotated = await request(`${secretPath}/rotate`, {
      method: "POST",
      token,
    });
    expect(rotated.body.signingSecret).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(rotated.body.signingSecret).not.toBe(original.body.signingSecret);

    const current = await request(secretPath, { token });
    expect(current.body.signingSecret).toBe(rotated.body.signingSecret);

    const notWebhook = await request(
      `/api/alert-channels/${slack.id}/signing-secret`,
      { token },
    );
    expect(notWebhook.status).toBe(409);

    const missing = await request(
      `/api/alert-channels/${randomUUID()}/signing-secret/rotate`,
      { method: "POST", token },
    );
    expect(missing.status).toBe(404);
  });

  it("posts an Adaptive Card to Microsoft Teams", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channel = await createChannel(token, {
      type: "teams",
      target: `${receiverUrl}/teams`,
    });

    const result = await sendTest(channel.id, token);
    expect(result.body.status).toBe("success");

    const payload = JSON.parse(received[0]?.body ?? "");
    expect(payload.type).toBe("message");
    expect(payload.attachments[0].content.type).toBe("AdaptiveCard");
  });

  it("masks secret targets and keeps them when the masked value comes back", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const discordUrl = `${receiverUrl}/discord/token-abcd`;
    const channel = await createChannel(token, {
      type: "discord",
      target: discordUrl,
    });
    expect(channel.destination).toEqual({
      type: "discord",
      target: "••••abcd",
      region: null,
      isMasked: true,
    });

    const list = await request("/api/alert-channels", { token });
    expect(JSON.stringify(list.body)).not.toContain("token-abcd");

    const renamed = await request(`/api/alert-channels/${channel.id}`, {
      method: "PATCH",
      token,
      body: {
        name: "Renamed",
        destination: { type: "discord", target: channel.destination.target },
      },
    });
    expect(renamed.status).toBe(200);
    expect(renamed.body.destination.target).toBe("••••abcd");

    const omitted = await request(`/api/alert-channels/${channel.id}`, {
      method: "PATCH",
      token,
      body: { destination: { type: "discord" } },
    });
    expect(omitted.status).toBe(200);

    await sendTest(channel.id, token);
    expect(received[0]?.url).toBe("/discord/token-abcd");

    const replaced = await request(`/api/alert-channels/${channel.id}`, {
      method: "PATCH",
      token,
      body: {
        destination: { type: "discord", target: `${receiverUrl}/new-wxyz` },
      },
    });
    expect(replaced.body.destination.target).toBe("••••wxyz");
  });

  it("requires new credentials when the channel type changes", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channel = await createChannel(token, {
      type: "slack",
      target: `${receiverUrl}/ok`,
    });

    const response = await request(`/api/alert-channels/${channel.id}`, {
      method: "PATCH",
      token,
      body: { destination: { type: "teams", target: "••••/ok" } },
    });
    expect(response.status).toBe(400);
    expect(response.body.error.fieldErrors.destination).toBeDefined();
  });

  it("stores PagerDuty and Opsgenie keys masked, with the Opsgenie region", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const pagerduty = await createChannel(token, {
      type: "pagerduty",
      target: "R0123456789abcdefABCDEF01234WXYZ",
    });
    expect(pagerduty.destination).toMatchObject({
      target: "••••WXYZ",
      isMasked: true,
      region: null,
    });

    const opsgenie = await createChannel(token, {
      type: "opsgenie",
      target: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
      region: "eu",
    });
    expect(opsgenie.destination).toEqual({
      type: "opsgenie",
      target: "••••3c4d",
      region: "eu",
      isMasked: true,
    });

    const moved = await request(`/api/alert-channels/${opsgenie.id}`, {
      method: "PATCH",
      token,
      body: { destination: { type: "opsgenie", region: "us" } },
    });
    expect(moved.body.destination).toMatchObject({
      target: "••••3c4d",
      region: "us",
    });

    const webhook = await createChannel(token, {
      type: "webhook",
      target: `${receiverUrl}/ok`,
    });
    expect(webhook.destination).toEqual({
      type: "webhook",
      target: `${receiverUrl}/ok`,
      region: null,
      isMasked: false,
    });

    const counts = await request("/api/alert-channels/counts", { token });
    expect(counts.status).toBe(200);
    expect(counts.body).toEqual([
      { type: "pagerduty", count: 1 },
      { type: "opsgenie", count: 1 },
      { type: "webhook", count: 1 },
    ]);
  });

  it("rejects malformed provider keys", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const create = (destination: Record<string, string>) =>
      request("/api/alert-channels", {
        method: "POST",
        token,
        body: { name: "Bad", isEnabled: true, destination },
      });

    const pagerduty = await create({ type: "pagerduty", target: "short" });
    expect(pagerduty.status).toBe(400);

    const opsgenie = await create({
      type: "opsgenie",
      target: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    });
    expect(opsgenie.status).toBe(400);

    const masked = await create({ type: "slack", target: "••••abcd" });
    expect(masked.status).toBe(400);
  });
});
