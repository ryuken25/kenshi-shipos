/* ── Ship Momentum — Transparent Execution Score ─────────── */
import type { AppState } from './state/schema';
import { toLocalDateKey } from './dates/localDate';

export interface MomentumBreakdown {
  realityPlan: number;   // 0-20
  execution: number;     // 0-30
  focus: number;         // 0-25
  recovery: number;      // 0-15
  ship: number;          // 0-10
  total: number;         // 0-100
  label: string;
}

const WEIGHTS: Record<string, number> = { P0: 1.5, P1: 1.0, P2: 0.75 };

export function calcMomentum(s: AppState): MomentumBreakdown {
  // Reality Plan (20)
  let plan = 0;
  if (s.mission.title) plan += 5;
  if (s.mission.availableMinutes > 0) plan += 5;
  if (s.mission.top3.length > 0) plan += 5;
  const top3Tasks = s.tasks.filter(t => s.mission.top3.includes(t.id));
  const plannedMins = top3Tasks.reduce((sum, t) => sum + (t.estimateMinutes || 30), 0);
  if (plannedMins > 0 && plannedMins <= s.mission.availableMinutes * 0.85) plan += 5;

  // Execution (30) — weighted Top 3 completion
  let execution = 0;
  const maxExec = 30;
  if (s.mission.top3.length > 0) {
    let totalWeight = 0;
    let doneWeight = 0;
    for (const tid of s.mission.top3) {
      const task = s.tasks.find(t => t.id === tid);
      const w = WEIGHTS[task?.priority || 'P1'] || 1;
      totalWeight += w;
      if (task?.status === 'done') doneWeight += w;
    }
    execution = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * maxExec) : 0;
  }

  // Focus (25)
  const today = toLocalDateKey();
  const focusToday = s.focusSessions
    .filter(x => toLocalDateKey(new Date(x.endedAt || x.startedAt)) === today && x.status === "completed")
    .reduce((a, b) => a + Math.round(b.actualSeconds / 60), 0);
  const goal = s.settings.dailyFocusGoal || 120;
  const focus = Math.min(25, Math.round((focusToday / goal) * 25));

  // Recovery (15)
  const resolvedToday = s.blockers.filter(b => b.status === 'resolved' && b.resolvedAt &&
    toLocalDateKey(new Date(b.resolvedAt)) === today);
  const recoverySprints = s.focusSessions.filter(x => x.mode === 'recovery' && x.status === "completed").length;
  const staleHigh = s.blockers.filter(b => b.status === 'open' && b.severity === 'high' &&
    Date.now() - b.createdAt > 3600000).length;
  const recovery = Math.max(0, Math.min(15, resolvedToday.length * 5 + recoverySprints * 3 - staleHigh * 3));

  // Ship (10)
  let ship = 0;
  if (s.mission.status === 'shipped') ship += 4;
  else if (s.mission.status === 'partial') ship += 2;
  if (s.shipLogs.some(l => l.date === today)) ship += 3;
  if (s.shipLogs.some(l => l.date === today && l.shared)) ship += 3;

  const total = Math.max(0, Math.min(100, plan + execution + focus + recovery + ship));

  let label: string;
  if (total >= 90) label = 'Shipped';
  else if (total >= 75) label = 'Strong execution';
  else if (total >= 50) label = 'In motion';
  else if (total >= 25) label = 'Building momentum';
  else label = 'Setting course';

  return { realityPlan: plan, execution, focus, recovery, ship, total, label };
}
