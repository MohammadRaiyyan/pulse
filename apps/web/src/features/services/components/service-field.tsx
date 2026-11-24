import { useSuspenseQuery } from "@tanstack/react-query";
import { FieldShell } from "@/components/form/field-shell";
import { OptionSelect } from "@/components/form/option-select";
import { serviceOptionsQuery } from "../api/service-resource";

const NO_SERVICE = "none";

export const ServiceField = ({ description }: { description?: string }) => {
  const { data: services } = useSuspenseQuery(serviceOptionsQuery);
  const options = [{ value: NO_SERVICE, label: "No service" }, ...services];

  return (
    <FieldShell<string | null | undefined>
      label="Service"
      description={description}
    >
      {({ name, ...control }, field) => (
        <OptionSelect
          {...control}
          name={name}
          value={field.state.value ?? NO_SERVICE}
          options={options}
          onChange={(value) =>
            field.handleChange(value === NO_SERVICE ? null : value)
          }
          className="w-full"
        />
      )}
    </FieldShell>
  );
};
