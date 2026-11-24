import { z } from "zod";
import { requiredStringSchema } from "../common/index.ts";
import { assignableRoleSchema } from "../rbac/index.ts";
import { userSchema } from "../users/index.ts";

export const updateMemberSchema = z.object({
  role: assignableRoleSchema,
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const transferOwnershipSchema = z.object({
  currentPassword: requiredStringSchema("Enter your current password"),
});

export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;

export const ownershipTransferSchema = z.object({
  previousOwner: userSchema,
  newOwner: userSchema,
});

export type OwnershipTransfer = z.infer<typeof ownershipTransferSchema>;
