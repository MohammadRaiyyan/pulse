import { type SseMessage, createSseParser } from "@pulse/contracts";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { closeChangeSubscriber, publishChange } from "../../lib/realtime.ts";
import {
  registerUser,
  request,
  sendRaw,
  signInWithRole,
  useTestServer,
} from "../../test/client.ts";
import {
  closeAllLiveStreams,
  countLiveStreams,
} from "./live-stream.service.ts";

useTestServer();

const openStreams: AbortController[] = [];

const openStream = async (token?: string) => {
  const controller = new AbortController();
  openStreams.push(controller);

  const response = await sendRaw("/api/events", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: controller.signal,
  });

  const messages: SseMessage[] = [];
  const parse = createSseParser((message) => messages.push(message));
  let raw = "";
  let isEnded = false;

  const consume = async () => {
    if (!response.ok || !response.body) {
      return;
    }

    const decoder = new TextDecoder();

    try {
      for await (const chunk of response.body) {
        const text = decoder.decode(chunk, { stream: true });
        raw += text;
        parse(text);
      }
    } catch {
      return;
    } finally {
      isEnded = true;
    }
  };

  void consume();

  return {
    response,
    messages,
    raw: () => raw,
    isEnded: () => isEnded,
    changes: () =>
      messages
        .filter((message) => message.event === "change")
        .map((message) => JSON.parse(message.data)),
    close: () => controller.abort(),
  };
};

type LiveStream = Awaited<ReturnType<typeof openStream>>;

const waitForReady = (stream: LiveStream) =>
  vi.waitFor(() => {
    expect(stream.messages.some((message) => message.event === "ready")).toBe(
      true,
    );
  });

afterEach(() => {
  for (const controller of openStreams.splice(0)) {
    controller.abort();
  }
  closeAllLiveStreams();
});

afterAll(async () => {
  await closeChangeSubscriber();
});

describe("live updates stream", () => {
  it("requires a valid access token", async () => {
    const missing = await openStream();
    const invalid = await openStream("not-a-token");

    expect(missing.response.status).toBe(401);
    expect(invalid.response.status).toBe(401);
    expect(missing.response.headers.get("content-type")).toContain(
      "application/json",
    );
  });

  it("rejects a token whose user no longer exists", async () => {
    const { token: ownerToken } = await registerUser("Owner", "owner@test.dev");
    const viewer = await signInWithRole("viewer", "viewer@test.dev");

    await request(`/api/members/${viewer.user.id}`, {
      method: "DELETE",
      token: ownerToken,
    });

    const stream = await openStream(viewer.token);
    expect(stream.response.status).toBe(401);
  });

  it("streams with headers that disable buffering", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const stream = await openStream(token);

    expect(stream.response.status).toBe(200);
    expect(stream.response.headers.get("content-type")).toContain(
      "text/event-stream",
    );
    expect(stream.response.headers.get("cache-control")).toContain(
      "no-transform",
    );
    expect(stream.response.headers.get("x-accel-buffering")).toBe("no");
    await waitForReady(stream);
  });

  it("lets any role subscribe and delivers changes made through the API", async () => {
    const { token: ownerToken } = await registerUser("Owner", "owner@test.dev");
    const viewer = await signInWithRole("viewer", "viewer@test.dev");
    const stream = await openStream(viewer.token);
    await waitForReady(stream);

    const created = await request("/api/monitors", {
      method: "POST",
      token: ownerToken,
      body: {
        name: "Public API",
        url: "https://example.com/health",
        method: "GET",
        intervalSeconds: 60,
        timeoutMs: 5000,
        expectedStatusCode: 200,
        alertChannelIds: [],
      },
    });

    await vi.waitFor(() => {
      expect(stream.changes()).toContainEqual({
        type: "monitor.updated",
        id: created.body.id,
      });
    });
  });

  it("fans out events published by another process", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const first = await openStream(token);
    const second = await openStream(token);
    await Promise.all([waitForReady(first), waitForReady(second)]);

    const event = {
      type: "incident.updated" as const,
      id: "00000000-0000-4000-8000-000000000001",
    };
    publishChange(event);

    await vi.waitFor(() => {
      expect(first.changes()).toEqual([event]);
      expect(second.changes()).toEqual([event]);
    });
  });

  it("sends heartbeat comments", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const stream = await openStream(token);

    await vi.waitFor(() => {
      expect(stream.raw()).toContain(": heartbeat\n\n");
    });
  });

  it("closes the stream once the session is revoked", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const stream = await openStream(token);
    await waitForReady(stream);

    await request("/api/auth/logout-all", { method: "POST", token });

    await vi.waitFor(() => {
      expect(stream.isEnded()).toBe(true);
    });
  });

  it("caps connections per user and frees slots on disconnect", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const streams = await Promise.all(
      Array.from({ length: 5 }, () => openStream(token)),
    );
    await Promise.all(streams.map(waitForReady));

    const rejected = await openStream(token);
    expect(rejected.response.status).toBe(429);
    expect(rejected.response.headers.get("retry-after")).toBe("30");

    for (const stream of streams) {
      stream.close();
    }

    await vi.waitFor(() => {
      expect(countLiveStreams()).toBe(0);
    });

    const accepted = await openStream(token);
    expect(accepted.response.status).toBe(200);
  });
});
