import { describe, expect, it } from "vitest";
import { registerUser, request, useTestServer } from "../../test/client.ts";
import {
  openIncidentForSource,
  resolveIncidentForSource,
} from "./incident.service.ts";

useTestServer();

const source = {
  type: "monitor" as const,
  id: "00000000-0000-4000-8000-000000000042",
  name: "Checkout API",
  alertChannelIds: [],
};

describe("incidents", () => {
  it("opens only one active incident per source and resolves it on recovery", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");

    await openIncidentForSource(source, "Connection failed");
    await openIncidentForSource(source, "Connection failed again");

    const open = await request("/api/incidents?status=open", { token });
    expect(open.body.total).toBe(1);
    expect(open.body.items[0].cause).toBe("Connection failed");

    await resolveIncidentForSource(source);

    const resolved = await request("/api/incidents?status=resolved", { token });
    expect(resolved.body.total).toBe(1);
    expect(resolved.body.items[0].resolvedAt).not.toBeNull();
  });

  it("follows the acknowledge and resolve transition rules", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    await openIncidentForSource(source, "Connection failed");

    const list = await request("/api/incidents", { token });
    const id = list.body.items[0].id;

    const acknowledged = await request(`/api/incidents/${id}/acknowledge`, {
      method: "POST",
      token,
    });
    expect(acknowledged.body.status).toBe("acknowledged");
    expect(acknowledged.body.acknowledgedAt).not.toBeNull();

    const again = await request(`/api/incidents/${id}/acknowledge`, {
      method: "POST",
      token,
    });
    expect(again.status).toBe(409);

    const resolved = await request(`/api/incidents/${id}/resolve`, {
      method: "POST",
      token,
    });
    expect(resolved.body.status).toBe("resolved");

    const unknown = await request(`/api/incidents/${id}/explode`, {
      method: "POST",
      token,
    });
    expect(unknown.status).toBe(404);
  });
});
