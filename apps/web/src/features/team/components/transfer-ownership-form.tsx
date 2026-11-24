import {
  type TransferOwnershipInput,
  type User,
  transferOwnershipSchema,
} from "@pulse/contracts";
import { useSchemaForm } from "@/components/form/app-form";
import { currentPasswordField } from "@/components/form/field-presets";

type TransferOwnershipFormProps = {
  member: User;
  onSubmit: (input: TransferOwnershipInput) => Promise<unknown>;
  onCancel: () => void;
};

const defaultValues = { currentPassword: "" };

export const TransferOwnershipForm = ({
  member,
  onSubmit,
  onCancel,
}: TransferOwnershipFormProps) => {
  const form = useSchemaForm({
    schema: transferOwnershipSchema,
    defaultValues,
    onSubmit,
  });

  return (
    <form.AppForm>
      <form.Form>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{member.name} becomes the workspace owner.</li>
          <li>You become an admin and keep access to everything else.</li>
          <li>
            Only {member.name} will be able to change or remove admins and
            transfer ownership again.
          </li>
          <li>You both get an email about the change.</li>
        </ul>
        <form.AppField name="currentPassword">
          {(field) => (
            <field.TextField
              label="Your current password"
              {...currentPasswordField}
            />
          )}
        </form.AppField>
        <form.FormActions
          submitLabel="Transfer ownership"
          onCancel={onCancel}
        />
      </form.Form>
    </form.AppForm>
  );
};
