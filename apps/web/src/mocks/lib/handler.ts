import type { Permission, User } from "@pulse/contracts";
import { type PathParams, delay } from "msw";
import { assertPermission, authenticate } from "./auth";

const MOCK_LATENCY_MS = 250;

export type RequestArgs = {
  request: Request;
  params: PathParams;
  cookies: Record<string, string>;
};

export type AuthedArgs = RequestArgs & { user: User };

export type Resolver<TArgs> = (args: TArgs) => Response | Promise<Response>;

export const handle =
  (resolver: Resolver<RequestArgs>) => async (args: RequestArgs) => {
    await delay(MOCK_LATENCY_MS);

    try {
      return await resolver(args);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }

      throw error;
    }
  };

export const authenticated = (resolver: Resolver<AuthedArgs>) =>
  handle((args) => resolver({ ...args, user: authenticate(args.request) }));

export const guarded = (
  permission: Permission,
  resolver: Resolver<AuthedArgs>,
) =>
  authenticated((args) => {
    assertPermission(args.user, permission);

    return resolver(args);
  });
