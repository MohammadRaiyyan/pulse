import { resources } from "@pulse/contracts";
import { createResource } from "@/lib/query/resource";

export const memberResource = createResource(resources.members, "Member");
