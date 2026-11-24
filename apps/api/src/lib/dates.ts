export const toIso = (date: Date | null) => (date ? date.toISOString() : null);

export const minutesFromNow = (minutes: number) =>
  new Date(Date.now() + minutes * 60_000);

export const daysFromNow = (days: number) => minutesFromNow(days * 24 * 60);

export const daysAgo = (days: number) => daysFromNow(-days);

export const formatDuration = (seconds: number) => {
  if (seconds % 86_400 === 0) {
    return `${seconds / 86_400}d`;
  }

  if (seconds % 3_600 === 0) {
    return `${seconds / 3_600}h`;
  }

  if (seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }

  return `${seconds}s`;
};
