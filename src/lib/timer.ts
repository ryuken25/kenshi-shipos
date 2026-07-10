/* ── Timestamp-Based Timer ────────────────────────────────── */
import type { ActiveTimer } from './state/schema';

const uid = () => Math.random().toString(36).slice(2, 10);

export function createTimer(taskId: string | undefined, mode: ActiveTimer['mode'], minutes: number): ActiveTimer {
  const now = Date.now();
  return {
    id: uid(),
    taskId,
    mode,
    plannedMinutes: minutes,
    startedAt: now,
    endsAt: now + minutes * 60000,
    status: 'running',
  };
}

export function getRemainingMs(timer: ActiveTimer): number {
  if (timer.status === 'paused' && timer.remainingMs != null) return timer.remainingMs;
  return Math.max(0, timer.endsAt - Date.now());
}

export function getDisplayTime(timer: ActiveTimer): { minutes: number; seconds: number; progress: number } {
  const remaining = getRemainingMs(timer);
  const total = timer.plannedMinutes * 60000;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const progress = total > 0 ? 1 - remaining / total : 1;
  return { minutes, seconds, progress };
}

export function pauseTimer(timer: ActiveTimer): ActiveTimer {
  return { ...timer, status: 'paused', pausedAt: Date.now(), remainingMs: getRemainingMs(timer) };
}

export function resumeTimer(timer: ActiveTimer): ActiveTimer {
  const remaining = timer.remainingMs || getRemainingMs(timer);
  return { ...timer, status: 'running', endsAt: Date.now() + remaining, pausedAt: undefined, remainingMs: undefined };
}

export function isTimerComplete(timer: ActiveTimer): boolean {
  return timer.status === 'running' && getRemainingMs(timer) <= 0;
}

export function formatTime(minutes: number, seconds: number): string {
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
