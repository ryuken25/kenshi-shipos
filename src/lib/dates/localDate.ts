/* ── Local Date Utilities ─────────────────────────────────── */
/* NEVER use toISOString().slice(0,10) — that's UTC. */
/* These use the browser's local timezone consistently. */

export function toLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localStartOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function localEndOfDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function isToday(ts: number): boolean {
  return isSameDay(new Date(ts), new Date());
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function daysFromNow(n: number): Date {
  return daysAgo(-n);
}

export function localDateKeyFromTs(ts: number): string {
  return toLocalDateKey(new Date(ts));
}

export function weekRange(date = new Date()): { start: Date; end: Date } {
  const start = new Date(date);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const end = localEndOfDay(date);
  return { start, end };
}

export function dueLabel(dueAt: number): string {
  const due = new Date(dueAt);
  const todayKey = toLocalDateKey();
  const dueKey = toLocalDateKey(due);
  if (dueKey === todayKey) return 'Today';
  const tmr = daysFromNow(1);
  if (dueKey === toLocalDateKey(tmr)) return 'Tomorrow';
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
