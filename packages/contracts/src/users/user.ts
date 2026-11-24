import { z } from "zod";
import { idSchema, nameSchema, timestampSchema } from "../common/index.ts";
import { roleSchema } from "../rbac/index.ts";
import { emailSchema } from "./credentials.ts";

export const userSchema = z.object({
  id: idSchema,
  name: nameSchema,
  email: emailSchema,
  role: roleSchema,
  emailVerifiedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type User = z.infer<typeof userSchema>;

export const userRefSchema = userSchema.pick({ id: true, name: true });

export type UserRef = z.infer<typeof userRefSchema>;

export const updateProfileSchema = userSchema
  .pick({ name: true, email: true })
  .extend({ currentPassword: z.string().optional() });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
