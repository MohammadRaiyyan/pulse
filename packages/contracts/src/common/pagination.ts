import { z } from "zod";
import { nonNegativeIntSchema } from "./primitives.ts";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const pageQuerySchema = paginationQuerySchema.pick({ page: true });

export const paginationMetaSchema = z.object({
  page: z.int().min(1),
  pageSize: z.int().min(1),
  total: nonNegativeIntSchema,
});

export const paginatedSchema = <TItem extends z.ZodType>(itemSchema: TItem) =>
  paginationMetaSchema.extend({ items: z.array(itemSchema) });

export type Paginated<TItem> = z.infer<typeof paginationMetaSchema> & {
  items: TItem[];
};
