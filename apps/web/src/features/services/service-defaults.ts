import type { CreateServiceInput } from "@pulse/contracts";

export const defaultServiceInput: CreateServiceInput = {
  name: "",
  description: "",
  isPublic: false,
  position: 0,
  monitorIds: [],
  webhookIds: [],
};
