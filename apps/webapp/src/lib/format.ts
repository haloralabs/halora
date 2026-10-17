/** Shorten a strkey or hash for display: GABC...WXYZ. Full value stays available via title/copy. */
export function truncateMiddle(value: string, head = 4, tail = 4): string {
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "3 minutes ago", "in 2 hours". `now` is injectable for deterministic tests. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return diffSeconds <= 0 ? 'just now' : 'in a few seconds';
  if (abs < 3600) return relative.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(diffSeconds / 3600), 'hour');
  return relative.format(Math.round(diffSeconds / 86_400), 'day');
}

const dateTime = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

const dateOnly = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(isoOrUnixSeconds: string | number): string {
  const date =
    typeof isoOrUnixSeconds === 'number'
      ? new Date(isoOrUnixSeconds * 1000)
      : new Date(isoOrUnixSeconds);
  return dateOnly.format(date);
}

/** Seconds until the next UTC midnight, when the contract's daily bucket resets. */
export function secondsUntilUtcReset(now: number = Date.now()): number {
  const day = 86_400_000;
  return Math.ceil((day - (now % day)) / 1000);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
