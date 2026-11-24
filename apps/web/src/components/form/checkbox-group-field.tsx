import { Checkbox } from "@pulse/ui/components/checkbox";
import { FieldDescription, FieldLabel } from "@pulse/ui/components/field";
import type { Option } from "@/lib/options";
import { FieldShell, type FieldShellProps } from "./field-shell";
import { OptionLabel } from "./option-label";

type CheckboxGroupFieldProps = FieldShellProps & {
  options: readonly Option[];
  emptyMessage: string;
};

const toggleValue = (
  values: readonly string[],
  value: string,
  checked: boolean,
) => (checked ? [...values, value] : values.filter((item) => item !== value));

export const CheckboxGroupField = ({
  options,
  emptyMessage,
  ...shellProps
}: CheckboxGroupFieldProps) => (
  <FieldShell<string[]> {...shellProps}>
    {({ id, onBlur }, field) =>
      options.length === 0 ? (
        <FieldDescription>{emptyMessage}</FieldDescription>
      ) : (
        <div id={id} className="flex flex-col gap-2">
          {options.map((option) => {
            const optionId = `${id}-${option.value}`;

            return (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={optionId}
                  checked={field.state.value.includes(option.value)}
                  onCheckedChange={(checked) =>
                    field.handleChange(
                      toggleValue(
                        field.state.value,
                        option.value,
                        checked === true,
                      ),
                    )
                  }
                  onBlur={onBlur}
                />
                <FieldLabel
                  htmlFor={optionId}
                  className="font-normal [&>svg]:size-4"
                >
                  <OptionLabel option={option} />
                </FieldLabel>
              </div>
            );
          })}
        </div>
      )
    }
  </FieldShell>
);
