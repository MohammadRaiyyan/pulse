type TimeUnit = {
  unit: Intl.RelativeTimeFormatUnit;
  suffix: string;
  seconds: number;
};

export const MILLISECONDS_PER_SECOND = 1000;

export const SMALLEST_TIME_UNIT = {
  unit: "second",
  suffix: "s",
  seconds: 1,
} as const satisfies TimeUnit;

export const TIME_UNITS = [
  { unit: "day", suffix: "d", seconds: 86_400 },
  { unit: "hour", suffix: "h", seconds: 3_600 },
  { unit: "minute", suffix: "m", seconds: 60 },
  SMALLEST_TIME_UNIT,
] as const satisfies readonly TimeUnit[];
