import {
  DEFAULT_SIGNUP_ROLE,
  type OAuthCallbackResponse,
  type OAuthIntent,
  type OAuthProvider,
  endpoints,
  idSchema,
  oauthIntentSchema,
  oauthProviderSchema,
  relativePathSchema,
} from "@pulse/contracts";
import { z } from "zod";
import { db } from "../db";
import { DEMO_ACCOUNTS } from "../demo-accounts";
import { oauthCallbackUrlFor } from "../lib/app-url";
import { authenticate } from "../lib/auth";
import { newId } from "../lib/ids";
import { findLinkedUser, linkProvider } from "../lib/linked-accounts";
import { parseParam } from "../lib/request";
import { errorResponse } from "../lib/responses";
import { route } from "../lib/route";
import { authResponse, withSession } from "../lib/session";
import { decodeToken, encodeToken } from "../lib/stateless-token";
import { createUser, findUserByEmail } from "../lib/users";

const MOCK_AUTHORIZATION_CODE = "mock-authorization-code";
const DEFAULT_REDIRECT: Record<OAuthIntent, string> = {
  "sign-in": "/",
  link: "/settings",
};

const [demoOwner] = DEMO_ACCOUNTS;

const mockProfiles: Record<OAuthProvider, { name: string; email: string }> = {
  github: { name: demoOwner.name, email: demoOwner.email },
  google: { name: "Gina Google", email: "gina@pulse.dev" },
};

const stateSchema = z.object({
  provider: oauthProviderSchema,
  intent: oauthIntentSchema,
  redirectTo: relativePathSchema,
  userId: idSchema.optional(),
});

const signInWithProvider = (provider: OAuthProvider) => {
  const profile = mockProfiles[provider];
  const user =
    findLinkedUser(provider, profile.email) ??
    findUserByEmail(profile.email) ??
    createUser({ ...profile, role: DEFAULT_SIGNUP_ROLE, password: newId() });
  linkProvider(user.id, provider, profile.email);

  return user;
};

const authorizeOAuth = route(
  endpoints.authorizeOAuth,
  ({ request, params, body: { intent, redirectTo }, respond }) => {
    const provider = parseParam(params, "provider", oauthProviderSchema);
    const state = encodeToken({
      provider,
      intent,
      redirectTo: redirectTo ?? DEFAULT_REDIRECT[intent],
      userId: intent === "link" ? authenticate(request).id : undefined,
    });

    return respond({
      authorizationUrl: oauthCallbackUrlFor(provider, {
        code: MOCK_AUTHORIZATION_CODE,
        state,
      }),
    });
  },
);

const completeOAuth = route(
  endpoints.completeOAuth,
  ({ params, body: { code, state }, respond }) => {
    const provider = parseParam(params, "provider", oauthProviderSchema);
    const payload = decodeToken(state, stateSchema);

    if (
      !payload ||
      payload.provider !== provider ||
      code !== MOCK_AUTHORIZATION_CODE
    ) {
      return errorResponse("UNAUTHORIZED", "OAuth state or code is invalid");
    }

    const linkingUser = payload.userId
      ? db.users.get(payload.userId)
      : undefined;

    if (payload.intent === "link" && !linkingUser) {
      return errorResponse(
        "UNAUTHORIZED",
        "Sign in again to connect this account",
      );
    }

    if (linkingUser) {
      linkProvider(linkingUser.id, provider, linkingUser.email);
    }

    const user = linkingUser ?? signInWithProvider(provider);
    const response: OAuthCallbackResponse = {
      ...authResponse(user),
      redirectTo: payload.redirectTo,
    };

    return respond(response, withSession(user));
  },
);

export const oauthHandlers = [authorizeOAuth, completeOAuth];
