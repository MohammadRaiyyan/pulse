import { z } from "zod";

export const roleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export type Role = z.infer<typeof roleSchema>;

export const assignableRoleSchema = roleSchema.exclude(["owner"]);

export type AssignableRole = z.infer<typeof assignableRoleSchema>;

export const DEFAULT_SIGNUP_ROLE: AssignableRole = "viewer";
