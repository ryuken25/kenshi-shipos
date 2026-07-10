'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle, BarChart3, BookOpen, Check, ChevronRight, Clock, Command, Copy,
  Download, FileText, Flag, MoreHorizontal, Pause, Play, Plus, RefreshCw, Rocket,
  Search, Settings, Target, Timer, Trash2, Upload, X, Zap, Shield, Eye, EyeOff,
  ChevronDown, ArrowRight, RotateCcw, ClipboardCheck, StickyNote, TrendingUp,
  Lightbulb, Calendar, Coffee, AlertCircle, CheckCircle2, Circle
} from 'lucide-react';
import type { AppState, Task, Blocker, Distraction, Decision, Note, FocusSession, FocusSessionStatus, ActiveTimer, Priority, TaskStatus, Severity, BlockerCategory, Energy, AppEvent, ShipLog } from '@/lib/state/schema';
import { STORAGE_KEY, PREV_KEYS, ONBOARDING_KEY, SAMPLE_KEY } from '@/lib/state/schema';
import { migrateV3toV5, migrateFromV1V2 } from '@/lib/state/migrations';
import { computeCapacity, suggestDefers, generateTimeline } from '@/lib/capacity';
import { calcMomentum, type MomentumBreakdown } from '@/lib/momentum';
import { generateShipLog } from '@/lib/ship-log';
import { createTimer, getRemainingMs, getDisplayTime, pauseTimer, resumeTimer, isTimerComplete, formatTime } from '@/lib/timer';
import { parseQuickCapture, createTaskFromParsed, type ParsedTask } from '@/lib/task-parser';
import { toLocalDateKey, greeting, localDateKeyFromTs, isToday as isTodayDate } from '@/lib/dates/localDate';

/* ── Types ────────────────────────────────────────────────── */
type Tab = 'today' | 'tasks' | 'focus' | 'review' | 'insights' | 'settings';
type ReviewTab = 'ship-log' | 'blockers' | 'decisions' | 'notes';

const today = () => toLocalDateKey();
const uid = () => Math.random().toString(36).slice(2, 10);
const safeTags = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean).slice(0, 8);

const navItems: { id: Tab; label: string; icon: any; shortcut?: string }[] = [
  { id: 'today', label: 'Today', icon: Target, shortcut: 'T' },
  { id: 'tasks', label: 'Tasks', icon: FileText, shortcut: 'N' },
  { id: 'focus', label: 'Focus', icon: Timer, shortcut: 'F' },
  { id: 'review', label: 'Review', icon: Rocket, shortcut: 'R' },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const bottomNav = navItems.slice(0, 4);
const moreNav = navItems.slice(4);

/* ── Route maps (v5 + legacy redirects) ──────────────────── */
const routeMap: Record<Tab, string> = { today: '/today', tasks: '/tasks', focus: '/focus', review: '/review', insights: '/insights', settings: '/settings' };
const legacyRedirects: Record<string, Tab> = {
  '/mission': 'today', '/blockers': 'review', '/decisions': 'review',
  '/ship-log': 'review', '/vault': 'review', '/stats': 'insights',
};
const pathToTab = (path: string): Tab => {
  for (const [r, t] of Object.entries(routeMap)) if (path === r) return t as Tab;
  for (const [r, t] of Object.entries(legacyRedirects)) if (path === r) return t;
  return 'today';
};

/* ── Default state ────────────────────────────────────────── */
function defaultState(): AppState {
  return {
    v: 5,
    mission: { date: today(), title: '', why: '', status: 'planned', availableMinutes: 120, energy: 'normal', top3: [], desiredFinishTime: '' },
    tasks: [], focusSessions: [], activeTimer: null,
    blockers: [], distractions: [], decisions: [], notes: [],
    shipLogs: [], events: [], dailyPlans: [],
    settings: { theme: 'dark', dailyFocusGoal: 120, defaultFocusPreset: 25, soundEnabled: false, showScore: true, startHour: 9, endHour: 17 },
  };
}

function demoState(): AppState {
  const now = Date.now();
  const base = defaultState();
  return {
    ...base,
    mission: { date: today(), title: 'Publish the final weekly product update', why: 'Judges must understand and test it on phone.', status: 'in_progress', availableMinutes: 120, energy: 'normal', top3: ['t1', 't2', 't3'], desiredFinishTime: '17:00' },
    tasks: [
      { id: 't1', title: 'Finish mobile responsive QA', notes: 'Check first screen clarity and CTA visibility.', status: 'done', priority: 'P0', tags: ['mobile', 'qa'], subtasks: [], estimateMinutes: 45, topThreeRank: 1, createdAt: now - 3600000, updatedAt: now - 1800000, completedAt: now - 1800000, recurrence: { type: 'none' } },
      { id: 't2', title: 'Test the complete focus and blocker flow', notes: 'Verify timer accuracy, distraction capture, and recovery sprint.', status: 'doing', priority: 'P0', tags: ['focus'], subtasks: [], estimateMinutes: 35, topThreeRank: 2, createdAt: now - 2600000, updatedAt: now, recurrence: { type: 'none' } },
      { id: 't3', title: 'Generate and share the final Ship Log', notes: 'Create final update for Telegram/GitHub.', status: 'today', priority: 'P1', tags: ['report'], subtasks: [], estimateMinutes: 25, topThreeRank: 3, createdAt: now - 1600000, updatedAt: now, recurrence: { type: 'none' } },
      { id: 't4', title: 'Polish secondary chart alignment', notes: '', status: 'today', priority: 'P2', tags: ['ui'], subtasks: [], estimateMinutes: 30, createdAt: now - 1000000, updatedAt: now, recurrence: { type: 'none' } },
    ],
    focusSessions: [{ id: 's1', taskId: 't1', mode: 'focus', plannedSeconds: 2700, actualSeconds: 2520, startedAt: now - 3000000, endedAt: now - 480000, status: 'completed' }],
    blockers: [
      { id: 'b1', title: 'Browser wallet popup needs manual testing', severity: 'med', category: 'technical', status: 'open', note: 'Owner should test on real phone wallet.', nextAction: 'Ask owner to test on MetaMask mobile', createdAt: now - 900000 },
      { id: 'b2', title: 'Missing API credentials for Supabase', severity: 'low', category: 'waiting', status: 'resolved', note: '', nextAction: '', createdAt: now - 5000000, resolvedAt: now - 2000000, resolveNote: 'Credentials provided by owner' },
    ],
    distractions: [{ id: 'd1', text: 'Remember to reply to Alex about the deployment schedule', capturedAt: now - 600000, convertedToTask: false }],
    decisions: [{ id: 'dec1', title: 'Keep demo mode separate', context: 'Real payment must be default for contest.', decision: 'Base Sepolia flow remains opt-in testnet demo.', expectedImpact: 'Cleaner contest submission', tags: ['architecture'], date: now - 800000 }],
    events: [
      { id: 'e1', type: 'mission_created', detail: 'Mission set: Publish the final weekly product update', ts: now - 3700000 },
      { id: 'e2', type: 'task_completed', detail: 'Finish mobile responsive QA', ts: now - 1800000 },
      { id: 'e3', type: 'focus_completed', detail: '42m focus on mobile QA', ts: now - 480000 },
    ],
  };
}

/* ── Migration ────────────────────────────────────────────── */
function loadState(): AppState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { const p = JSON.parse(raw); if (p?.v === 5) return p; }
    for (const key of PREV_KEYS) {
      const raw2 = localStorage.getItem(key);
      if (raw2) { const p = JSON.parse(raw2); if (p?.v === 2 || p?.v === 3) return migrateV3toV5(p); }
    }
    const v1 = migrateFromV1V2();
    if (v1) return migrateV3toV5(v1);
  } catch {}
  return defaultState();
}

/* ── Main App ─────────────────────────────────────────────── */
export default function ShipOSApp() {
  const [state, setState] = useState<AppState>(defaultState());
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => pathToTab(pathname));
  const [reviewTab, setReviewTab] = useState<ReviewTab>('ship-log');
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [sampleWorkspace, setSampleWorkspace] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [focusStartToken, setFocusStartToken] = useState(0);
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const [quickBlockerOpen, setQuickBlockerOpen] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [undoAction, setUndoAction] = useState<{label: string; undo: () => void} | null>(null);

  // Init
  useEffect(() => {
    setState(loadState());
    setOnboardingOpen(localStorage.getItem(ONBOARDING_KEY) !== '1');
    setSampleWorkspace(localStorage.getItem(SAMPLE_KEY) === '1');
    // Legacy redirect
    const legacy = legacyRedirects[window.location.pathname];
    if (legacy) router.replace(routeMap[legacy]);
    else setTab(pathToTab(window.location.pathname));
    setReady(true);
  }, []);

  // Sync tab with URL
  useEffect(() => {
    setTab(pathToTab(pathname));
    // Handle legacy hash
    if (pathname === '/review') {
      const hash = window.location.hash.replace('#', '');
      if (hash && ['ship-log', 'blockers', 'decisions', 'notes'].includes(hash)) {
        setReviewTab(hash as ReviewTab);
      }
    }
  }, [pathname]);

  // Persist
  useEffect(() => {
    if (ready) try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { setToast('Storage quota issue. Export backup before adding more data.'); }
  }, [state, ready]);

  // Toast auto-dismiss
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2500); return () => clearTimeout(id); }, [toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.matches('input, textarea, select, [contenteditable="true"]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(v => !v); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === '?') { e.preventDefault(); setPaletteOpen(true); }
      if (key === 'n') quickAddTask();
      if (key === 'f') go('focus');
      if (key === 'b') quickAddBlocker();
      if (key === 'd') quickCaptureDistraction();
      if (key === 'l') { go('review'); setReviewTab('ship-log'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const patch = useCallback((p: Partial<AppState>) => setState(prev => ({ ...prev, ...p })), []);
  const addEvent = useCallback((type: AppEvent['type'], detail: string) => {
    setState(prev => ({ ...prev, events: [...prev.events, { id: uid(), type, detail, ts: Date.now() }].slice(-100) }));
  }, []);

  const openBlockers = state.blockers.filter(b => b.status === 'open').length;
  const momentum = useMemo(() => calcMomentum(state), [state]);
  const capacity = useMemo(() => computeCapacity(state.tasks, state.mission.availableMinutes), [state.tasks, state.mission.availableMinutes]);

  // Actions
  const go = (next: Tab) => { setMoreOpen(false); setPaletteOpen(false); router.push(routeMap[next]); };

  function loadSample() { setState(demoState()); setSampleWorkspace(true); localStorage.setItem(SAMPLE_KEY, '1'); setToast('Sample workspace ready'); }
  function startFresh() { setState(defaultState()); setSampleWorkspace(false); localStorage.removeItem(SAMPLE_KEY); setToast('Fresh workspace ready'); }
  function finishOnboarding(next?: AppState, isSample = false) {
    if (next) setState(next);
    setSampleWorkspace(isSample);
    isSample ? localStorage.setItem(SAMPLE_KEY, '1') : localStorage.removeItem(SAMPLE_KEY);
    localStorage.setItem(ONBOARDING_KEY, '1');
    setOnboardingOpen(false);
  }

  function quickAddTask() {
    setQuickTaskOpen(true);
    setQuickTaskTitle('');
  }

  function submitQuickTask() {
    if (!quickTaskTitle.trim()) return;
    const parsed = parseQuickCapture(quickTaskTitle);
    if (parsed) {
      const task = createTaskFromParsed(parsed);
      setState(s => ({ ...s, tasks: [...s.tasks, task] }));
      addEvent('task_added', task.title);
      setToast('Task added');
    }
    setQuickTaskOpen(false);
    setQuickTaskTitle('');
  }

  function quickAddBlocker() {
    setQuickBlockerOpen(true);
  }

  function quickCaptureDistraction() {
    // Handled inline in FocusPage via showDistraction state
    setToast('Use the distraction field in Focus');
  }

  async function copyShipLog() {
    const text = generateShipLog(state, 'today');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      }
      setState(s => ({ ...s, shipLogs: [...s.shipLogs, { id: uid(), date: today(), range: 'today', format: 'markdown', content: text, shared: true, createdAt: Date.now() }] }));
      addEvent('ship_log_copied', 'Ship Log copied');
      setToast('Ship Log copied');
    } catch { setToast('Copy failed — try downloading instead'); }
    setPaletteOpen(false);
  }

  // Task CRUD
  const addTask = (task: Task) => { setState(s => ({ ...s, tasks: [...s.tasks, task] })); addEvent('task_added', task.title); };
  const updateTask = (id: string, patch: Partial<Task>) => {
    setState(s => ({
      ...s,
      tasks: s.tasks.map(t => t.id === id ? { ...t, ...patch, updatedAt: Date.now(), ...(patch.status === 'done' && !t.completedAt ? { completedAt: Date.now() } : {}) } : t),
      mission: patch.status === 'done' && s.mission.top3.includes(id)
        ? { ...s.mission, status: s.tasks.filter(t => s.mission.top3.includes(t.id) && t.id !== id).every(t => t.status === 'done') ? 'shipped' : s.mission.status }
        : s.mission,
    }));
    if (patch.status === 'done') {
      const task = state.tasks.find(t => t.id === id);
      if (task) addEvent('task_completed', task.title);
    }
  };
  const archiveTask = (id: string) => {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    const prevStatus = task.status;
    const prevTop3 = task.topThreeRank;
    setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, status: 'archived' as TaskStatus, archivedAt: Date.now() } : t) }));
    setUndoAction({ label: 'Task archived', undo: () => {
      setState(s => ({ ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, status: prevStatus, archivedAt: undefined, topThreeRank: prevTop3 } : t) }));
    }});
    addEvent('task_archived', task.title);
  };

  // Timer
  function startFocus(taskId?: string, minutes?: number) {
    const mins = minutes || state.settings.defaultFocusPreset;
    const timer = createTimer(taskId, 'focus', mins);
    setState(s => ({ ...s, activeTimer: timer }));
    addEvent('timer_started', `Focus ${mins}m`);
    document.title = formatTime(mins, 0) + ' — ShipOS';
  }
  function pauseFocus() { if (state.activeTimer) { setState(s => ({ ...s, activeTimer: s.activeTimer ? pauseTimer(s.activeTimer) : null })); addEvent('timer_paused', 'Paused'); } }
  function resumeFocus() { if (state.activeTimer) { setState(s => ({ ...s, activeTimer: s.activeTimer ? resumeTimer(s.activeTimer) : null })); addEvent('timer_resumed', 'Resumed'); } }
  function completeFocus(early = false) {
    if (!state.activeTimer) return;
    const t = state.activeTimer;
    const elapsedMs = t.plannedMinutes * 60000 - getRemainingMs(t);
    const actualSec = Math.round(elapsedMs / 1000);
    const session: FocusSession = { id: uid(), taskId: t.taskId, mode: t.mode, plannedSeconds: t.plannedMinutes * 60, actualSeconds: actualSec, startedAt: t.startedAt, endedAt: Date.now(), status: early ? 'ended_early' : 'completed' };
    setState(s => ({ ...s, activeTimer: null, focusSessions: [...s.focusSessions, session] }));
    addEvent(early ? 'focus_ended_early' : 'focus_completed', `${Math.round(actualSec / 60)}m${t.taskId ? '' : ' (unlinked)'}`);
    document.title = 'Kenshi ShipOS';
    setToast(early ? 'Focus ended early' : 'Focus complete! 🎯');
  }

  // Blocker CRUD
  const resolveBlocker = (id: string, note: string) => {
    setState(s => ({ ...s, blockers: s.blockers.map(b => b.id === id ? { ...b, status: 'resolved', resolvedAt: Date.now(), resolveNote: note } : b) }));
    addEvent('blocker_resolved', note);
  };

  // Timer tick
  useEffect(() => {
    if (!state.activeTimer || state.activeTimer.status !== 'running') return;
    const id = setInterval(() => {
      setState(s => {
        if (!s.activeTimer || s.activeTimer.status !== 'running') return s;
        if (isTimerComplete(s.activeTimer)) {
          const t = s.activeTimer;
          const session: FocusSession = { id: uid(), taskId: t.taskId, mode: t.mode, plannedSeconds: t.plannedMinutes * 60, actualSeconds: t.plannedMinutes * 60, startedAt: t.startedAt, endedAt: Date.now(), status: 'completed' };
          document.title = 'Kenshi ShipOS';
          setTimeout(() => setToast('Focus complete! 🎯'), 100);
          return { ...s, activeTimer: null, focusSessions: [...s.focusSessions, session] };
        }
        // Update document title
        const { minutes, seconds } = getDisplayTime(s.activeTimer);
        document.title = formatTime(minutes, seconds) + ' — ShipOS';
        return { ...s };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [state.activeTimer?.status]);

  // Page renderer
  const pageContent = useMemo(() => {
    switch (tab) {
      case 'today': return <TodayPage state={state} setState={setState} momentum={momentum} capacity={capacity} updateTask={updateTask} startFocus={startFocus} addEvent={addEvent} setToast={setToast} go={go} />;
      case 'tasks': return <TasksPage state={state} addTask={addTask} updateTask={updateTask} deleteTask={archiveTask} startFocus={startFocus} setToast={setToast} />;
      case 'focus': return <FocusPage state={state} startFocus={startFocus} pauseFocus={pauseFocus} resumeFocus={resumeFocus} completeFocus={completeFocus} captureDistraction={quickCaptureDistraction} resolveBlocker={resolveBlocker} setState={setState} addEvent={addEvent} setToast={setToast} focusStartToken={focusStartToken} />;
      case 'review': return <ReviewPage state={state} setState={setState} reviewTab={reviewTab} setReviewTab={setReviewTab} copyShipLog={copyShipLog} setToast={setToast} addEvent={addEvent} />;
      case 'insights': return <InsightsPage state={state} momentum={momentum} />;
      case 'settings': return <SettingsPage state={state} setState={setState} setToast={setToast} sampleWorkspace={sampleWorkspace} onLoadSample={loadSample} onStartFresh={startFresh} onReopenOnboarding={() => setOnboardingOpen(true)} />;
    }
  }, [tab, state, momentum, capacity, reviewTab, focusStartToken]);

  return (
    <main className="min-h-screen bg-[#0B0D14] pb-24 text-white md:pb-0">
      {/* ── Header ── */}
      <header className="border-b border-white/10 bg-[#0B0D14]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/brand/verse/verse-mark.svg" alt="VERSE logo" className="h-10 w-10 shrink-0 rounded-2xl" />
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#39D0FF]">Built for VERSE community</p>
                <h1 className="truncate font-heading text-xl font-black tracking-[-0.04em] sm:text-3xl">Kenshi ShipOS</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {sampleWorkspace && <span className="rounded-full border border-[#39D0FF]/30 bg-[#39D0FF]/10 px-3 py-1.5 text-[10px] font-black text-[#39D0FF]">Sample workspace</span>}
              {state.activeTimer && state.activeTimer.status === 'running' && (
                <button onClick={() => go('focus')} className="flex items-center gap-2 rounded-full border border-[#49D17D]/30 bg-[#49D17D]/10 px-3 py-1.5 text-[10px] font-black text-[#49D17D]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#49D17D]" />
                  <TimerTick timer={state.activeTimer} />
                </button>
              )}
              <button onClick={() => setPaletteOpen(true)} className="hidden min-h-10 items-center gap-2 rounded-2xl bg-white/10 px-3 text-xs font-black text-[#DDE7FF] sm:inline-flex">
                <Command size={14} /> Cmd K
              </button>
            </div>
          </div>

          {/* ── Tagline ── */}
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-heading text-lg font-black tracking-[-0.03em] text-white sm:text-xl">Turn a realistic plan into shipped work.</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#A6ADBD] sm:text-sm">Set one mission, protect your available time, enter focus, recover from blockers, and generate your progress update automatically.</p>
            </div>
            <div className="hidden grid-cols-4 gap-1.5 text-center text-[10px] sm:grid">
              <MomentumRing value={momentum.total} label={momentum.label} />
            </div>
          </div>

          {/* ── Desktop nav ── */}
          <nav className="hidden gap-1.5 overflow-x-auto md:flex" aria-label="ShipOS sections">
            {navItems.map(n => (
              <button key={n.id} onClick={() => go(n.id)}
                className={`relative flex min-h-10 shrink-0 items-center gap-1.5 rounded-2xl px-3 text-xs font-black transition ${tab === n.id ? 'bg-[#7C5CFF] text-white' : 'bg-white/5 text-[#A6ADBD] hover:bg-white/10 hover:text-white'}`}>
                <n.icon size={14} />{n.label}
                {n.id === 'review' && openBlockers > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[9px] text-white">{openBlockers}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* ── Content ── */}
      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {pageContent}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#101321]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl md:hidden" aria-label="Mobile nav">
        <div className="grid grid-cols-5 gap-1">
          {bottomNav.map(n => (
            <button key={n.id} onClick={() => go(n.id)}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-black ${tab === n.id ? 'bg-[#7C5CFF] text-white' : 'text-[#A6ADBD]'}`}>
              <n.icon size={18} />{n.label}
              {n.id === 'review' && openBlockers > 0 && <span className="absolute right-3 top-2 rounded-full bg-red-500 px-1.5 text-[8px] text-white">{openBlockers}</span>}
            </button>
          ))}
          <button onClick={() => setMoreOpen(true)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-black text-[#A6ADBD]">
            <MoreHorizontal size={18} />More
          </button>
        </div>
      </nav>

      {/* ── More sheet ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 md:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border border-white/10 bg-[#101321] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]" onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><b>More</b><button onClick={() => setMoreOpen(false)} className="rounded-full bg-white/10 p-2"><X size={18} /></button></div>
            <div className="grid gap-2">
              {moreNav.map(n => (
                <button key={n.id} onClick={() => go(n.id)} className="flex min-h-12 items-center gap-3 rounded-2xl bg-white/5 px-4 font-bold">
                  <n.icon size={18} />{n.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Command palette ── */}
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} go={go} addTask={quickAddTask} startFocus={() => { go('focus'); setFocusStartToken(v => v + 1); }} addBlocker={quickAddBlocker} captureDistraction={quickCaptureDistraction} copyLog={copyShipLog} />}

      {/* ── Onboarding ── */}
      {onboardingOpen && ready && <Onboarding current={state} onFinish={finishOnboarding} />}

      {/* ── Toast ── */}
      {/* Undo Toast */}
      {undoAction && <div className="fixed bottom-24 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-[#11131D] border border-white/10 px-4 py-3 text-sm font-bold shadow-2xl md:bottom-8"><span>{undoAction.label}</span><button onClick={() => { undoAction.undo(); setUndoAction(null); setToast('Undone'); }} className="rounded-xl bg-[#7C5CFF] px-3 py-1.5 text-xs font-black">Undo</button><button onClick={() => setUndoAction(null)} className="rounded-xl bg-white/10 px-3 py-1.5 text-xs">Dismiss</button></div>}

      {/* Quick Task Sheet */}
      {quickTaskOpen && <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/70 sm:items-center" onClick={() => setQuickTaskOpen(false)}>
        <div className="w-full max-w-lg rounded-t-[2rem] border border-white/10 bg-[#11131D] p-6 sm:rounded-[2rem]" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-black">Quick capture</h3>
          <p className="mt-1 text-xs text-[#A6ADBD]">Supports: !p0 #tag 30m tomorrow weekly</p>
          <div className="mt-4 space-y-3">
            <I v={quickTaskTitle} onChange={setQuickTaskTitle} placeholder="What needs to be done?" />
            {quickTaskTitle.trim() && (() => { const p = parseQuickCapture(quickTaskTitle); return p ? <div className="rounded-xl bg-white/[0.05] p-3 text-xs"><p className="font-bold">{p.title}</p><p className="mt-1 text-[#A6ADBD]">{p.priority} · {p.estimateMinutes || 30}m{p.tags.length ? ' · ' + p.tags.map(t => '#'+t).join(' ') : ''}{p.scheduledDate ? ' · ' + p.scheduledDate : ''}</p></div> : null; })()}
            <button onClick={submitQuickTask} className="w-full rounded-2xl bg-[#49D17D] py-3 font-black text-[#0B0D14]">Add task</button>
          </div>
        </div>
      </div>}

      {/* Quick Blocker Sheet */}
      {quickBlockerOpen && <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/70 sm:items-center" onClick={() => setQuickBlockerOpen(false)}>
        <div className="w-full max-w-lg rounded-t-[2rem] border border-white/10 bg-[#11131D] p-6 sm:rounded-[2rem]" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-black">What is blocking the ship?</h3>
          <div className="mt-4 space-y-3">
            <I v={quickTaskTitle} onChange={setQuickTaskTitle} placeholder="Describe the blocker" />
            <button onClick={() => { if (!quickTaskTitle.trim()) return; setState(s => ({ ...s, blockers: [...s.blockers, { id: uid(), title: quickTaskTitle.trim(), severity: 'med', category: 'other', status: 'open', note: '', nextAction: '', createdAt: Date.now() }] })); addEvent('blocker_created', quickTaskTitle.trim()); setToast('Blocker added'); setQuickBlockerOpen(false); setQuickTaskTitle(''); }} className="w-full rounded-2xl bg-[#7C5CFF] py-3 font-black">Add blocker</button>
          </div>
        </div>
      </div>}

      {toast && <div role="status" aria-live="polite" className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-2xl bg-[#49D17D] px-4 py-3 text-sm font-black text-[#0B0D14] shadow-2xl">{toast}</div>}

      <footer className="mx-auto max-w-7xl px-4 pb-8 pt-3 text-center text-[10px] text-[#A6ADBD] sm:px-6 md:pb-6">Built for the VERSE community — Design vs Coding: Productivity Tools — July 2026</footer>
    </main>
  );
}

/* ── Helper: live timer tick ──────────────────────────────── */
function TimerTick({ timer }: { timer: ActiveTimer }) {
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(v => v + 1), 1000); return () => clearInterval(id); }, []);
  const { minutes, seconds } = getDisplayTime(timer);
  return <span className="font-mono text-xs">{formatTime(minutes, seconds)}</span>;
}

/* ── Helper: momentum ring ────────────────────────────────── */
function MomentumRing({ value, label }: { value: number; label: string }) {
  const r = 20, c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <div className="col-span-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="#49D17D" strokeWidth="4" strokeDasharray={c} strokeDashoffset={c - dash} strokeLinecap="round" />
      </svg>
      <div>
        <p className="text-lg font-black text-white">{value}</p>
        <p className="text-[10px] text-[#A6ADBD]">{label}</p>
      </div>
    </div>
  );
}

/* ── Panel / Input helpers ────────────────────────────────── */
function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: any; action?: any }) {
  return <section className="rounded-[1.5rem] border border-white/10 bg-[#11131D]/85 p-4 shadow-2xl sm:p-6">
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="font-heading text-xl font-black tracking-[-0.04em]">{title}</h2>{subtitle && <p className="mt-1 text-xs leading-5 text-[#A6ADBD]">{subtitle}</p>}</div>{action}
    </div>{children}
  </section>;
}
function StatPill({ label, value }: { label: string; value: any }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-2.5"><p className="text-[9px] font-bold uppercase text-[#A6ADBD]">{label}</p><p className="mt-0.5 text-base font-black text-white">{value}</p></div>;
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-[#A6ADBD]">{text}</div>;
}
const I = ({ v, onChange, ...p }: any) => <input value={v} onChange={(e: any) => onChange(e.target.value)} {...p} className={`min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-base outline-none focus:border-[#39D0FF] ${p.className || ''}`} />;
const TA = ({ v, onChange, ...p }: any) => <textarea value={v} onChange={(e: any) => onChange(e.target.value)} {...p} className={`w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none focus:border-[#39D0FF] ${p.className || ''}`} />;

/* ── TODAY PAGE ───────────────────────────────────────────── */
function TodayPage({ state, setState, momentum, capacity, updateTask, startFocus, addEvent, setToast, go }: any) {
  const updateMission = (m: Partial<AppState['mission']>) => setState((s: AppState) => ({ ...s, mission: { ...s.mission, ...m } }));
  const toggleTop = (id: string) => {
    const current = state.mission.top3;
    const next = current.includes(id) ? current.filter((x: string) => x !== id) : [...current, id].slice(0, 3);
    updateMission({ top3: next });
  };
  const top3Tasks = state.tasks.filter((t: Task) => state.mission.top3.includes(t.id) && t.status !== 'archived');
  const recentEvents = state.events.slice(-8).reverse();
  const defers = suggestDefers(state.tasks, state.mission.availableMinutes);
  const capLabel = capacity.label === 'balanced' ? 'Your plan fits with a buffer.' : capacity.label === 'tight' ? 'Your plan fits, but almost no recovery buffer.' : `You planned ${capacity.planned}m into ${capacity.safeCapacity}m safe capacity.`;

  return <div className="space-y-4">
    {/* Mission + Momentum */}
    <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
      <Panel title="Today" subtitle="Set one outcome and the time you truly have.">
        <I v={state.mission.title} onChange={(v: string) => updateMission({ title: v })} placeholder="What must ship today?" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-[10px] font-bold uppercase text-[#A6ADBD]">Why it matters</label><TA v={state.mission.why} onChange={(v: string) => updateMission({ why: v })} placeholder="Why does this matter?" rows={2} /></div>
          <div className="space-y-2">
            <div><label className="mb-1 block text-[10px] font-bold uppercase text-[#A6ADBD]">Available minutes</label><I v={String(state.mission.availableMinutes)} onChange={(v: string) => updateMission({ availableMinutes: parseInt(v) || 0 })} type="number" /></div>
            <div><label className="mb-1 block text-[10px] font-bold uppercase text-[#A6ADBD]">Energy</label>
              <div className="flex gap-1">{(['low', 'normal', 'high'] as Energy[]).map(e => <button key={e} onClick={() => updateMission({ energy: e })} className={`flex-1 rounded-xl py-2 text-xs font-black capitalize ${state.mission.energy === e ? 'bg-[#7C5CFF] text-white' : 'bg-white/5 text-[#A6ADBD]'}`}>{e}</button>)}</div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Ship Momentum */}
      <Panel title="Ship Momentum" subtitle={momentum.label}>
        <div className="flex items-center gap-4">
          <svg width="80" height="80" viewBox="0 0 80 80" className="shrink-0 -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke="#49D17D" strokeWidth="6" strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - momentum.total / 100)} strokeLinecap="round" />
          </svg>
          <div className="flex-1 space-y-1.5">
            {(['realityPlan', 'execution', 'focus', 'recovery', 'ship'] as const).map(k => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-20 text-[9px] capitalize text-[#A6ADBD]">{k === 'realityPlan' ? 'Plan' : k}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#49D17D]" style={{ width: `${(momentum[k] / (k === 'execution' ? 30 : k === 'focus' ? 25 : k === 'recovery' ? 15 : k === 'ship' ? 10 : 20)) * 100}%` }} /></div>
                <span className="w-6 text-right text-[9px] text-[#A6ADBD]">{momentum[k]}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-center text-2xl font-black">{momentum.total}<span className="text-sm text-[#A6ADBD]">/100</span></p>
      </Panel>
    </div>

    {/* Capacity Guard */}
    <Panel title="Capacity Guard" subtitle={capLabel}>
      <div className="grid grid-cols-4 gap-2 text-center">
        <StatPill label="Planned" value={`${capacity.planned}m`} />
        <StatPill label="Safe" value={`${capacity.safeCapacity}m`} />
        <StatPill label="Buffer" value={`${capacity.buffer}m`} />
        <StatPill label="Remaining" value={`${Math.max(0, capacity.remaining)}m`} />
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all ${capacity.label === 'overloaded' ? 'bg-red-500' : capacity.label === 'tight' ? 'bg-yellow-500' : 'bg-[#49D17D]'}`} style={{ width: `${Math.min(100, (capacity.planned / Math.max(1, state.mission.availableMinutes)) * 100)}%` }} />
      </div>
      {defers.length > 0 && <div className="mt-3 space-y-1.5">{defers.map(d => <div key={d.task.id} className="flex items-center justify-between rounded-xl bg-yellow-500/10 px-3 py-2 text-xs"><span className="text-yellow-200">Move &quot;{d.task.title}&quot; to tomorrow and recover {d.minutesSaved}m</span><button onClick={() => updateTask(d.task.id, { status: 'inbox' })} className="rounded-lg bg-yellow-500/20 px-2 py-1 text-[10px] font-black text-yellow-100">Defer</button></div>)}</div>}
    </Panel>

    {/* Top 3 */}
    <Panel title="Top 3" subtitle="Your most important tasks for today." action={<button onClick={() => go('tasks')} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold">All tasks</button>}>
      <div className="space-y-2">
        {top3Tasks.length > 0 ? top3Tasks.map((t: Task, i: number) => (
          <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7C5CFF] text-xs font-black">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-bold ${t.status === 'done' ? 'line-through text-[#A6ADBD]' : ''}`}>{t.title}</p>
              <p className="text-[10px] text-[#A6ADBD]">{t.priority} · {t.estimateMinutes || 30}m{t.dueAt ? ` · due ${new Date(t.dueAt).toLocaleDateString()}` : ''}</p>
            </div>
            {t.status !== 'done' && <button onClick={() => startFocus(t.id)} className="rounded-xl bg-[#49D17D] px-3 py-2 text-xs font-black text-[#0B0D14]"><Play size={14} /></button>}
            <button onClick={() => updateTask(t.id, { status: t.status === 'done' ? 'today' : 'done' })} className={`rounded-xl px-3 py-2 text-xs font-black ${t.status === 'done' ? 'bg-[#49D17D] text-[#0B0D14]' : 'bg-white/10'}`}>{t.status === 'done' ? '✓' : <Circle size={14} />}</button>
          </div>
        )) : <Empty text="Select up to 3 tasks from your task list as today's Top 3." />}
      </div>
      {state.tasks.filter((t: Task) => !state.mission.top3.includes(t.id) && t.status !== 'done' && t.status !== 'archived').length > 0 && (
        <div className="mt-3"><p className="mb-1.5 text-[10px] font-bold uppercase text-[#39D0FF]">Add to Top 3</p>
          <div className="flex flex-wrap gap-1.5">{state.tasks.filter((t: Task) => !state.mission.top3.includes(t.id) && t.status !== 'done' && t.status !== 'archived').slice(0, 6).map((t: Task) => (
            <button key={t.id} onClick={() => toggleTop(t.id)} className="rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-bold hover:bg-white/10">{t.priority} · {t.title}</button>
          ))}</div>
        </div>
      )}
    </Panel>

    {/* Current blocker + Activity */}
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Current Blockers" subtitle="Nothing is blocking you right now.">
        {state.blockers.filter((b: Blocker) => b.status === 'open').length > 0 ? state.blockers.filter((b: Blocker) => b.status === 'open').map((b: Blocker) => (
          <div key={b.id} className="mb-2 flex items-center gap-3 rounded-2xl bg-white/[0.05] p-3">
            <AlertTriangle size={16} className={b.severity === 'high' ? 'text-red-400' : b.severity === 'med' ? 'text-yellow-400' : 'text-green-400'} />
            <div className="min-w-0 flex-1"><p className="text-sm font-bold">{b.title}</p><p className="text-[10px] text-[#A6ADBD]">{b.severity} · {b.category}</p></div>
          </div>
        )) : <p className="text-sm text-[#A6ADBD]">Nothing blocking you right now. ✨</p>}
      </Panel>

      <Panel title="Recent Activity">
        <div className="space-y-2">{recentEvents.length > 0 ? recentEvents.map((e: AppEvent) => (
          <div key={e.id} className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#7C5CFF]" />
            <div><p className="text-xs">{e.detail}</p><p className="text-[10px] text-[#A6ADBD]">{new Date(e.ts).toLocaleTimeString()}</p></div>
          </div>
        )) : <Empty text="Real events appear as you work." />}</div>
      </Panel>
    </div>
  </div>;
}

/* ── TASKS PAGE ───────────────────────────────────────────── */
function TasksPage({ state, addTask, updateTask, deleteTask, startFocus, setToast }: any) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('P1');
  const [tags, setTags] = useState('');
  const [estimate, setEstimate] = useState('30');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState<'list' | 'board'>('list');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const add = () => {
    if (!title.trim()) return;
    const parsed = parseQuickCapture(`${title.trim()} !${priority.toLowerCase()} ${tags ? '#' + tags.replace(/,\s*/g, ' #') : ''} ${estimate}m`);
    if (parsed) { addTask(createTaskFromParsed(parsed)); }
    setTitle(''); setNotes(''); setTags(''); setEstimate('30');
  };

  const filtered = state.tasks.filter((t: Task) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'all') return true;
    if (filter === 'overdue') return t.dueAt && t.dueAt < Date.now() && t.status !== 'done';
    if (filter === 'today') return t.status === 'today' || t.status === 'doing';
    if (filter === 'upcoming') return t.dueAt && t.dueAt > Date.now() && t.status !== 'done';
    if (filter === 'no-date') return !t.dueAt && t.status !== 'done';
    if (filter === 'done') return t.status === 'done';
    return t.status === filter || t.priority === filter;
  });

  const cols: TaskStatus[] = ['inbox', 'today', 'doing', 'done'];

  return <Panel title="Tasks" subtitle="Capture the next action, not the entire project." action={<div className="flex gap-1"><button onClick={() => setView('list')} className={`rounded-xl px-3 py-2 text-xs font-bold ${view === 'list' ? 'bg-[#7C5CFF]' : 'bg-white/5'}`}>List</button><button onClick={() => setView('board')} className={`rounded-xl px-3 py-2 text-xs font-bold ${view === 'board' ? 'bg-[#7C5CFF]' : 'bg-white/5'}`}>Board</button></div>}>
    {/* Quick add */}
    <div className="grid gap-2 rounded-3xl bg-white/[0.03] p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
      <I v={title} onChange={setTitle} placeholder="New task (or paste: Finish QA !p0 #mobile 30m)" />
      <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="min-h-11 rounded-2xl bg-white/5 px-3 text-sm"><option>P0</option><option>P1</option><option>P2</option></select>
      <I v={estimate} onChange={setEstimate} placeholder="30m" className="w-20" />
      <I v={tags} onChange={setTags} placeholder="#tags" className="w-28" />
      <button onClick={add} className="rounded-2xl bg-[#7C5CFF] px-5 font-black">Add</button>
    </div>

    {/* Filters */}
    <div className="my-3 flex gap-1.5 overflow-x-auto pb-1">
      {['all', 'today', 'upcoming', 'no-date', 'done', 'P0', 'P1', 'P2'].map(f => (
        <button key={f} onClick={() => setFilter(f)} className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black ${filter === f ? 'bg-[#39D0FF] text-[#0B0D14]' : 'bg-white/5 text-[#A6ADBD]'}`}>{f}</button>
      ))}
      <I v={search} onChange={setSearch} placeholder="Search…" className="ml-auto w-32 text-xs" />
    </div>

    {/* List view */}
    {view === 'list' && <div className="space-y-1.5">{filtered.map((t: Task) => (
      <div key={t.id} className="rounded-2xl bg-white/[0.04] p-3">
        <div className="flex items-center gap-3">
          <button onClick={() => updateTask(t.id, { status: t.status === 'done' ? 'inbox' : 'done' })} className={`shrink-0 rounded-full p-1 ${t.status === 'done' ? 'text-[#49D17D]' : 'text-[#A6ADBD]'}`}>{t.status === 'done' ? <CheckCircle2 size={18} /> : <Circle size={18} />}</button>
          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}>
            <p className={`text-sm font-bold ${t.status === 'done' ? 'line-through text-[#A6ADBD]' : ''}`}>{t.title}</p>
            <p className="text-[10px] text-[#A6ADBD]">{t.priority} · {t.estimateMinutes || 30}m{t.tags.length ? ' · ' + t.tags.map(x => '#' + x).join(' ') : ''}</p>
          </div>
          {t.status !== 'done' && <button onClick={() => startFocus(t.id)} className="rounded-xl bg-[#49D17D] px-2.5 py-1.5 text-xs font-black text-[#0B0D14]"><Play size={12} /></button>}
          <select value={t.status} onChange={e => updateTask(t.id, { status: e.target.value as TaskStatus })} className="rounded-xl bg-white/5 px-2 py-1.5 text-[10px]">
            {cols.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => deleteTask(t.id)} className="rounded-xl bg-red-500/10 p-1.5 text-red-300"><Trash2 size={14} /></button>
        </div>
        {expandedId === t.id && <div className="mt-2 space-y-2 pl-9">
          <TA v={t.notes} onChange={(v: string) => updateTask(t.id, { notes: v })} placeholder="Notes / acceptance criteria" rows={2} />
          <div className="flex gap-2"><I v={String(t.estimateMinutes || 30)} onChange={(v: string) => updateTask(t.id, { estimateMinutes: parseInt(v) || 30 })} type="number" className="w-20 text-xs" /><I v={t.tags.join(', ')} onChange={(v: string) => updateTask(t.id, { tags: safeTags(v) })} placeholder="tags" className="text-xs" /></div>
        </div>}
      </div>
    ))}{filtered.length === 0 && <Empty text="Capture the next action, not the entire project." />}</div>}

    {/* Board view */}
    {view === 'board' && <div className="grid gap-3 lg:grid-cols-4">{cols.map(col => (
      <div key={col} className="rounded-3xl border border-white/10 bg-black/20 p-3">
        <h3 className="sticky top-0 mb-2 rounded-2xl bg-[#11131D] p-2 text-xs font-black capitalize text-[#39D0FF]">{col}</h3>
        <div className="space-y-1.5">{filtered.filter((t: Task) => t.status === col).map((t: Task) => (
          <div key={t.id} className="rounded-xl bg-white/[0.06] p-2.5">
            <p className="text-xs font-bold">{t.title}</p>
            <p className="text-[9px] text-[#A6ADBD]">{t.priority} · {t.estimateMinutes || 30}m</p>
            <div className="mt-1.5 flex gap-1"><button onClick={() => updateTask(t.id, { status: cols[Math.min(cols.indexOf(col) + 1, 3)] })} className="rounded-lg bg-[#49D17D] px-2 py-1 text-[9px] font-black text-[#0B0D14]">→</button><button onClick={() => deleteTask(t.id)} className="rounded-lg bg-red-500/10 px-2 py-1 text-red-300"><Trash2 size={10} /></button></div>
          </div>
        ))}{filtered.filter((t: Task) => t.status === col).length === 0 && <p className="py-4 text-center text-[10px] text-[#A6ADBD]">Empty</p>}</div>
      </div>
    ))}</div>}
  </Panel>;
}

/* ── FOCUS PAGE ───────────────────────────────────────────── */
function FocusPage({ state, startFocus, pauseFocus, resumeFocus, completeFocus, captureDistraction, resolveBlocker, setState, addEvent, setToast, focusStartToken }: any) {
  const timer = state.activeTimer;
  const [blockerTitle, setBlockerTitle] = useState('');
  const [blockerCategory, setBlockerCategory] = useState<BlockerCategory>('other');
  const [blockerNextAction, setBlockerNextAction] = useState('');
  const [showRescue, setShowRescue] = useState(false);
  const [showDistraction, setShowDistraction] = useState(false);
  const [distractionText, setDistractionText] = useState('');

  const linkedTask = timer?.taskId ? state.tasks.find((t: Task) => t.id === timer.taskId) : null;
  const recentSessions = state.focusSessions.slice(-5).reverse();

  function handleRescue() {
    if (!blockerTitle.trim()) return;
    const blocker: Blocker = { id: uid(), title: blockerTitle.trim(), severity: 'med', category: blockerCategory, status: 'open', note: '', nextAction: blockerNextAction, taskId: timer?.taskId, createdAt: Date.now() };
    setState((s: AppState) => ({ ...s, blockers: [...s.blockers, blocker], activeTimer: s.activeTimer ? pauseTimer(s.activeTimer) : null }));
    addEvent('blocker_created', blockerTitle.trim());
    setShowRescue(false); setBlockerTitle(''); setBlockerNextAction('');
    setToast('Blocker captured — timer paused');
  }

  function handleCaptureDistraction() {
    if (!distractionText.trim()) return;
    setState((s: AppState) => ({ ...s, distractions: [...s.distractions, { id: uid(), text: distractionText.trim(), capturedAt: Date.now(), convertedToTask: false }] }));
    addEvent('distraction_captured', distractionText.trim());
    setShowDistraction(false); setDistractionText('');
    setToast('Captured — back to focus');
  }

  // Auto-start on focusStartToken change
  useEffect(() => { if (focusStartToken > 0 && !timer) startFocus(); }, [focusStartToken]);

  if (!timer) {
    const nextTask = state.tasks.find((t: Task) => t.status === 'today' || t.status === 'doing');
    return <Panel title="Focus Cockpit" subtitle="Choose one task and protect the next block of time.">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 p-6 text-center">
          <p className="text-xs font-black uppercase tracking-wider text-[#39D0FF]">Ready to focus</p>
          <div className="my-6 text-7xl font-black tracking-[-.08em]">25:00</div>
          <div className="grid grid-cols-3 gap-2">{[25, 50, 90].map(m => <button key={m} onClick={() => startFocus(undefined, m)} className="rounded-2xl bg-white/10 py-3 font-black hover:bg-white/20">{m}m</button>)}</div>
          {nextTask && <button onClick={() => startFocus(nextTask.id)} className="mt-4 w-full rounded-2xl bg-[#49D17D] py-4 font-black text-[#0B0D14]">Start focus on: {nextTask.title}</button>}
          <button onClick={() => startFocus()} className="mt-2 w-full rounded-2xl bg-white/10 py-3 font-black">Start unlinked focus</button>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-black">Recent sessions</h3>
          <div className="space-y-1.5">{recentSessions.length > 0 ? recentSessions.map((s: FocusSession) => {
            const task = s.taskId ? state.tasks.find((t: Task) => t.id === s.taskId) : null;
            return <div key={s.id} className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5"><span className={`h-2 w-2 rounded-full ${s.status === 'completed' ? 'bg-[#49D17D]' : 'bg-yellow-400'}`} /><div className="min-w-0 flex-1"><p className="text-xs font-bold">{task?.title || 'Unlinked'}</p><p className="text-[10px] text-[#A6ADBD]">{s.actualSeconds < 60 ? '<1m' : Math.round(s.actualSeconds / 60) + 'm'} · {new Date(s.startedAt).toLocaleTimeString()}</p></div></div>;
          }) : <Empty text="Your focus sessions will appear here." />}</div>
        </div>
      </div>
    </Panel>;
  }

  // Active timer
  const { minutes, seconds, progress } = getDisplayTime(timer);
  const circumference = 2 * Math.PI * 54;

  return <Panel title="Focus Cockpit" subtitle={linkedTask ? `Working on: ${linkedTask.title}` : 'Unlinked focus session'}>
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col items-center rounded-[2rem] border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 p-8">
        <p className="text-xs font-black uppercase tracking-wider text-[#39D0FF]">{timer.mode === 'recovery' ? 'Recovery Sprint' : 'Focused work sprint'}</p>
        <svg width="140" height="140" viewBox="0 0 120 120" className="my-4 -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <circle cx="60" cy="60" r="54" fill="none" stroke="#49D17D" strokeWidth="6" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} strokeLinecap="round" />
        </svg>
        <p className="text-6xl font-black tracking-[-.08em]">{formatTime(minutes, seconds)}</p>
        <div className="mt-6 grid w-full grid-cols-3 gap-2">
          {timer.status === 'running' ? <button onClick={pauseFocus} className="rounded-2xl bg-yellow-500 py-4 font-black text-[#0B0D14]"><Pause className="mx-auto" /></button> : <button onClick={resumeFocus} className="rounded-2xl bg-[#49D17D] py-4 font-black text-[#0B0D14]"><Play className="mx-auto" /></button>}
          <button onClick={() => completeFocus(true)} className="rounded-2xl bg-white/10 py-4 font-black text-xs">Finish early</button>
          <button onClick={() => { if (confirm('Reset timer?')) { setState((s: AppState) => ({ ...s, activeTimer: null })); document.title = 'Kenshi ShipOS'; } }} className="rounded-2xl bg-white/10 py-4"><RotateCcw className="mx-auto" /></button>
        </div>
      </div>

      <div className="space-y-4">
        {linkedTask && <div className="rounded-2xl bg-white/[0.05] p-4"><p className="text-[10px] font-bold uppercase text-[#39D0FF]">Linked task</p><p className="mt-1 text-sm font-bold">{linkedTask.title}</p>{linkedTask.notes && <p className="mt-1 text-xs text-[#A6ADBD]">{linkedTask.notes}</p>}</div>}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setShowRescue(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-red-500/15 py-3 text-sm font-black text-red-300"><AlertCircle size={16} /> I&apos;m blocked</button>
          <button onClick={() => setShowDistraction(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-yellow-500/15 py-3 text-sm font-black text-yellow-300"><StickyNote size={16} /> Capture distraction</button>
        </div>

        {/* Distraction inbox */}
        {state.distractions.length > 0 && <div><p className="mb-1 text-[10px] font-bold uppercase text-[#A6ADBD]">Distraction inbox</p>
          <div className="space-y-1">{state.distractions.slice(-3).reverse().map((d: Distraction) => (
            <div key={d.id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-xs">
              <StickyNote size={12} className="text-yellow-400" />
              <span className="flex-1">{d.text}</span>
              <button onClick={() => {
                const task = createTaskFromParsed({ title: d.text, priority: 'P1' as Priority, tags: ['distraction'], recurrence: { type: 'none' as const } });
                setState((s: AppState) => ({ ...s, tasks: [...s.tasks, task], distractions: s.distractions.map(x => x.id === d.id ? { ...x, convertedToTask: true, taskId: task.id } : x) }));
                setToast('Converted to task');
              }} className="rounded-lg bg-white/10 px-2 py-1 text-[9px]">To Task</button>
            </div>
          ))}</div>
        </div>}
      </div>
    </div>

    {/* Rescue sheet */}
    {showRescue && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowRescue(false)}>
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#11131D] p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black">Focus Rescue</h3>
        <p className="mt-1 text-sm text-[#A6ADBD]">What stopped you? Capture the blocker and smallest next action.</p>
        <div className="mt-4 space-y-3">
          <I v={blockerTitle} onChange={setBlockerTitle} placeholder="What stopped you?" />
          <select value={blockerCategory} onChange={e => setBlockerCategory(e.target.value as BlockerCategory)} className="min-h-11 w-full rounded-2xl bg-white/5 px-4 text-sm">
            <option value="unclear">Unclear next step</option><option value="missing_info">Missing information</option><option value="technical">Technical issue</option>
            <option value="waiting">Waiting on someone</option><option value="low_energy">Low energy</option><option value="interruption">Interruption</option><option value="other">Other</option>
          </select>
          <I v={blockerNextAction} onChange={setBlockerNextAction} placeholder="Smallest next action" />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleRescue} className="rounded-2xl bg-[#7C5CFF] py-3 font-black">Capture blocker</button>
            <button onClick={() => { startFocus(timer.taskId, 5); setShowRescue(false); setToast('5-minute recovery sprint'); }} className="rounded-2xl bg-[#49D17D] py-3 font-black text-[#0B0D14]">5m recovery sprint</button>
          </div>
          <button onClick={() => { completeFocus(true); setShowRescue(false); }} className="w-full rounded-2xl bg-white/5 py-2 text-sm text-[#A6ADBD]">End session honestly</button>
        </div>
      </div>
    </div>}

    {/* Distraction capture */}
    {showDistraction && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onClick={() => setShowDistraction(false)}>
      <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#11131D] p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-black">Capture distraction</h3>
        <p className="mt-1 text-xs text-[#A6ADBD]">Save it and return to focus immediately.</p>
        <div className="mt-4 space-y-3">
          <I v={distractionText} onChange={setDistractionText} placeholder="Remember to…" />
          <button onClick={handleCaptureDistraction} className="w-full rounded-2xl bg-[#49D17D] py-3 font-black text-[#0B0D14]">Save & return to focus</button>
        </div>
      </div>
    </div>}
  </Panel>;
}

/* ── REVIEW PAGE ──────────────────────────────────────────── */
function ReviewPage({ state, setState, reviewTab, setReviewTab, copyShipLog, setToast, addEvent }: any) {
  const tabs: { id: ReviewTab; label: string; icon: any }[] = [
    { id: 'ship-log', label: 'Ship Log', icon: Rocket },
    { id: 'blockers', label: 'Blockers', icon: AlertTriangle },
    { id: 'decisions', label: 'Decisions', icon: Lightbulb },
    { id: 'notes', label: 'Notes', icon: StickyNote },
  ];

  return <div className="space-y-4">
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {tabs.map(t => <button key={t.id} onClick={() => setReviewTab(t.id)} className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-xs font-black ${reviewTab === t.id ? 'bg-[#7C5CFF] text-white' : 'bg-white/5 text-[#A6ADBD]'}`}><t.icon size={14} />{t.label}</button>)}
    </div>
    {reviewTab === 'ship-log' && <ShipLogPanel state={state} copyShipLog={copyShipLog} setToast={setToast} addEvent={addEvent} />}
    {reviewTab === 'blockers' && <BlockersPanel state={state} setState={setState} addEvent={addEvent} />}
    {reviewTab === 'decisions' && <DecisionsPanel state={state} setState={setState} addEvent={addEvent} />}
    {reviewTab === 'notes' && <NotesPanel state={state} setState={setState} setToast={setToast} />}
  </div>;
}

function ShipLogPanel({ state, copyShipLog, setToast, addEvent }: any) {
  const [range, setRange] = useState<'today' | 'week'>('today');
  const [format, setFormat] = useState<ShipLog['format']>('markdown');
  const text = useMemo(() => generateShipLog(state, range, format), [state, range, format]);
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown' })); a.download = `ship-log-${range}-${today()}.md`; a.click(); };

  return <Panel title="Ship Log" subtitle="Your report will build itself as you work.">
    <div className="mb-3 flex flex-wrap gap-2">
      {(['today', 'week'] as const).map(r => <button key={r} onClick={() => setRange(r)} className={`rounded-2xl px-4 py-2 text-xs font-black ${range === r ? 'bg-[#7C5CFF]' : 'bg-white/5'}`}>{r === 'today' ? 'Today' : 'This Week'}</button>)}
      {(['markdown', 'daily', 'standup'] as const).map(f => <button key={f} onClick={() => setFormat(f)} className={`rounded-2xl px-3 py-2 text-xs font-black ${format === f ? 'bg-[#39D0FF] text-[#0B0D14]' : 'bg-white/5'}`}>{f}</button>)}
      <button onClick={copyShipLog} className="rounded-2xl bg-[#49D17D] px-4 py-2 text-xs font-black text-[#0B0D14]"><Copy size={14} className="mr-1 inline" />Copy</button>
      <button onClick={download} className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-black"><Download size={14} className="mr-1 inline" />.md</button>
    </div>
    <pre className="max-h-[60svh] overflow-auto whitespace-pre-wrap rounded-3xl bg-black/35 p-4 text-sm leading-6 text-[#DDE7FF]">{text}</pre>
  </Panel>;
}

function BlockersPanel({ state, setState, addEvent }: any) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<BlockerCategory>('other');
  const [severity, setSeverity] = useState<Severity>('med');
  const [nextAction, setNextAction] = useState('');
  const add = () => { if (!title.trim()) return; setState((s: AppState) => ({ ...s, blockers: [...s.blockers, { id: uid(), title: title.trim(), severity, category, status: 'open', note: '', nextAction, createdAt: Date.now() }] })); addEvent('blocker_created', title.trim()); setTitle(''); setNextAction(''); };
  const resolve = (id: string) => { setState((s: AppState) => ({ ...s, blockers: s.blockers.map(b => b.id === id ? { ...b, status: 'resolved', resolvedAt: Date.now(), resolveNote: 'Resolved' } : b) })); addEvent('blocker_resolved', 'Resolved'); };

  return <Panel title="Blockers" subtitle="Nothing is blocking you right now.">
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]"><I v={title} onChange={setTitle} placeholder="What is blocking the ship?" /><select value={severity} onChange={e => setSeverity(e.target.value as Severity)} className="min-h-11 rounded-2xl bg-white/5 px-3 text-sm"><option value="low">Low</option><option value="med">Med</option><option value="high">High</option></select><select value={category} onChange={e => setCategory(e.target.value as BlockerCategory)} className="min-h-11 rounded-2xl bg-white/5 px-3 text-sm"><option value="other">Other</option><option value="unclear">Unclear</option><option value="technical">Technical</option><option value="waiting">Waiting</option><option value="low_energy">Low energy</option></select><button onClick={add} className="rounded-2xl bg-[#7C5CFF] px-5 font-black">Add</button></div>
    <div className="mt-4 grid gap-2 md:grid-cols-2">
      {state.blockers.map((b: Blocker) => <article key={b.id} className="rounded-2xl bg-white/[0.04] p-4">
        <div className="flex justify-between gap-2"><b className="text-sm">{b.title}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${b.severity === 'high' ? 'bg-red-500/20 text-red-300' : b.severity === 'med' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-green-500/20 text-green-300'}`}>{b.severity}</span></div>
        <p className="mt-1 text-[10px] text-[#A6ADBD]">{b.category} · Age: {Math.max(0, Math.floor((Date.now() - b.createdAt) / 3600000))}h · {b.status}</p>
        {b.nextAction && <p className="mt-1 text-xs text-[#39D0FF]">Next: {b.nextAction}</p>}
        {b.status === 'open' ? <button onClick={() => resolve(b.id)} className="mt-2 rounded-xl bg-[#49D17D] px-3 py-1.5 text-xs font-black text-[#0B0D14]">Resolve</button> : <p className="mt-2 text-xs text-[#49D17D]">Resolved ✓ {b.resolveNote}</p>}
      </article>)}
      {state.blockers.length === 0 && <Empty text="Nothing is blocking you right now." />}
    </div>
  </Panel>;
}

function DecisionsPanel({ state, setState, addEvent }: any) {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [decision, setDecision] = useState('');
  const add = () => { if (!title.trim()) return; setState((s: AppState) => ({ ...s, decisions: [...s.decisions, { id: uid(), title, context, decision, expectedImpact: '', tags: [], date: Date.now() }] })); addEvent('decision_recorded', title); setTitle(''); setContext(''); setDecision(''); };

  return <Panel title="Decisions" subtitle="Searchable records: title, context, decision.">
    <div className="grid gap-2 sm:grid-cols-2"><I v={title} onChange={setTitle} placeholder="Decision title" /><I v={context} onChange={setContext} placeholder="Context" /><TA v={decision} onChange={setDecision} placeholder="Decision" rows={2} /><button onClick={add} className="rounded-2xl bg-[#7C5CFF] font-black">Log decision</button></div>
    <div className="mt-4 space-y-2">{state.decisions.slice().reverse().map((d: Decision) => <article key={d.id} className="rounded-2xl bg-white/[0.04] p-4"><b className="text-sm">{d.title}</b><p className="mt-1 text-xs text-[#A6ADBD]">{d.context}</p><p className="mt-1 text-sm text-[#39D0FF]">{d.decision}</p><p className="mt-1 text-[10px] text-[#A6ADBD]">{new Date(d.date).toLocaleString()}</p></article>)}{state.decisions.length === 0 && <Empty text="No decisions yet." />}</div>
  </Panel>;
}

function NotesPanel({ state, setState, setToast }: any) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const add = () => { if (!title.trim() || !body.trim()) return; setState((s: AppState) => ({ ...s, notes: [...s.notes, { id: uid(), title, body, type: 'note', tags: [], favorite: false, createdAt: Date.now(), updatedAt: Date.now() }] })); setTitle(''); setBody(''); };
  const filtered = state.notes.filter((n: Note) => (n.title + n.body + n.tags.join(' ')).toLowerCase().includes(search.toLowerCase())).sort((a: Note, b: Note) => Number(b.favorite) - Number(a.favorite));

  return <Panel title="Notes" subtitle="Reusable instructions, notes, prompts, and templates.">
    <div className="grid gap-2 sm:grid-cols-3"><I v={search} onChange={setSearch} placeholder="Search notes" /><I v={title} onChange={setTitle} placeholder="Title" /><button onClick={add} className="rounded-2xl bg-[#7C5CFF] font-black">Add</button></div>
    <div className="mt-2"><TA v={body} onChange={setBody} placeholder="Body" rows={2} /></div>
    <div className="mt-4 grid gap-2 md:grid-cols-2">{filtered.map((n: Note) => <article key={n.id} className="rounded-2xl bg-white/[0.04] p-4">
      <div className="flex justify-between gap-2"><b className="text-sm">{n.title}</b><button onClick={() => setState((s: AppState) => ({ ...s, notes: s.notes.map(x => x.id === n.id ? { ...x, favorite: !x.favorite } : x) }))} className="text-lg">{n.favorite ? '★' : '☆'}</button></div>
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-[#A6ADBD]">{n.body}</p>
      <button onClick={() => navigator.clipboard.writeText(n.body).then(() => setToast('Copied'))} className="mt-2 rounded-xl bg-[#49D17D] px-3 py-1.5 text-[10px] font-black text-[#0B0D14]"><Copy size={12} className="mr-1 inline" />Copy</button>
    </article>)}{filtered.length === 0 && <Empty text="No notes yet." />}</div>
  </Panel>;
}

/* ── INSIGHTS PAGE ────────────────────────────────────────── */
function InsightsPage({ state, momentum }: { state: AppState; momentum: MomentumBreakdown }) {
  const days = [6, 5, 4, 3, 2, 1, 0].map(d => {
    const x = new Date(); x.setDate(x.getDate() - d);
    const key = toLocalDateKey(x);
    const done = state.tasks.filter(t => t.completedAt && localDateKeyFromTs(t.completedAt) === key).length;
    const focus = state.focusSessions.filter(s => localDateKeyFromTs(s.endedAt || s.startedAt) === key && s.status === "completed").reduce((a, b) => a + Math.round(b.actualSeconds / 60), 0);
    return { key, done, focus, score: done * 20 + focus };
  });

  const todayKey = today();
  const focusToday = state.focusSessions.filter(s => localDateKeyFromTs(s.endedAt || s.startedAt) === todayKey && s.status === "completed").reduce((a, b) => a + Math.round(b.actualSeconds / 60), 0);
  const doneToday = state.tasks.filter(t => t.completedAt && localDateKeyFromTs(t.completedAt) === todayKey).length;
  const resolved = state.blockers.filter(b => b.status === 'resolved').length;
  const distractions = state.distractions.length;

  return <div className="space-y-4">
    <Panel title="Insights" subtitle="Real trends appear after a few sessions.">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><StatPill label="Momentum" value={momentum.total} /><StatPill label="Done today" value={doneToday} /><StatPill label="Focus today" value={`${focusToday}m`} /><StatPill label="Resolved" value={resolved} /></div>
      <div className="mt-6 rounded-3xl bg-white/[0.03] p-4"><p className="mb-3 text-xs font-black">Weekly activity</p>
        <div className="flex h-32 items-end gap-2">{days.map(d => <div key={d.key} className="flex flex-1 flex-col items-center gap-1"><div className="w-full rounded-t-xl bg-gradient-to-t from-[#7C5CFF] to-[#39D0FF]" style={{ height: `${Math.max(4, Math.min(100, d.score))}%` }} /><span className="text-[9px] text-[#A6ADBD]">{d.key.slice(5)}</span></div>)}</div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <StatPill label="Focus week" value={`${days.reduce((a, d) => a + d.focus, 0)}m`} />
        <StatPill label="Distractions" value={distractions} />
        <StatPill label="Blockers" value={state.blockers.length} />
        <StatPill label="Streak" value={(() => { let s = 0; for (let i = 0; i < 30; i++) { const d = new Date(); d.setDate(d.getDate() - i); const k = toLocalDateKey(d); if (state.tasks.some(t => t.completedAt && localDateKeyFromTs(t.completedAt) === k) || state.focusSessions.some(x => localDateKeyFromTs(x.endedAt || x.startedAt) === k)) s++; else if (i > 0) break; } return s; })()} />
      </div>
    </Panel>
  </div>;
}

/* ── SETTINGS PAGE ────────────────────────────────────────── */
function SettingsPage({ state, setState, setToast, sampleWorkspace, onLoadSample, onStartFresh, onReopenOnboarding }: any) {
  const updateSettings = (patch: Partial<AppState['settings']>) => setState((s: AppState) => ({ ...s, settings: { ...s.settings, ...patch } }));
  const exportJson = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.download = `shipos-export-${today()}.json`; a.click(); };
  const importJson = (file: File) => { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(String(r.result)); if (d.v === 5) { setState(d); setToast('Import complete'); } else if (d.v === 2 || d.v === 3) { setState(migrateV3toV5(d)); setToast('Migrated and imported'); } else setToast('Invalid export'); } catch { setToast('Invalid JSON'); } }; r.readAsText(file); };

  return <Panel title="Settings" subtitle="Own your workspace: themes, backup, and preferences." action={<div className="text-right text-[10px] text-[#A6ADBD]"><p>Build: {process.env.NEXT_PUBLIC_BUILD_SHA || 'local'}</p><p>{process.env.NEXT_PUBLIC_BUILD_TIME || ''}</p></div>}>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <button onClick={onReopenOnboarding} className="rounded-2xl bg-[#49D17D] px-4 py-4 font-black text-[#0B0D14]">Reopen onboarding</button>
      <button onClick={onLoadSample} className="rounded-2xl bg-[#39D0FF]/15 px-4 py-4 font-black text-[#39D0FF]">Explore sample workspace</button>
      {sampleWorkspace && <button onClick={() => confirm('Clear sample and start fresh?') && onStartFresh()} className="rounded-2xl bg-yellow-500/15 px-4 py-4 font-black text-yellow-200">Clear sample & start fresh</button>}
      <button onClick={exportJson} className="rounded-2xl bg-[#7C5CFF] px-4 py-4 font-black"><Download className="mr-2 inline" />Export JSON</button>
      <label className="flex cursor-pointer items-center justify-center rounded-2xl bg-white/10 px-4 py-4 font-black"><Upload className="mr-2" />Import JSON<input type="file" accept="application/json" className="hidden" onChange={e => e.target.files?.[0] && importJson(e.target.files[0])} /></label>
      <button onClick={() => confirm('Reset all ShipOS data?') && onStartFresh()} className="rounded-2xl bg-red-500/20 px-4 py-4 font-black text-red-300"><Trash2 className="mr-2 inline" />Reset all data</button>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div><label className="mb-1 block text-[10px] font-bold uppercase text-[#A6ADBD]">Theme</label>
        <div className="flex gap-1">{(['dark', 'light', 'system'] as const).map(t => <button key={t} onClick={() => updateSettings({ theme: t })} className={`flex-1 rounded-xl py-2 text-xs font-black capitalize ${state.settings.theme === t ? 'bg-[#7C5CFF]' : 'bg-white/5'}`}>{t}</button>)}</div>
      </div>
      <div><label className="mb-1 block text-[10px] font-bold uppercase text-[#A6ADBD]">Daily focus goal (minutes)</label><I v={String(state.settings.dailyFocusGoal)} onChange={(v: string) => updateSettings({ dailyFocusGoal: parseInt(v) || 120 })} type="number" /></div>
      <div><label className="mb-1 block text-[10px] font-bold uppercase text-[#A6ADBD]">Default focus preset</label>
        <div className="flex gap-1">{[25, 50, 90].map(m => <button key={m} onClick={() => updateSettings({ defaultFocusPreset: m })} className={`flex-1 rounded-xl py-2 text-xs font-black ${state.settings.defaultFocusPreset === m ? 'bg-[#7C5CFF]' : 'bg-white/5'}`}>{m}m</button>)}</div>
      </div>
    </div>
  </Panel>;
}

/* ── ONBOARDING ───────────────────────────────────────────── */
function Onboarding({ current, onFinish }: { current: AppState; onFinish: (next?: AppState, isSample?: boolean) => void }) {
  const [step, setStep] = useState(1);
  const [choice, setChoice] = useState<'fresh' | 'sample'>('fresh');
  const [intention, setIntention] = useState(current.mission.title || '');
  const [availableMin, setAvailableMin] = useState('120');

  const complete = () => {
    const base = choice === 'sample' ? demoState() : defaultState();
    onFinish({
      ...base,
      mission: {
        ...base.mission,
        title: intention || base.mission.title,
        availableMinutes: parseInt(availableMin) || 120,
      }
    }, choice === 'sample');
  };

  return <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#080A11]/98 px-4 py-6 text-white backdrop-blur-xl" role="dialog" aria-modal="true">
    <div className="mx-auto flex min-h-full max-w-2xl items-center">
      <section className="w-full rounded-[2rem] border border-white/10 bg-[#11131D] p-5 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-[.2em] text-[#39D0FF]">ShipOS setup · {step}/3</span>
          <div className="flex gap-1">{[1, 2, 3].map(i => <span key={i} className={`h-1.5 w-10 rounded-full ${i <= step ? 'bg-[#49D17D]' : 'bg-white/10'}`} />)}</div>
        </div>

        {step === 1 && <div>
          <h2 className="font-heading text-4xl font-black tracking-[-.05em] sm:text-5xl">Turn a realistic plan into shipped work.</h2>
          <p className="mt-4 text-lg leading-8 text-[#A6ADBD]">ShipOS helps you choose what fits today, focus without losing context, recover from blockers, and generate your progress update.</p>
          <button onClick={() => setStep(2)} className="mt-8 min-h-12 w-full rounded-2xl bg-[#49D17D] px-5 font-black text-[#0B0D14]">Plan my day</button>
        </div>}

        {step === 2 && <div>
          <h2 className="font-heading text-3xl font-black">Choose your starting point</h2>
          <div className="mt-5 grid gap-3">
            <button onClick={() => { setChoice('fresh'); setStep(3); }} className="min-h-16 rounded-2xl border border-[#49D17D]/40 bg-[#49D17D]/10 px-5 text-left"><b>Start fresh</b><p className="mt-1 text-sm text-[#A6ADBD]">A clean local-first workspace. No account required.</p></button>
            <button onClick={() => { setChoice('sample'); setStep(3); }} className="min-h-16 rounded-2xl border border-[#39D0FF]/30 bg-[#39D0FF]/10 px-5 text-left"><b>Explore sample workspace</b><p className="mt-1 text-sm text-[#A6ADBD]">See every feature with a coherent shipping day.</p></button>
            <button onClick={() => alert('Google cross-device sync is coming soon. Guest mode remains fully functional.')} className="min-h-16 rounded-2xl border border-white/10 bg-white/5 px-5 text-left"><b>Continue with Google</b><p className="mt-1 text-sm text-[#A6ADBD]">Coming soon — guest mode remains fully functional.</p></button>
          </div>
        </div>}

        {step === 3 && <div>
          <h2 className="font-heading text-3xl font-black">Quick setup</h2>
          <div className="mt-5 space-y-4">
            <div><label className="mb-1 block text-xs font-bold text-[#A6ADBD]">What must ship today?</label><I v={intention} onChange={setIntention} placeholder="Your mission for today" /></div>
            <div><label className="mb-1 block text-xs font-bold text-[#A6ADBD]">Available work minutes</label><I v={availableMin} onChange={setAvailableMin} type="number" placeholder="120" /></div>
            <button onClick={complete} className="min-h-12 w-full rounded-2xl bg-[#49D17D] px-5 font-black text-[#0B0D14]">{choice === 'sample' ? 'Load sample workspace' : 'Start working'}</button>
            <button onClick={() => { onFinish(); }} className="w-full text-center text-sm text-[#A6ADBD] hover:text-white">Skip setup</button>
          </div>
        </div>}
      </section>
    </div>
  </div>;
}

/* ── COMMAND PALETTE ──────────────────────────────────────── */
function CommandPalette({ onClose, go, addTask, startFocus, addBlocker, captureDistraction, copyLog }: { onClose: () => void; go: (t: Tab) => void; addTask: () => void; startFocus: () => void; addBlocker: () => void; captureDistraction: () => void; copyLog: () => void }) {
  const [query, setQuery] = useState('');
  const commands = [
    ...navItems.map(n => ({ label: `Go to ${n.label}`, detail: n.shortcut || '', run: () => go(n.id) })),
    { label: 'Create task', detail: 'N', run: addTask },
    { label: 'Start focus sprint', detail: 'F', run: startFocus },
    { label: 'Add blocker', detail: 'B', run: addBlocker },
    { label: 'Capture distraction', detail: 'D', run: captureDistraction },
    { label: 'Copy Ship Log', detail: 'L', run: copyLog },
    { label: 'Close day', detail: '', run: () => { go('review'); } },
    { label: 'Toggle theme', detail: '', run: () => {} },
  ].filter(c => (c.label + c.detail).toLowerCase().includes(query.toLowerCase()));

  useEffect(() => { const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, [onClose]);

  return <div className="fixed inset-0 z-[85] bg-black/70 px-4 pt-[10vh] backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Command palette">
    <section className="mx-auto max-w-xl overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#11131D] shadow-2xl" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-3 border-b border-white/10 p-4"><Search size={18} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search commands…" className="min-h-11 flex-1 bg-transparent text-base outline-none" /><button onClick={onClose} className="rounded-xl bg-white/10 p-2"><X size={18} /></button></div>
      <div className="max-h-[60vh] overflow-y-auto p-2">{commands.map(c => <button key={c.label} onClick={c.run} className="flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left font-bold hover:bg-white/10 focus:bg-white/10"><span>{c.label}</span>{!!c.detail && <span className="text-xs text-[#A6ADBD]">{c.detail}</span>}</button>)}{!commands.length && <Empty text="No matching command." />}</div>
    </section>
  </div>;
}
