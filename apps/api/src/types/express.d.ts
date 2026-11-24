import type { AuthUser } from "../modules/users/user.service.ts";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
