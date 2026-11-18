import { Badge } from "@pulse/ui/components/badge";

export const MethodBadge = ({ method }: { method: string }) => (
  <Badge variant="secondary" className="font-mono">
    {method}
  </Badge>
);
