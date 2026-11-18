const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 1_440;

export const now = () => new Date().toISOString();

export const minutesFromNow = (minutes: number) =>
  new Date(Date.now() + minutes * MINUTE_MS).toISOString();

export const minutesAgo = (minutes: number) => minutesFromNow(-minutes);

export const daysFromNow = (days: number) =>
  minutesFromNow(days * MINUTES_PER_DAY);
