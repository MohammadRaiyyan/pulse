import { withPlaceholder } from "./placeholder";
import {
  MILLISECONDS_PER_SECOND,
  SMALLEST_TIME_UNIT,
  TIME_UNITS,
} from "./time-units";

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

const toRelativeTime = (timestamp: string) => {
  const elapsedSeconds =
    (new Date(timestamp).getTime() - Date.now()) / MILLISECONDS_PER_SECOND;
  const { unit, seconds } =
    TIME_UNITS.find(
      (candidate) => Math.abs(elapsedSeconds) >= candidate.seconds,
    ) ?? SMALLEST_TIME_UNIT;

  return relativeTimeFormatter.format(
    Math.round(elapsedSeconds / seconds),
    unit,
  );
};

export const formatDateTime = withPlaceholder((timestamp: string) =>
  dateTimeFormatter.format(new Date(timestamp)),
);

export const formatTime = withPlaceholder((timestamp: string) =>
  timeFormatter.format(new Date(timestamp)),
);

export const formatRelativeTime = withPlaceholder(toRelativeTime);
