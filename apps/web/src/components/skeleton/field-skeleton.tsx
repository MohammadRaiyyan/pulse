import { ControlSkeleton } from "./control-skeleton";
import { TextSkeleton } from "./text-skeleton";

export const FieldSkeleton = () => (
  <div className="flex flex-col gap-2">
    <TextSkeleton className="w-28" />
    <ControlSkeleton className="w-full" />
  </div>
);
