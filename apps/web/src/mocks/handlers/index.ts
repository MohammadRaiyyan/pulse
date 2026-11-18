import { accountHandlers } from "./account";
import { alertChannelHandlers } from "./alert-channels";
import { authHandlers } from "./auth";
import { dashboardHandlers } from "./dashboard";
import { incidentHandlers } from "./incidents";
import { invitationHandlers } from "./invitations";
import { memberHandlers } from "./members";
import { monitorHandlers } from "./monitors";
import { oauthHandlers } from "./oauth";
import { passwordHandlers } from "./password";
import { webhookHandlers } from "./webhooks";

export const handlers = [
  ...authHandlers,
  ...passwordHandlers,
  ...oauthHandlers,
  ...accountHandlers,
  ...dashboardHandlers,
  ...monitorHandlers,
  ...webhookHandlers,
  ...alertChannelHandlers,
  ...incidentHandlers,
  ...memberHandlers,
  ...invitationHandlers,
];
