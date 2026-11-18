import { withPlaceholder } from "./placeholder";
import { TIME_UNITS } from "./time-units";

const percentFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat();

const MAX_DURATION_PARTS = 2;

const toDuration = (totalSeconds: number) => {
  const parts: string[] = [];
  let remaining = Math.max(0, Math.round(totalSeconds));

  TIME_UNITS.forEach(({ suffix, seconds }) => {
    const amount = Math.floor(remaining / seconds);

    if (amount > 0 && parts.length < MAX_DURATION_PARTS) {
      parts.push(`${amount}${suffix}`);
      remaining -= amount * seconds;
    }
  });

  return parts.length > 0 ? parts.join(" ") : "0s";
};

export const formatDuration = withPlaceholder(toDuration);

export const formatMilliseconds = withPlaceholder(
  (milliseconds: number) => `${integerFormatter.format(milliseconds)} ms`,
);

export const formatPercent = withPlaceholder(
  (percent: number) => `${percentFormatter.format(percent)}%`,
);

export const formatCount = withPlaceholder((count: number) =>
  integerFormatter.format(count),
);
