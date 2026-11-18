import type { ComponentType } from "react";
import { inlineErrors } from "@/lib/query/meta";
import type { AnyResource } from "@/lib/query/resource";
import { useCreateResource } from "@/lib/query/use-resource-mutations";
import { FormDialog, type FormDialogProps } from "./form-dialog";
import type { ResourceFormProps } from "./resource-form-props";

type CreateResourceDialogProps<TItem, TInput> = FormDialogProps & {
  resource: AnyResource<TItem, TInput>;
  form: ComponentType<ResourceFormProps<TInput>>;
  defaultValues: TInput;
  submitLabel: string;
  successMessage?: (item: TItem) => string;
  onCreated?: (item: TItem) => unknown;
};

export const CreateResourceDialog = <TItem, TInput>({
  resource,
  form: Form,
  defaultValues,
  submitLabel,
  successMessage,
  onCreated,
  ...dialogProps
}: CreateResourceDialogProps<TItem, TInput>) => {
  const createResource = useCreateResource(resource, {
    successMessage,
    meta: inlineErrors,
  });

  return (
    <FormDialog {...dialogProps}>
      {({ close, closeAfter }) => (
        <Form
          defaultValues={defaultValues}
          submitLabel={submitLabel}
          onCancel={close}
          onSubmit={closeAfter(
            (input: TInput) => createResource.mutateAsync(input),
            onCreated,
          )}
        />
      )}
    </FormDialog>
  );
};
