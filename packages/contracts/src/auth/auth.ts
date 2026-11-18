import { z } from "zod";
import {
  nameSchema,
  requiredStringSchema,
  tokenSchema,
} from "../common/index.ts";
import { emailSchema, passwordSchema, userSchema } from "../users/index.ts";

export const loginSchema = z.object({
  email: emailSchema,
  password: requiredStringSchema("Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const authResponseSchema = z.object({
  accessToken: tokenSchema,
  user: userSchema,
});

export type AuthResponse = z.infer<typeof authResponseSchema>;
