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
  destination: { type: string; target: string },
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
});
