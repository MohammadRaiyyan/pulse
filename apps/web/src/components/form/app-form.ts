import { createFormHook, revalidateLogic } from "@tanstack/react-form";
import type { StandardSchemaV1 } from "@tanstack/react-form";
import { CheckboxGroupField } from "./checkbox-group-field";
import { FormActions } from "./form-actions";
import { FormRoot } from "./form-root";
import { NumberField } from "./number-field";
import { SelectField } from "./select-field";
import { SubmitButton } from "./submit-button";
import { SwitchField } from "./switch-field";
import { TextField } from "./text-field";
import { fieldContext, formContext } from "./form-context";
import { submitToServer } from "@/lib/forms/server-errors";

export const { useAppForm, withForm, withFieldGroup } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    NumberField,
    SelectField,
    SwitchField,
    CheckboxGroupField,
  },
  formComponents: {
    Form: FormRoot,
    SubmitButton,
    FormActions,
  },
});

type SchemaFormOptions<TValues> = {
  schema: StandardSchemaV1<TValues, unknown>;
  defaultValues: TValues;
  onSubmit: (values: TValues) => Promise<unknown>;
};

export const useSchemaForm = <TValues>({
  schema,
  defaultValues,
  onSubmit,
}: SchemaFormOptions<TValues>) =>
  useAppForm({
    defaultValues,
    validationLogic: revalidateLogic({
      mode: "change",
      modeAfterSubmission: "change",
    }),
    validators: {
      onDynamic: schema,
      onSubmitAsync: submitToServer(onSubmit),
    },
  });
