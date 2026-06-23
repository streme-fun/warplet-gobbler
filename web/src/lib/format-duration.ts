/** Human-readable duration for auction rounds, timers, and admin metrics. */
export function formatDuration(
  secondsRaw: bigint | number | undefined | null,
): string {
  if (secondsRaw == null) return "--";
  const seconds = Math.max(0, Number(secondsRaw));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}
