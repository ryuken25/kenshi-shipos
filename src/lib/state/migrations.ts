/* ── ShipOS v3→v5 Migration ───────────────────────────────── */
import type { AppState, Task, Blocker, Decision, Note } from './schema';

interface V3State {
  v: 2 | 3;
  mission: { date: string; title: string; intention: string; why: string; top3: string[] };
  tasks: { id: string; title: string; notes: string; status: string; priority: string; tags: string[]; createdAt: number; doneAt?: number }[];
  sessions: { id: string; taskId?: string; minutes: number; ts: number }[];
  blockers: { id: string; title: string; severity: string; status: string; note: string; createdAt: number; resolvedAt?: number; resolveNote?: string }[];
  prompts: { id: string; title: string; body: string; tags: string[]; favorite: boolean }[];
  decisions: { id: string; title: string; context: string; decision: string; date: number }[];
}

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);

function mapTaskStatus(s: string): Task['status'] {
  if (s === 'backlog') return 'inbox';
  if (s === 'now' || s === 'doing') return 'doing';
  if (s === 'done') return 'done';
  return (s as Task['status']) || 'inbox';
}

function mapPriority(p: string): Task['priority'] {
  if (p === 'critical' || p === 'high' || p === 'P0') return 'P0';
  if (p === 'medium' || p === 'P1') return 'P1';
  return 'P2';
}

function mapSeverity(s: string): Blocker['severity'] {
  if (s === 'high') return 'high';
  if (s === 'med' || s === 'medium') return 'med';
  return 'low';
}

export function migrateV3toV5(old: V3State): AppState {
  const tasks: Task[] = old.tasks.map(t => ({
    id: t.id,
    title: t.title,
    notes: t.notes || '',
    status: mapTaskStatus(t.status),
    priority: mapPriority(t.priority),
    tags: t.tags || [],
    subtasks: [],
    recurrence: { type: 'none' },
    topThreeRank: old.mission.top3.includes(t.id)
      ? (old.mission.top3.indexOf(t.id) + 1) as 1 | 2 | 3
      : undefined,
    createdAt: t.createdAt,
    updatedAt: t.createdAt,
    completedAt: t.doneAt,
  }));

  const blockers: Blocker[] = old.blockers.map(b => ({
    id: b.id,
    title: b.title,
    severity: mapSeverity(b.severity),
    category: 'other' as const,
    status: (b.status === 'resolved' ? 'resolved' : 'open') as 'open' | 'resolved',
    note: b.note || '',
    nextAction: '',
    createdAt: b.createdAt,
    resolvedAt: b.resolvedAt,
    resolveNote: b.resolveNote,
  }));

  const decisions: Decision[] = old.decisions.map(d => ({
    id: d.id,
    title: d.title,
    context: d.context || '',
    decision: d.decision || '',
    expectedImpact: '',
    tags: [],
    date: d.date,
  }));

  const notes: Note[] = (old.prompts || []).map(p => ({
    id: p.id,
    title: p.title,
    body: p.body,
    type: 'prompt' as const,
    tags: p.tags || [],
    favorite: p.favorite,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

  const focusSessions = old.sessions.map(s => ({
    id: s.id,
    taskId: s.taskId,
    mode: 'focus' as const,
    plannedMinutes: s.minutes,
    actualMinutes: s.minutes,
    startedAt: s.ts,
    endedAt: s.ts + s.minutes * 60000,
    completed: true,
  }));

  return {
    v: 5,
    mission: {
      date: old.mission.date || today(),
      title: old.mission.title || '',
      why: old.mission.why || '',
      status: 'planned',
      availableMinutes: 120,
      energy: 'normal',
      top3: old.mission.top3 || [],
      desiredFinishTime: '',
    },
    tasks,
    focusSessions,
    activeTimer: null,
    blockers,
    distractions: [],
    decisions,
    notes,
    shipLogs: [],
    events: [],
    dailyPlans: [],
    settings: {
      theme: 'dark',
      dailyFocusGoal: 120,
      defaultFocusPreset: 25,
      soundEnabled: false,
      showScore: true,
      startHour: 9,
      endHour: 17,
    },
  };
}

export function migrateFromV1V2(): V3State | null {
  if (typeof window === 'undefined') return null;
  try {
    const v1Tasks = JSON.parse(localStorage.getItem('shipos-tasks') || '[]');
    const v1Mission = JSON.parse(localStorage.getItem('shipos-mission') || 'null');
    const v1Blockers = JSON.parse(localStorage.getItem('shipos-blockers') || '[]');
    const v1Prompts = JSON.parse(localStorage.getItem('shipos-prompts') || '[]');
    const v1Decisions = JSON.parse(localStorage.getItem('shipos-decisions') || '[]');
    if (v1Mission || v1Tasks.length || v1Blockers.length) {
      return {
        v: 3,
        mission: { date: today(), title: v1Mission?.title || '', intention: v1Mission?.intention || '', why: v1Mission?.whyItMatters || '', top3: [] },
        tasks: v1Tasks.map((t: any) => ({ id: String(t.id || uid()), title: t.title || 'Untitled', notes: t.desc || '', status: t.status || 'backlog', priority: t.priority || 'P1', tags: [t.mode].filter(Boolean), createdAt: t.created || Date.now(), doneAt: t.completed })),
        sessions: [],
        blockers: v1Blockers.map((b: any) => ({ id: String(b.id || uid()), title: b.what || b.title || 'Blocker', severity: b.severity || 'med', status: b.status || 'open', note: b.nextAction || '', createdAt: b.created || Date.now(), resolvedAt: b.resolved })),
        prompts: v1Prompts.map((p: any) => ({ id: String(p.id || uid()), title: p.title || '', body: p.body || '', tags: p.tags || [], favorite: !!p.favorite })),
        decisions: v1Decisions.map((d: any) => ({ id: String(d.id || uid()), title: d.decision || '', context: d.reason || '', decision: d.impact || '', date: d.time || Date.now() })),
      };
    }
  } catch {}
  return null;
}
