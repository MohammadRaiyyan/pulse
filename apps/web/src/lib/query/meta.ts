import type { MutationMeta, QueryMeta } from "@tanstack/react-query";

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: { refreshOnMutation?: boolean };
    mutationMeta: { errorDisplay?: "toast" | "inline" };
  }
}

export const refreshOnMutation = {
  refreshOnMutation: true,
} satisfies QueryMeta;

export const inlineErrors = { errorDisplay: "inline" } satisfies MutationMeta;
