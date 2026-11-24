import { Router } from "express";
import { requireAuth } from "../../middleware/authenticate.ts";
import { byBodyEmail, byIp, rateLimit } from "../../middleware/rate-limit.ts";
import * as authController from "./auth.controller.ts";

const loginLimitPerEmail = rateLimit({
  name: "login-email",
  limit: 5,
  windowSeconds: 60,
  key: byBodyEmail,
});
const loginLimitPerIp = rateLimit({
  name: "login-ip",
  limit: 20,
  windowSeconds: 60,
  key: byIp,
});
const registerLimit = rateLimit({
  name: "register",
  limit: 10,
  windowSeconds: 3600,
  key: byIp,
});
const forgotPasswordLimit = rateLimit({
  name: "forgot-password",
  limit: 3,
  windowSeconds: 60,
  key: byBodyEmail,
});

export const authRouter = Router();

authRouter.post("/auth/register", registerLimit, authController.register);
authRouter.post(
  "/auth/login",
  loginLimitPerIp,
  loginLimitPerEmail,
  authController.login,
);
authRouter.post("/auth/refresh", authController.refresh);
authRouter.post("/auth/logout", authController.logout);
authRouter.post(
  "/auth/logout-all",
  requireAuth,
  authController.logoutEverywhere,
);
authRouter.post(
  "/auth/password/forgot",
  forgotPasswordLimit,
  authController.forgotPassword,
);
authRouter.post("/auth/password/reset", authController.resetPassword);
