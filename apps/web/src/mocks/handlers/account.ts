import { endpoints, oauthProviderSchema } from "@pulse/contracts";
import { db } from "../db";
import { linkedAccountsOf, unlinkProvider } from "../lib/linked-accounts";
import { parseParam } from "../lib/request";
import { errorResponse, noContent } from "../lib/responses";
import { route } from "../lib/route";
import {
  assertEmailAvailable,
  setPassword,
  verifyPassword,
} from "../lib/users";

const updateProfile = route(
  endpoints.updateProfile,
  ({ body, user, respond }) => {
    assertEmailAvailable(body.email, user.id);
    const updated = { ...user, ...body };
    db.users.set(updated.id, updated);

    return respond(updated);
  },
);

const changePassword = route(endpoints.changePassword, ({ body, user }) => {
  if (!verifyPassword(user.id, body.currentPassword)) {
    return errorResponse("VALIDATION_ERROR", "Current password is incorrect", {
      fieldErrors: { currentPassword: ["Current password is incorrect"] },
    });
  }

  setPassword(user.id, body.newPassword);

  return noContent();
});

const listConnections = route(endpoints.listConnections, ({ user, respond }) =>
  respond(linkedAccountsOf(user.id)),
);

const disconnectProvider = route(
  endpoints.disconnectProvider,
  ({ params, user }) => {
    unlinkProvider(
      user.id,
      parseParam(params, "provider", oauthProviderSchema),
    );

    return noContent();
  },
);

export const accountHandlers = [
  updateProfile,
  changePassword,
  listConnections,
  disconnectProvider,
];
