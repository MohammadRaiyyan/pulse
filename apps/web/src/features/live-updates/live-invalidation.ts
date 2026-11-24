import type { ChangeEvent, ChangeEventType } from "@pulse/contracts";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { alertChannelResource } from "@/features/alert-channels/api/alert-channel-resource";
import { dashboardSummaryQuery } from "@/features/dashboard/api/dashboard-query";
import { incidentResource } from "@/features/incidents/api/incident-resource";
import { monitorResource } from "@/features/monitors/api/monitor-resource";
import { serviceResource } from "@/features/services/api/service-resource";
import { invitationResource } from "@/features/team/api/invitation-resource";
import { memberResource } from "@/features/team/api/member-resource";
import { webhookResource } from "@/features/webhooks/api/webhook-resource";

const FLUSH_DELAY_MS = 500;

const monitors = monitorResource.keys;
const webhooks = webhookResource.keys;
const incidents = incidentResource.keys;
const alertChannels = alertChannelResource.keys;
const services = serviceResource.keys.all;
const team = [memberResource.keys.all, invitationResource.keys.lists()];
const dashboard = dashboardSummaryQuery.queryKey;

const keysByType: Record<ChangeEventType, (id: string) => QueryKey[]> = {
  "monitor.updated": (id) => [
    monitors.lists(),
    monitors.detail(id),
    incidents.lists(),
    dashboard,
    services,
  ],
  "monitor.checked": (id) => [
    monitors.lists(),
    monitors.detail(id),
    dashboard,
    services,
  ],
  "monitor.deleted": () => [monitors.lists(), incidents.all, dashboard, services],
  "incident.updated": (id) => [
    incidents.lists(),
    incidents.detail(id),
    dashboard,
    services,
  ],
  "webhook.updated": (id) => [
    webhooks.lists(),
    webhooks.detail(id),
    incidents.lists(),
    dashboard,
    services,
  ],
  "webhook.event": (id) => [webhooks.lists(), webhooks.detail(id), dashboard],
  "webhook.deleted": () => [webhooks.lists(), incidents.all, dashboard, services],
  "alertChannel.updated": (id) => [
    alertChannels.lists(),
    alertChannels.detail(id),
  ],
  "alertChannel.deleted": () => [
    alertChannels.lists(),
    monitors.details(),
    webhooks.details(),
  ],
  "member.updated": () => team,
  "member.deleted": () => team,
  "invitation.updated": () => team,
  "service.updated": () => [services, monitors.all, webhooks.all],
  "service.deleted": () => [services, monitors.all, webhooks.all],
};

const SESSION_SCOPE = "session";

export const createLiveInvalidator = (queryClient: QueryClient) => {
  const pending = new Map<string, QueryKey>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    timer = undefined;

    const queryKeys = [...pending.values()];
    pending.clear();

    for (const queryKey of queryKeys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  return {
    add: (event: ChangeEvent) => {
      for (const queryKey of keysByType[event.type](event.id)) {
        pending.set(JSON.stringify(queryKey), queryKey);
      }

      timer ??= setTimeout(flush, FLUSH_DELAY_MS);
    },
    refreshAll: () => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== SESSION_SCOPE,
      });
    },
    dispose: () => {
      clearTimeout(timer);
      pending.clear();
    },
  };
};
