import {
  type TransferOwnershipInput,
  endpoints,
  resources,
} from "@pulse/contracts";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { createResource } from "@/lib/query/resource";

export const memberResource = createResource(resources.members, "Member");

export const memberApi = {
  transferOwnership: (id: string, body: TransferOwnershipInput) =>
    callEndpoint(endpoints.transferOwnership, { params: { id }, body }),
};
