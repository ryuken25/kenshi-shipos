/* ── Auto Ship Log Generator ──────────────────────────────── */
import type { AppState, ShipLog } from './state/schema';
import { toLocalDateKey } from './dates/localDate';

const today = () => toLocalDateKey();

export function generateShipLog(s: AppState, range: 'today' | 'week', format: ShipLog['format'] = 'markdown'): string {
  const day = today();
  const weekAgo = Date.now() - 7 * 86400000;
  const isToday = range === 'today';

  const inRange = (ts: number) => isToday
    ? toLocalDateKey(new Date(ts)) === day
    : ts >= weekAgo;

  const done = s.tasks.filter(t => t.completedAt && inRange(t.completedAt));
  const focusSessions = s.focusSessions.filter(x => inRange(x.startedAt) && x.status === "completed");
  const focusMinutes = focusSessions.reduce((a, b) => a + Math.round(b.actualSeconds / 60), 0);
  const distractions = s.distractions.filter(d => inRange(d.capturedAt));
  const blockersCreated = s.blockers.filter(b => inRange(b.createdAt));
  const blockersResolved = s.blockers.filter(b => b.resolvedAt && inRange(b.resolvedAt));
  const decisions = s.decisions.filter(d => inRange(d.date));

  if (format === 'standup') {
    return [
      '## Done',
      ...done.map(t => `- ${t.title}`),
      done.length === 0 ? '- (no completed tasks)' : '',
      '',
      '## Next',
      ...s.tasks.filter(t => t.status === 'today' || t.status === 'doing').slice(0, 3).map(t => `- ${t.title}`),
      '',
      '## Blocked',
      ...blockersCreated.filter(b => b.status === 'open').map(b => `- ${b.title} (${b.severity})`),
      blockersCreated.filter(b => b.status === 'open').length === 0 ? '- (nothing blocking)' : '',
    ].filter(Boolean).join('\n');
  }

  if (format === 'daily') {
    const parts = [];
    if (s.mission.title) parts.push(`Mission: ${s.mission.title}`);
    if (done.length) parts.push(`Shipped ${done.length} task${done.length > 1 ? 's' : ''}: ${done.map(t => t.title).join(', ')}.`);
    if (focusMinutes) parts.push(`Focused for ${focusMinutes} minutes.`);
    if (blockersResolved.length) parts.push(`Resolved ${blockersResolved.length} blocker${blockersResolved.length > 1 ? 's' : ''}.`);
    if (distractions.length) parts.push(`Captured ${distractions.length} distraction${distractions.length > 1 ? 's' : ''}.`);
    if (decisions.length) parts.push(`Logged ${decisions.length} decision${decisions.length > 1 ? 's' : ''}.`);
    if (!parts.length) return 'No activity recorded for this period.';
    return parts.join(' ');
  }

  // markdown (default)
  const lines = [`# Ship Log — ${isToday ? day : 'Weekly'}`, ''];
  if (s.mission.title) {
    lines.push(`**Mission:** ${s.mission.title}`, '');
  }
  lines.push(`## Completed (${done.length})`);
  lines.push(...done.map(t => `- ✅ ${t.title}${t.priority !== 'P2' ? ` [${t.priority}]` : ''}`));
  if (!done.length) lines.push('- _No tasks completed_');
  lines.push('');

  lines.push(`## Focus (${focusMinutes}m)`);
  lines.push(...focusSessions.map(x => {
    const linked = x.taskId ? s.tasks.find(t => t.id === x.taskId) : null;
    const suffix = linked ? ' → ' + linked.title : '';
    return `- ${Math.round(x.plannedSeconds / 60)}m${suffix}`;
  }));
  if (!focusSessions.length) lines.push('- _No focus sessions_');
  lines.push('');

  if (blockersCreated.length) {
    lines.push(`## Blockers (${blockersCreated.filter(b => b.status === 'open').length} open, ${blockersResolved.length} resolved)`);
    lines.push(...blockersCreated.map(b => `- ${b.status === 'resolved' ? '✅' : '🔴'} ${b.title} (${b.severity})`));
    lines.push('');
  }

  if (decisions.length) {
    lines.push(`## Decisions (${decisions.length})`);
    lines.push(...decisions.map(d => `- **${d.title}**: ${d.decision}`));
    lines.push('');
  }

  if (distractions.length) {
    lines.push(`## Distractions Captured (${distractions.length})`);
    lines.push(...distractions.map(d => `- ${d.text}`));
    lines.push('');
  }

  const top3 = s.tasks.filter(t => s.mission.top3.includes(t.id));
  if (top3.length) {
    lines.push('## Top 3 Status');
    lines.push(...top3.map(t => `- ${t.status === 'done' ? '✅' : '⬜'} ${t.title}`));
    lines.push('');
  }

  lines.push('---', `*Generated ${new Date().toLocaleString()}*`);
  return lines.join('\n');
}
