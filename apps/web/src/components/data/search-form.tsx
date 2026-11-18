import { Input } from "@pulse/ui/components/input";
import { SearchIcon } from "lucide-react";
import type { FormEvent } from "react";

type SearchFormProps = {
  value: string;
  placeholder: string;
  onSearch: (value: string) => void;
};

const SEARCH_FIELD_NAME = "search";

export const SearchForm = ({
  value,
  placeholder,
  onSearch,
}: SearchFormProps) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSearch(String(formData.get(SEARCH_FIELD_NAME) ?? "").trim());
  };

  return (
    <search className="relative w-56">
      <form onSubmit={handleSubmit}>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          key={value}
          name={SEARCH_FIELD_NAME}
          type="search"
          defaultValue={value}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-8"
        />
      </form>
    </search>
  );
};
