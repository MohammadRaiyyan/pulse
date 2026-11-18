import { cn } from "@pulse/ui/lib/utils";

const BEAT_WIDTH = 32;
const BEAT_HEIGHT = 24;
const BEAT_SEGMENT = "h7l2-6 3 12 3-15 3 12 2-3h12";

type EkgTraceProps = {
  beats?: number;
  animated?: boolean;
  strokeWidth?: number;
  className?: string;
};

export const EkgTrace = ({
  beats = 1,
  animated = false,
  strokeWidth = 2,
  className,
}: EkgTraceProps) => (
  <svg
    viewBox={`0 0 ${BEAT_WIDTH * beats} ${BEAT_HEIGHT}`}
    fill="none"
    preserveAspectRatio="none"
    aria-hidden
    className={className}
  >
    <path
      d={`M0 12${BEAT_SEGMENT.repeat(beats)}`}
      pathLength={1}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      className={cn(animated && "animate-trace [stroke-dasharray:1]")}
    />
  </svg>
);
