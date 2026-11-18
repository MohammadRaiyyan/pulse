import { z } from "zod";

export const tallyByOption = <
  TOptions extends Readonly<Record<string, string>>,
>(
  schema: z.ZodEnum<TOptions>,
  values: readonly string[],
) =>
  z
    .record(schema, z.int())
    .parse(
      Object.fromEntries(
        schema.options.map((option) => [
          option,
          values.filter((value) => value === option).length,
        ]),
      ),
    );
