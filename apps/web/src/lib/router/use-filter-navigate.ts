import { useNavigate } from "@tanstack/react-router";

export const useFilterNavigate = () => {
  const navigate = useNavigate();

  return (filters: object) =>
    navigate({
      to: ".",
      search: (previous) => ({ ...previous, ...filters, page: 1 }),
    });
};
