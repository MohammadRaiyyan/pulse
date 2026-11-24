import { accountHandlers } from "./account";
import { alertChannelHandlers } from "./alert-channels";
import { authHandlers } from "./auth";
import { dashboardHandlers } from "./dashboard";
import { incidentHandlers } from "./incidents";
import { invitationHandlers } from "./invitations";
import { liveEventHandlers } from "./live-events";
import { memberHandlers } from "./members";
import { monitorHandlers } from "./monitors";
import { oauthHandlers } from "./oauth";
import { passwordHandlers } from "./password";
import { serviceHandlers } from "./services";
import { webhookHandlers } from "./webhooks";

export const handlers = [
  ...authHandlers,
  ...passwordHandlers,
  ...oauthHandlers,
  ...accountHandlers,
  ...dashboardHandlers,
  ...monitorHandlers,
  ...webhookHandlers,
  ...serviceHandlers,
  ...alertChannelHandlers,
  ...incidentHandlers,
  ...memberHandlers,
  ...invitationHandlers,
  ...liveEventHandlers,
];
