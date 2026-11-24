import { z } from "zod";
import {
  relativePathSchema,
  timestampSchema,
  tokenSchema,
} from "../common/index.ts";
import { emailSchema } from "../users/index.ts";
import { authResponseSchema } from "./auth.ts";

export const oauthProviderSchema = z.enum(["github", "google"]);

export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

export const authConfigSchema = z.object({
  signupOpen: z.boolean(),
  oauthProviders: z.array(oauthProviderSchema),
});

export type AuthConfig = z.infer<typeof authConfigSchema>;

export const oauthIntentSchema = z.enum(["sign-in", "link"]);

export type OAuthIntent = z.infer<typeof oauthIntentSchema>;

export const oauthAuthorizeSchema = z.object({
  intent: oauthIntentSchema,
  redirectTo: relativePathSchema.optional(),
});

export type OAuthAuthorizeInput = z.infer<typeof oauthAuthorizeSchema>;

export const oauthAuthorizeResponseSchema = z.object({
  authorizationUrl: z.url(),
});

export type OAuthAuthorizeResponse = z.infer<
  typeof oauthAuthorizeResponseSchema
>;

export const oauthCallbackSchema = z.object({
  code: tokenSchema,
  state: tokenSchema,
});

export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;

export const oauthCallbackResponseSchema = authResponseSchema.extend({
  redirectTo: relativePathSchema,
});

export type OAuthCallbackResponse = z.infer<typeof oauthCallbackResponseSchema>;

export const linkedAccountSchema = z.object({
  provider: oauthProviderSchema,
  email: emailSchema,
  linkedAt: timestampSchema,
});

export type LinkedAccount = z.infer<typeof linkedAccountSchema>;
