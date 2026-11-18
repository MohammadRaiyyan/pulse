import { getErrorMessage, isApiError } from "@/lib/api/api-error";

type ServerSubmission<TValues> = {
  value: TValues;
  formApi: { fieldInfo: object };
};

const toFormErrors = (error: unknown, fieldInfo: object) => {
  const entries = Object.entries(isApiError(error) ? error.fieldErrors : {});
  const matched = entries.filter(([field]) => Object.hasOwn(fieldInfo, field));
  const unmatched = entries.filter(
    ([field]) => !Object.hasOwn(fieldInfo, field),
  );
  const isFullyMatched = matched.length > 0 && unmatched.length === 0;

  return {
    form: isFullyMatched
      ? undefined
      : [
          getErrorMessage(error),
          ...unmatched.flatMap(([, messages]) => messages),
        ].join(" "),
    fields: Object.fromEntries(
      matched.map(([field, messages]) => [field, messages[0]]),
    ),
  };
};

export const submitToServer =
  <TValues>(submit: (values: TValues) => Promise<unknown>) =>
  async ({ value, formApi }: ServerSubmission<TValues>) => {
    try {
      await submit(value);
      return undefined;
    } catch (error) {
      return toFormErrors(error, formApi.fieldInfo);
    }
  };
