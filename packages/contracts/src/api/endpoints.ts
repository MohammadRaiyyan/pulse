import { z } from "zod";
import {
  alertChannelSchema,
  alertChannelSigningSecretSchema,
  alertDeliverySchema,
  createAlertChannelSchema,
  updateAlertChannelSchema,
} from "../alert-channels/index.ts";
import {
  authConfigSchema,
  authResponseSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  linkedAccountSchema,
  loginSchema,
  oauthAuthorizeResponseSchema,
  oauthAuthorizeSchema,
  oauthCallbackResponseSchema,
  oauthCallbackSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "../auth/index.ts";
import { paginatedSchema, paginationQuerySchema } from "../common/index.ts";
import { dashboardSummarySchema } from "../dashboard/index.ts";
import { incidentListQuerySchema, incidentSchema } from "../incidents/index.ts";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationListQuerySchema,
  invitationPreviewSchema,
  invitationSchema,
} from "../invitations/index.ts";
import { updateMemberSchema } from "../members/index.ts";
import {
  checkResultSchema,
  createMonitorSchema,
  monitorListQuerySchema,
  monitorSchema,
  updateMonitorSchema,
} from "../monitors/index.ts";
import {
  createServiceSchema,
  serviceOverviewSchema,
  serviceSchema,
  updateServiceSchema,
} from "../services/index.ts";
import {
  publicStatusSchema,
  statusPageSettingsSchema,
  updateStatusPageSettingsSchema,
} from "../status-page/index.ts";
import { updateProfileSchema, userSchema } from "../users/index.ts";
import {
  createWebhookSchema,
  updateWebhookSchema,
  webhookEventListQuerySchema,
  webhookEventSchema,
  webhookSchema,
} from "../webhooks/index.ts";
import { defineEndpoint, defineResource } from "./define.ts";

export const resources = {
  monitors: defineResource({
    path: "/monitors",
    permissions: { read: "monitor:read", write: "monitor:write" },
    item: monitorSchema,
    listQuery: monitorListQuerySchema,
    create: createMonitorSchema,
    update: updateMonitorSchema,
  }),
  webhooks: defineResource({
    path: "/webhooks",
    permissions: { read: "webhook:read", write: "webhook:write" },
    item: webhookSchema,
    listQuery: paginationQuerySchema,
    create: createWebhookSchema,
    update: updateWebhookSchema,
  }),
  services: defineResource({
    path: "/services",
    permissions: { read: "monitor:read", write: "monitor:write" },
    item: serviceSchema,
    listQuery: paginationQuerySchema,
    create: createServiceSchema,
    update: updateServiceSchema,
  }),
  alertChannels: defineResource({
    path: "/alert-channels",
    permissions: { read: "alert-channel:read", write: "alert-channel:write" },
    item: alertChannelSchema,
    listQuery: paginationQuerySchema,
    create: createAlertChannelSchema,
    update: updateAlertChannelSchema,
  }),
  incidents: defineResource({
    path: "/incidents",
    permissions: { read: "incident:read", write: "incident:manage" },
    item: incidentSchema,
    listQuery: incidentListQuerySchema,
  }),
  members: defineResource({
    path: "/members",
    permissions: { read: "member:read", write: "member:manage" },
    item: userSchema,
    listQuery: paginationQuerySchema,
    update: updateMemberSchema,
  }),
  invitations: defineResource({
    path: "/invitations",
    permissions: { read: "member:manage", write: "member:manage" },
    item: invitationSchema,
    listQuery: invitationListQuerySchema,
    create: createInvitationSchema,
  }),
};

export const endpoints = {
  authConfig: defineEndpoint({
    method: "GET",
    path: "/auth/config",
    access: "public",
    response: authConfigSchema,
  }),
  login: defineEndpoint({
    method: "POST",
    path: "/auth/login",
    access: "public",
    body: loginSchema,
    response: authResponseSchema,
  }),
  register: defineEndpoint({
    method: "POST",
    path: "/auth/register",
    access: "public",
    body: registerSchema,
    response: authResponseSchema,
  }),
  refreshSession: defineEndpoint({
    method: "POST",
    path: "/auth/refresh",
    access: "public",
    response: authResponseSchema,
  }),
  logout: defineEndpoint({
    method: "POST",
    path: "/auth/logout",
    access: "public",
  }),
  logoutEverywhere: defineEndpoint({
    method: "POST",
    path: "/auth/logout-all",
    access: "authenticated",
  }),
  forgotPassword: defineEndpoint({
    method: "POST",
    path: "/auth/password/forgot",
    access: "public",
    body: forgotPasswordSchema,
  }),
  resetPassword: defineEndpoint({
    method: "POST",
    path: "/auth/password/reset",
    access: "public",
    body: resetPasswordSchema,
  }),
  verifyEmail: defineEndpoint({
    method: "POST",
    path: "/auth/email/verify",
    access: "public",
    body: verifyEmailSchema,
  }),
  resendEmailVerification: defineEndpoint({
    method: "POST",
    path: "/me/email/verification",
    access: "authenticated",
  }),
  authorizeOAuth: defineEndpoint({
    method: "POST",
    path: "/auth/oauth/:provider/authorize",
    access: "public",
    body: oauthAuthorizeSchema,
    response: oauthAuthorizeResponseSchema,
  }),
  completeOAuth: defineEndpoint({
    method: "POST",
    path: "/auth/oauth/:provider/callback",
    access: "public",
    body: oauthCallbackSchema,
    response: oauthCallbackResponseSchema,
  }),
  updateProfile: defineEndpoint({
    method: "PATCH",
    path: "/me",
    access: "authenticated",
    body: updateProfileSchema,
    response: userSchema,
  }),
  changePassword: defineEndpoint({
    method: "POST",
    path: "/me/password",
    access: "authenticated",
    body: changePasswordSchema,
  }),
  listConnections: defineEndpoint({
    method: "GET",
    path: "/me/connections",
    access: "authenticated",
    response: z.array(linkedAccountSchema),
  }),
  disconnectProvider: defineEndpoint({
    method: "DELETE",
    path: "/me/connections/:provider",
    access: "authenticated",
  }),
  dashboardSummary: defineEndpoint({
    method: "GET",
    path: "/dashboard/summary",
    access: "monitor:read",
    response: dashboardSummarySchema,
  }),
  listMonitorChecks: defineEndpoint({
    method: "GET",
    path: "/monitors/:id/checks",
    access: "monitor:read",
    query: paginationQuerySchema,
    response: paginatedSchema(checkResultSchema),
  }),
  listWebhookEvents: defineEndpoint({
    method: "GET",
    path: "/webhooks/:id/events",
    access: "webhook:read",
    query: webhookEventListQuerySchema,
    response: paginatedSchema(webhookEventSchema),
  }),
  testAlertChannel: defineEndpoint({
    method: "POST",
    path: "/alert-channels/:id/test",
    access: "alert-channel:write",
    response: alertDeliverySchema,
  }),
  listAlertChannelDeliveries: defineEndpoint({
    method: "GET",
    path: "/alert-channels/:id/deliveries",
    access: "alert-channel:read",
    query: paginationQuerySchema,
    response: paginatedSchema(alertDeliverySchema),
  }),
  getAlertChannelSigningSecret: defineEndpoint({
    method: "GET",
    path: "/alert-channels/:id/signing-secret",
    access: "alert-channel:write",
    response: alertChannelSigningSecretSchema,
  }),
  rotateAlertChannelSigningSecret: defineEndpoint({
    method: "POST",
    path: "/alert-channels/:id/signing-secret/rotate",
    access: "alert-channel:write",
    response: alertChannelSigningSecretSchema,
  }),
  transitionIncident: defineEndpoint({
    method: "POST",
    path: "/incidents/:id/:transition",
    access: "incident:manage",
    response: incidentSchema,
  }),
  getServiceOverview: defineEndpoint({
    method: "GET",
    path: "/services/:id/overview",
    access: "monitor:read",
    response: serviceOverviewSchema,
  }),
  getStatusPageSettings: defineEndpoint({
    method: "GET",
    path: "/status-page",
    access: "status-page:manage",
    response: statusPageSettingsSchema,
  }),
  updateStatusPageSettings: defineEndpoint({
    method: "PATCH",
    path: "/status-page",
    access: "status-page:manage",
    body: updateStatusPageSettingsSchema,
    response: statusPageSettingsSchema,
  }),
  getPublicStatus: defineEndpoint({
    method: "GET",
    path: "/public/status",
    access: "public",
    response: publicStatusSchema,
  }),
  previewInvitation: defineEndpoint({
    method: "GET",
    path: "/invitations/preview/:token",
    access: "public",
    response: invitationPreviewSchema,
  }),
  acceptInvitation: defineEndpoint({
    method: "POST",
    path: "/invitations/accept",
    access: "public",
    body: acceptInvitationSchema,
    response: authResponseSchema,
  }),
};
