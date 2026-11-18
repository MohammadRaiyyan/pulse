import { cn } from "@pulse/ui/lib/utils";
import { EkgTrace } from "./ekg-trace";

const markSizes = {
  default: {
    box: "size-8 rounded-lg shadow-[0_0_22px_-6px_var(--brand)]",
    trace: "size-5",
  },
  large: {
    box: "size-14 rounded-xl shadow-[0_0_48px_-8px_var(--brand)]",
    trace: "size-8",
  },
};

export const BrandMark = ({
  size = "default",
}: {
  size?: keyof typeof markSizes;
}) => (
  <div
    className={cn(
      "flex shrink-0 items-center justify-center bg-brand text-brand-foreground",
      markSizes[size].box,
    )}
  >
    <EkgTrace className={markSizes[size].trace} strokeWidth={2.25} />
  </div>
);
