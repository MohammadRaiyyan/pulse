import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@pulse/ui/components/dropdown-menu";
import { useTheme } from "@pulse/ui/components/theme-provider";
import { type LucideIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { IconButton } from "@/components/actions/icon-button";

const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  icon: LucideIcon;
}>;

type ThemeValue = (typeof THEMES)[number]["value"];

const isThemeValue = (value: string): value is ThemeValue =>
  THEMES.some((theme) => theme.value === value);

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  const handleChange = (value: string) => {
    if (isThemeValue(value)) {
      setTheme(value);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label="Change theme">
          <SunIcon className="scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <MoonIcon className="absolute scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={handleChange}>
          {THEMES.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <option.icon />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
