/* ── Capacity Guard ───────────────────────────────────────── */
import type { Task, DailyPlan, TimelineEntry } from './state/schema';

const uid = () => Math.random().toString(36).slice(2, 10);

export function computeCapacity(tasks: Task[], availableMinutes: number) {
  const todayTasks = tasks.filter(t => t.status === 'today' || t.status === 'doing');
  const planned = todayTasks.reduce((sum, t) => sum + (t.estimateMinutes || 30), 0);
  const buffer = Math.max(15, Math.round(availableMinutes * 0.15));
  const safeCapacity = availableMinutes - buffer;
  const remaining = safeCapacity - planned;
  const overcommitted = planned > safeCapacity;

  let label: 'balanced' | 'tight' | 'overloaded';
  if (planned <= safeCapacity - 10) label = 'balanced';
  else if (planned <= safeCapacity) label = 'tight';
  else label = 'overloaded';

  return { planned, buffer, safeCapacity, remaining, overcommitted, label, todayTasks };
}

export function suggestDefers(tasks: Task[], availableMinutes: number): { task: Task; reason: string; minutesSaved: number }[] {
  const { safeCapacity } = computeCapacity(tasks, availableMinutes);
  const todayTasks = tasks.filter(t => t.status === 'today' || t.status === 'doing');
  const planned = todayTasks.reduce((sum, t) => sum + (t.estimateMinutes || 30), 0);
  if (planned <= safeCapacity) return [];

  const candidates = todayTasks
    .filter(t => !t.topThreeRank && t.priority !== 'P0')
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'P2' ? -1 : 1;
      return (b.estimateMinutes || 30) - (a.estimateMinutes || 30);
    });

  const suggestions: { task: Task; reason: string; minutesSaved: number }[] = [];
  let freed = 0;
  for (const task of candidates) {
    if (planned - freed <= safeCapacity) break;
    const mins = task.estimateMinutes || 30;
    const reasons = [];
    if (!task.topThreeRank) reasons.push('not in Top 3');
    if (task.priority === 'P2') reasons.push('lower priority');
    if (!task.dueAt) reasons.push('no due date');
    suggestions.push({ task, reason: reasons.join(', '), minutesSaved: mins });
    freed += mins;
  }
  return suggestions;
}

export function generateTimeline(tasks: Task[], startHour: number): TimelineEntry[] {
  const sorted = tasks
    .filter(t => t.status === 'today' || t.status === 'doing')
    .sort((a, b) => {
      if (a.topThreeRank && b.topThreeRank) return a.topThreeRank - b.topThreeRank;
      if (a.topThreeRank) return -1;
      if (b.topThreeRank) return 1;
      return (a.priority === 'P0' ? 0 : a.priority === 'P1' ? 1 : 2) - (b.priority === 'P0' ? 0 : b.priority === 'P1' ? 1 : 2);
    });

  const entries: TimelineEntry[] = [];
  let minutes = startHour * 60;

  for (let i = 0; i < sorted.length; i++) {
    const task = sorted[i];
    const dur = task.estimateMinutes || 30;
    const startH = Math.floor(minutes / 60);
    const startM = minutes % 60;
    minutes += dur;
    const endH = Math.floor(minutes / 60);
    const endM = minutes % 60;
    entries.push({
      taskId: task.id,
      title: task.title,
      startTime: `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')}`,
      endTime: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
      isBreak: false,
    });
    if (i < sorted.length - 1) {
      const breakStart = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      minutes += 10;
      const bH = Math.floor(minutes / 60);
      const bM = minutes % 60;
      entries.push({
        taskId: '',
        title: 'Break',
        startTime: breakStart,
        endTime: `${String(bH).padStart(2, '0')}:${String(bM).padStart(2, '0')}`,
        isBreak: true,
      });
    }
  }
  return entries;
}
