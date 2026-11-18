export const createQueryKeys = <TScope extends string>(scope: TScope) => ({
  all: [scope] as const,
  lists: () => [scope, "list"] as const,
  list: (params: unknown) => [scope, "list", params] as const,
  details: () => [scope, "detail"] as const,
  detail: (id: string) => [scope, "detail", id] as const,
});

export type QueryKeys = ReturnType<typeof createQueryKeys>;
