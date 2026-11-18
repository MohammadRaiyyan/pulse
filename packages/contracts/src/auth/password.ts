import { z } from "zod";
import { requiredStringSchema, tokenSchema } from "../common/index.ts";
import { emailSchema, passwordSchema } from "../users/index.ts";

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: tokenSchema,
  password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: requiredStringSchema("Enter your current password"),
    newPassword: passwordSchema,
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: "Choose a password different from the current one",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
