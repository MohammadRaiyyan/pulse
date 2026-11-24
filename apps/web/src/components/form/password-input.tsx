import { Input } from "@pulse/ui/components/input";
import { cn } from "@pulse/ui/lib/utils";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type">;

export const PasswordInput = ({ className, ...inputProps }: PasswordInputProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = isVisible ? EyeOffIcon : EyeIcon;

  return (
    <div className="relative">
      <Input
        {...inputProps}
        type={isVisible ? "text" : "password"}
        className={cn("pr-9", className)}
      />
      <button
        type="button"
        onClick={() => setIsVisible((visible) => !visible)}
        aria-label={isVisible ? "Hide password" : "Show password"}
        aria-pressed={isVisible}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Icon className="size-4" />
      </button>
    </div>
  );
};
