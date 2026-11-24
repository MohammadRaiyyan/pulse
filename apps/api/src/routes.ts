import { Router } from "express";
import { env } from "./config/env.ts";
import { byIp, rateLimit } from "./middleware/rate-limit.ts";
import { accountRouter } from "./modules/account/account.routes.ts";
import { alertChannelRouter } from "./modules/alert-channels/alert-channel.routes.ts";
import { authRouter } from "./modules/auth/auth.routes.ts";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.ts";
import { liveStreamRouter } from "./modules/events/live-stream.routes.ts";
import { healthRouter } from "./modules/health/health.routes.ts";
import { incidentRouter } from "./modules/incidents/incident.routes.ts";
import { invitationRouter } from "./modules/invitations/invitation.routes.ts";
import { memberRouter } from "./modules/members/member.routes.ts";
import { monitorRouter } from "./modules/monitors/monitor.routes.ts";
import { oauthRouter } from "./modules/oauth/oauth.routes.ts";
import { serviceRouter } from "./modules/services/service.routes.ts";
import { statusPageRouter } from "./modules/status-page/status-page.routes.ts";
import { reportRouter } from "./modules/reports/report.routes.ts";
import { webhookRouter } from "./modules/webhooks/webhook.routes.ts";

const apiLimit = rateLimit({
  name: "api",
  limit: env.API_RATE_LIMIT_PER_MINUTE,
  windowSeconds: 60,
  key: byIp,
});

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(apiLimit);

apiRouter.use(authRouter);
apiRouter.use(oauthRouter);
apiRouter.use(accountRouter);
apiRouter.use(dashboardRouter);
apiRouter.use(monitorRouter);
apiRouter.use(webhookRouter);
apiRouter.use(serviceRouter);
apiRouter.use(statusPageRouter);
apiRouter.use(alertChannelRouter);
apiRouter.use(incidentRouter);
apiRouter.use(reportRouter);
apiRouter.use(memberRouter);
apiRouter.use(invitationRouter);
apiRouter.use(liveStreamRouter);
