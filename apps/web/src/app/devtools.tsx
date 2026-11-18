import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

const plugins = [
  { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
  { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel /> },
];

export const Devtools = () =>
  import.meta.env.DEV ? <TanStackDevtools plugins={plugins} /> : null;
