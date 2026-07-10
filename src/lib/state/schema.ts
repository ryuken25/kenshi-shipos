/* ── ShipOS v5 Schema ─────────────────────────────────────── */
export type Priority = 'P0' | 'P1' | 'P2';
export type TaskStatus = 'inbox' | 'today' | 'doing' | 'done' | 'archived';
export type Severity = 'low' | 'med' | 'high';
export type BlockerCategory = 'unclear' | 'missing_info' | 'technical' | 'waiting' | 'low_energy' | 'interruption' | 'other';
export type Energy = 'low' | 'normal' | 'high';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface RecurrenceNone { type: 'none'; }
export interface RecurrenceDaily { type: 'daily'; interval: number; }
export interface RecurrenceWeekly { type: 'weekly'; interval: number; days: number[]; }
export interface RecurrenceMonthly { type: 'monthly'; interval: number; day: number; }
export type Recurrence = RecurrenceNone | RecurrenceDaily | RecurrenceWeekly | RecurrenceMonthly;

export interface Task {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: Priority;
  tags: string[];
  subtasks: Subtask[];
  dueAt?: number;
  scheduledDate?: string;
  estimateMinutes?: number;
  recurrence: Recurrence;
  topThreeRank?: 1 | 2 | 3;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  archivedAt?: number;
}

export interface FocusSession {
  id: string;
  taskId?: string;
  mode: 'focus' | 'break' | 'recovery';
  plannedMinutes: number;
  actualMinutes: number;
  startedAt: number;
  endedAt?: number;
  completed: boolean;
}

export interface ActiveTimer {
  id: string;
  taskId?: string;
  mode: 'focus' | 'break' | 'recovery';
  plannedMinutes: number;
  startedAt: number;
  endsAt: number;
  pausedAt?: number;
  remainingMs?: number;
  status: 'running' | 'paused';
}

export interface Blocker {
  id: string;
  title: string;
  severity: Severity;
  category: BlockerCategory;
  status: 'open' | 'resolved';
  note: string;
  nextAction: string;
  taskId?: string;
  createdAt: number;
  resolvedAt?: number;
  resolveNote?: string;
  recoverySprintMinutes?: number;
}

export interface Distraction {
  id: string;
  text: string;
  capturedAt: number;
  convertedToTask: boolean;
  taskId?: string;
}

export interface Decision {
  id: string;
  title: string;
  context: string;
  decision: string;
  expectedImpact: string;
  taskId?: string;
  tags: string[];
  date: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  type: 'note' | 'checklist' | 'prompt' | 'template';
  tags: string[];
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ShipLog {
  id: string;
  date: string;
  range: 'today' | 'week';
  format: 'daily' | 'standup' | 'markdown' | 'weekly';
  content: string;
  shared: boolean;
  createdAt: number;
}

export interface Mission {
  date: string;
  title: string;
  why: string;
  status: 'planned' | 'in_progress' | 'shipped' | 'partial';
  availableMinutes: number;
  energy: Energy;
  top3: string[];
  desiredFinishTime?: string;
}

export interface DailyPlan {
  date: string;
  mission: Mission;
  plannedMinutes: number;
  safeCapacity: number;
  overcommitted: boolean;
  bufferMinutes: number;
  timeline: TimelineEntry[];
}

export interface TimelineEntry {
  taskId: string;
  title: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

export interface AppEvent {
  id: string;
  type: 'mission_created' | 'task_added' | 'task_completed' | 'focus_completed' | 'distraction_captured' | 'blocker_created' | 'blocker_resolved' | 'decision_recorded' | 'ship_log_generated' | 'recovery_sprint' | 'timer_started' | 'timer_paused' | 'timer_resumed';
  detail: string;
  ts: number;
}

export interface AppState {
  v: 5;
  mission: Mission;
  tasks: Task[];
  focusSessions: FocusSession[];
  activeTimer: ActiveTimer | null;
  blockers: Blocker[];
  distractions: Distraction[];
  decisions: Decision[];
  notes: Note[];
  shipLogs: ShipLog[];
  events: AppEvent[];
  dailyPlans: DailyPlan[];
  settings: AppSettings;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  dailyFocusGoal: number;
  defaultFocusPreset: number;
  soundEnabled: boolean;
  showScore: boolean;
  startHour: number;
  endHour: number;
}

export const STORAGE_KEY = 'kenshi-shipos:v5';
export const PREV_KEYS = ['kenshi-shipos:v3', 'kenshi-shipos:v2'];
export const ONBOARDING_KEY = 'shipos-onboarded-v5';
export const SAMPLE_KEY = 'shipos-sample-v5';
