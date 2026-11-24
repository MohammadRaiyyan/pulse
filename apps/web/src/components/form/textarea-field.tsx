import { Textarea } from "@pulse/ui/components/textarea";
import { cn } from "@pulse/ui/lib/utils";
import { FieldShell, type FieldShellProps } from "./field-shell";

type TextareaFieldProps = FieldShellProps & {
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  monospace?: boolean;
};

export const TextareaField = ({
  placeholder,
  disabled,
  rows = 6,
  monospace = false,
  ...shellProps
}: TextareaFieldProps) => (
  <FieldShell<string | null | undefined> {...shellProps}>
    {(control, field) => (
      <Textarea
        {...control}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        spellCheck={false}
        className={cn("max-h-80", monospace && "font-mono text-xs md:text-xs")}
        value={field.state.value ?? ""}
        onChange={(event) => field.handleChange(event.target.value)}
      />
    )}
  </FieldShell>
);
