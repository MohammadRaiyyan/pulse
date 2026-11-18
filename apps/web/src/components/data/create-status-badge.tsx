import { StatusBadge } from "./status-badge";
import type { StatusMeta } from "./tones";

export const createStatusBadge =
  <TValue extends string>(meta: Record<TValue, StatusMeta>) =>
  ({ value }: { value: TValue }) => <StatusBadge {...meta[value]} />;
