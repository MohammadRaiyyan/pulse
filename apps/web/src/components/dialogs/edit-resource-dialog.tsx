import type { ComponentType } from "react";
import { inlineErrors } from "@/lib/query/meta";
import type { AnyResource } from "@/lib/query/resource";
import { useUpdateResource } from "@/lib/query/use-resource-mutations";
import { FormDialog, type FormDialogProps } from "./form-dialog";
import type { ResourceFormProps } from "./resource-form-props";

type EditResourceDialogProps<TItem, TUpdate, TInput> = FormDialogProps & {
  resource: AnyResource<TItem, never, TUpdate>;
  item: TItem;
  toInput: (item: TItem) => TInput;
  form: ComponentType<ResourceFormProps<TInput>>;
};

const SAVE_LABEL = "Save changes";

export const EditResourceDialog = <
  TItem extends { id: string },
  TUpdate extends Partial<TItem>,
  TInput extends TUpdate,
>({
  resource,
  item,
  toInput,
  form: Form,
  ...dialogProps
}: EditResourceDialogProps<TItem, TUpdate, TInput>) => {
  const updateResource = useUpdateResource(resource, { meta: inlineErrors });

  return (
    <FormDialog {...dialogProps}>
      {({ close, closeAfter }) => (
        <Form
          defaultValues={toInput(item)}
          submitLabel={SAVE_LABEL}
          onCancel={close}
          onSubmit={closeAfter((input: TInput) =>
            updateResource.mutateAsync({ id: item.id, input }),
          )}
        />
      )}
    </FormDialog>
  );
};
