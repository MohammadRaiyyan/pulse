import type { Option } from "@/lib/options";

export const OptionLabel = ({ option }: { option: Option }) => (
  <>
    {option.icon ? <option.icon className="text-muted-foreground" /> : null}
    {option.label}
  </>
);
