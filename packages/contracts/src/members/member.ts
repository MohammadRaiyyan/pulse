import { z } from "zod";
import { assignableRoleSchema } from "../rbac/index.ts";

export const updateMemberSchema = z.object({
  role: assignableRoleSchema,
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
