'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, BarChart3, BookOpen, Check, ChevronRight, Clock, Copy, Download, FileText, Flag, MoreHorizontal, Pause, Play, Plus, RefreshCw, Rocket, Search, Settings, Target, Timer, Trash2, Upload, X } from 'lucide-react';

type Tab = 'mission' | 'tasks' | 'focus' | 'blockers' | 'prompts' | 'decisions' | 'log' | 'stats' | 'settings';
type TaskStatus = 'backlog' | 'today' | 'doing' | 'done';
type Priority = 'P0' | 'P1' | 'P2';
type Severity = 'low' | 'med' | 'high';

type Task = { id: string; title: string; notes: string; status: TaskStatus; priority: Priority; tags: string[]; createdAt: number; doneAt?: number };
type FocusSession = { id: string; taskId?: string; minutes: number; ts: number };
type Blocker = { id: string; title: string; severity: Severity; status: 'open' | 'resolved'; note: string; createdAt: number; resolvedAt?: number; resolveNote?: string };
type Prompt = { id: string; title: string; body: string; tags: string[]; favorite: boolean };
type Decision = { id: string; title: string; context: string; decision: string; date: number };
type AppState = {
  v: 3;
  mission: { date: string; title: string; intention: string; why: string; top3: string[] };
  tasks: Task[];
  sessions: FocusSession[];
  blockers: Blocker[];
  prompts: Prompt[];
  decisions: Decision[];
};

const KEY = 'kenshi-shipos:v3';
const PREVIOUS_KEY = 'kenshi-shipos:v2';
const oldKeys = ['shipos-mission','shipos-tasks','shipos-blockers','shipos-prompts','shipos-decisions','shipos-focus-minutes','shipos-sprint-count'];
const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: 'mission', label: 'Mission', icon: Target },
  { id: 'tasks', label: 'Tasks', icon: FileText },
  { id: 'focus', label: 'Focus', icon: Timer },
  { id: 'blockers', label: 'Blockers', icon: AlertTriangle },
  { id: 'prompts', label: 'Prompts', icon: BookOpen },
  { id: 'decisions', label: 'Decisions', icon: Flag },
  { id: 'log', label: 'Ship Log', icon: Rocket },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const moreTabs = tabs.filter(t => !['mission','tasks','focus'].includes(t.id));

const routeMap: Record<Tab, string> = { mission: '/mission', tasks: '/tasks', focus: '/focus', blockers: '/blockers', prompts: '/vault', decisions: '/decisions', log: '/ship-log', stats: '/stats', settings: '/settings' };
const pathMap: Record<string, Tab> = { '/mission': 'mission', '/tasks': 'tasks', '/focus': 'focus', '/blockers': 'blockers', '/vault': 'prompts', '/decisions': 'decisions', '/ship-log': 'log', '/stats': 'stats', '/settings': 'settings' };
const hashAlias: Record<string, string> = { mission: '/mission', tasks: '/tasks', focus: '/focus', blockers: '/blockers', prompts: '/vault', decisions: '/decisions', log: '/ship-log', stats: '/stats', settings: '/settings' };
const routeFor = (tab: Tab) => routeMap[tab];
const pathToTab = (path: string): Tab => pathMap[path] || 'mission';
const hashToPath = (hash: string) => hashAlias[hash] || '';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);
const safeTags = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean).slice(0, 6);

function defaultState(): AppState {
  return {
    v: 3,
    mission: { date: today(), title: '', intention: 'Ship one useful thing', why: '', top3: [] },
    tasks: [],
    sessions: [],
    blockers: [],
    prompts: starterPrompts(),
    decisions: [],
  };
}

function starterPrompts(): Prompt[] {
  return [
    { id: 'p1', title: 'Responsive QA Prompt', body: 'Test 320/360/390/430/768/1024/1280/1440/1920 widths. Fix overlap, horizontal overflow, clipped modals, and tap-target issues. Return changed files + verification output.', tags: ['qa','mobile'], favorite: true },
    { id: 'p2', title: 'Root Cause Debug Prompt', body: 'Observe the failure, isolate subsystem, trace the path, make the smallest fix, run build/tests, then explain the exact blocker and verification.', tags: ['debug'], favorite: false },
    { id: 'p3', title: 'Deploy Guard Prompt', body: 'Run build, verify env requirements, deploy prebuilt if remote npm fails, confirm live URL HTTP 200 and title. Never claim done without output.', tags: ['deploy'], favorite: false },
  ];
}

function demoState(): AppState {
  const now = Date.now();
  const t1 = { id: 't1', title: 'Audit mobile hero', notes: 'Check first screen clarity and CTA visibility.', status: 'done' as TaskStatus, priority: 'P0' as Priority, tags: ['mobile','qa'], createdAt: now - 3600000, doneAt: now - 1800000 };
  const t2 = { id: 't2', title: 'Fix package card spacing', notes: 'Make package cards readable at 390px.', status: 'doing' as TaskStatus, priority: 'P0' as Priority, tags: ['ui'], createdAt: now - 2600000 };
  const t3 = { id: 't3', title: 'Export ship log', notes: 'Create final update for Telegram/GitHub.', status: 'today' as TaskStatus, priority: 'P1' as Priority, tags: ['report'], createdAt: now - 1600000 };
  return {
    v: 3,
    mission: { date: today(), title: 'Polish QuestPay mobile checkout', intention: 'Make it contest-valid', why: 'Judges must understand and test it on phone.', top3: [t1.id, t2.id, t3.id] },
    tasks: [t1,t2,t3],
    sessions: [{ id: 's1', taskId: t1.id, minutes: 25, ts: now - 1200000 }],
    blockers: [{ id: 'b1', title: 'Browser wallet popup needs manual testing', severity: 'med', status: 'open', note: 'Owner should test on real phone wallet.', createdAt: now - 900000 }],
    prompts: starterPrompts(),
    decisions: [{ id: 'd1', title: 'Keep demo mode separate', context: 'Real payment must be default for contest.', decision: 'Base Sepolia flow remains opt-in testnet demo.', date: now - 800000 }],
  };
}

function migrate(): AppState {
  if (typeof window === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(PREVIOUS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.v === 2 || parsed?.v === 3) return { ...defaultState(), ...parsed, v: 3 };
    }
    const v1Tasks = JSON.parse(localStorage.getItem('shipos-tasks') || '[]');
    const v1Mission = JSON.parse(localStorage.getItem('shipos-mission') || 'null');
    const v1Blockers = JSON.parse(localStorage.getItem('shipos-blockers') || '[]');
    const v1Prompts = JSON.parse(localStorage.getItem('shipos-prompts') || '[]');
    const v1Decisions = JSON.parse(localStorage.getItem('shipos-decisions') || '[]');
    const focusMinutes = Number(localStorage.getItem('shipos-focus-minutes') || '0');
    if (v1Mission || v1Tasks.length || v1Blockers.length || v1Prompts.length || v1Decisions.length || focusMinutes) {
      return {
        v: 3,
        mission: { date: today(), title: v1Mission?.title || '', intention: v1Mission?.intention || 'Build', why: v1Mission?.whyItMatters || '', top3: [] },
        tasks: v1Tasks.map((t: any) => ({ id: String(t.id || uid()), title: t.title || 'Untitled task', notes: t.desc || '', status: t.status === 'now' ? 'doing' : (t.status || 'backlog'), priority: t.priority === 'critical' || t.priority === 'high' ? 'P0' : t.priority === 'medium' ? 'P1' : 'P2', tags: [t.mode].filter(Boolean), createdAt: t.created || Date.now(), doneAt: t.completed })),
        sessions: focusMinutes ? [{ id: uid(), minutes: focusMinutes, ts: Date.now() }] : [],
        blockers: v1Blockers.map((b: any) => ({ id: String(b.id || uid()), title: b.what || b.title || 'Blocker', severity: b.severity === 'medium' ? 'med' : (b.severity || 'low'), status: b.status || 'open', note: b.nextAction || '', createdAt: b.created || Date.now(), resolvedAt: b.resolved })),
        prompts: v1Prompts.length ? v1Prompts.map((p: any) => ({ id: String(p.id || uid()), title: p.title || 'Prompt', body: p.body || '', tags: safeTags(p.tags || p.category || ''), favorite: !!p.favorite })) : starterPrompts(),
        decisions: v1Decisions.map((d: any) => ({ id: String(d.id || uid()), title: d.decision || 'Decision', context: d.reason || '', decision: d.impact || d.decision || '', date: d.time || Date.now() })),
      };
    }
  } catch {}
  return defaultState();
}

export default function ShipOSApp() {
  const [state, setState] = useState<AppState>(defaultState());
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(() => pathToTab(typeof window === 'undefined' ? '/mission' : window.location.pathname));
  const [moreOpen, setMoreOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setState(migrate());
    const hash = window.location.hash.replace('#','');
    const alias = hashToPath(hash);
    if (alias) router.replace(alias);
    else setTab(pathToTab(window.location.pathname));
    setReady(true);
  }, [router]);
  useEffect(() => { setTab(pathToTab(pathname)); }, [pathname]);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { setToast('Storage quota issue. Export backup before adding more data.'); } }, [state, ready]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 2200); return () => clearTimeout(id); }, [toast]);

  const setPatch = (patch: Partial<AppState>) => setState(prev => ({ ...prev, ...patch }));
  const stats = useMemo(() => computeStats(state), [state]);
  const openBlockers = state.blockers.filter(b => b.status === 'open').length;
  const Current = {
    mission: <MissionPanel state={state} setState={setState} stats={stats} />,
    tasks: <TaskBoard state={state} setState={setState} />,
    focus: <FocusCockpit state={state} setState={setState} />,
    blockers: <BlockerRadar state={state} setState={setState} />,
    prompts: <PromptVault state={state} setState={setState} setToast={setToast} />,
    decisions: <DecisionLog state={state} setState={setState} />,
    log: <ShipLog state={state} setToast={setToast} />,
    stats: <StatsPanel state={state} stats={stats} />,
    settings: <SettingsPanel state={state} setState={setState} setToast={setToast} />,
  }[tab];

  const go = (next: Tab) => { setMoreOpen(false); router.push(routeFor(next)); };

  return (
    <main className="min-h-screen bg-[#0B0D14] pb-24 text-white md:pb-0">
      <header className="border-b border-white/10 bg-[#0B0D14]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <img src="/brand/verse/verse-mark.svg" alt="VERSE logo" className="h-11 w-11 shrink-0 rounded-2xl" />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#39D0FF]">Built for VERSE community</p>
                <h1 className="truncate font-heading text-2xl font-black tracking-[-0.04em] sm:text-4xl">Kenshi ShipOS</h1>
              </div>
            </div>
            <button onClick={() => setState(demoState())} className="hidden rounded-2xl bg-[#49D17D] px-4 py-3 text-sm font-black text-[#0B0D14] sm:inline-flex">Load demo data</button>
          </div>
          <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
              <p className="max-w-3xl text-base leading-7 text-[#DDE7FF] sm:text-lg">A one-day productivity cockpit for people building with AI agents: mission, task pipeline, focus sessions, blockers, prompts, decisions, stats, and a copyable ship log.</p>
              <p className="mt-2 text-sm text-[#A6ADBD]">No login. No backend. Versioned localStorage v3 with export/import backup.</p>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <StatPill label="Done" value={stats.doneToday} />
              <StatPill label="Focus" value={`${stats.focusToday}m`} />
              <StatPill label="Blockers" value={openBlockers} />
              <StatPill label="Score" value={stats.score} />
            </div>
          </section>
          <nav className="hidden gap-2 overflow-x-auto md:flex" aria-label="ShipOS sections">
            {tabs.map(t => <TabButton key={t.id} tab={t} active={tab === t.id} badge={t.id === 'blockers' ? openBlockers : 0} onClick={() => go(t.id)} />)}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        {Current}
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#101321]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl md:hidden" aria-label="Mobile ShipOS nav">
        <div className="grid grid-cols-4 gap-2">
          <MobileNav label="Mission" icon={Target} active={tab === 'mission'} onClick={() => go('mission')} />
          <MobileNav label="Tasks" icon={FileText} active={tab === 'tasks'} onClick={() => go('tasks')} />
          <MobileNav label="Focus" icon={Timer} active={tab === 'focus'} onClick={() => go('focus')} />
          <MobileNav label="More" icon={MoreHorizontal} active={!['mission','tasks','focus'].includes(tab)} badge={openBlockers} onClick={() => setMoreOpen(true)} />
        </div>
      </nav>

      {moreOpen && <div className="fixed inset-0 z-[60] bg-black/60 md:hidden" onClick={() => setMoreOpen(false)}><div className="absolute inset-x-0 bottom-0 rounded-t-[2rem] border border-white/10 bg-[#101321] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]" onClick={e => e.stopPropagation()}><div className="mb-3 flex items-center justify-between"><b>More tools</b><button onClick={() => setMoreOpen(false)} className="rounded-full bg-white/10 p-2"><X size={18}/></button></div><div className="grid gap-2">{moreTabs.map(t => <button key={t.id} onClick={() => go(t.id)} className="flex min-h-12 items-center justify-between rounded-2xl bg-white/5 px-4 text-left font-bold"><span className="flex items-center gap-3"><t.icon size={18}/>{t.label}</span>{t.id === 'blockers' && openBlockers > 0 && <span className="rounded-full bg-red-500 px-2 text-xs">{openBlockers}</span>}</button>)}</div></div></div>}
      {toast && <div className="fixed left-1/2 top-4 z-[80] -translate-x-1/2 rounded-2xl bg-[#49D17D] px-4 py-3 text-sm font-black text-[#0B0D14] shadow-2xl">{toast}</div>}
    </main>
  );
}

function StatPill({ label, value }: { label: string; value: any }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3"><p className="text-[10px] font-bold uppercase text-[#A6ADBD]">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>; }
function TabButton({ tab, active, onClick, badge }: { tab: {id: Tab; label: string; icon: any}; active: boolean; onClick: () => void; badge?: number }) { return <button onClick={onClick} className={`relative flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-black transition ${active ? 'bg-[#7C5CFF] text-white' : 'bg-white/5 text-[#A6ADBD] hover:bg-white/10 hover:text-white'}`}><tab.icon size={16}/>{tab.label}{!!badge && <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">{badge}</span>}</button>; }
function MobileNav({ label, icon: Icon, active, onClick, badge }: { label: string; icon: any; active: boolean; onClick: () => void; badge?: number }) { return <button onClick={onClick} className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black ${active ? 'bg-[#7C5CFF] text-white' : 'text-[#A6ADBD]'}`}><Icon size={18}/>{label}{!!badge && <span className="absolute right-4 top-2 rounded-full bg-red-500 px-1.5 text-[10px] text-white">{badge}</span>}</button>; }
function Panel({ title, subtitle, children, action }: { title: string; subtitle?: string; children: any; action?: any }) { return <section className="rounded-[1.5rem] border border-white/10 bg-[#11131D]/85 p-4 shadow-2xl sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="font-heading text-2xl font-black tracking-[-0.04em]">{title}</h2>{subtitle && <p className="mt-1 text-sm leading-6 text-[#A6ADBD]">{subtitle}</p>}</div>{action}</div>{children}</section>; }
function TextInput(props: any) { return <input {...props} className={`min-h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-base outline-none focus:border-[#39D0FF] ${props.className||''}`} />; }
function TextArea(props: any) { return <textarea {...props} className={`w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none focus:border-[#39D0FF] ${props.className||''}`} />; }

function MissionPanel({ state, setState, stats }: { state: AppState; setState: any; stats: any }) {
  const updateMission = (m: Partial<AppState['mission']>) => setState((s: AppState) => ({ ...s, mission: { ...s.mission, ...m } }));
  const toggleTop = (id: string) => updateMission({ top3: state.mission.top3.includes(id) ? state.mission.top3.filter(x => x !== id) : [...state.mission.top3, id].slice(0,3) });
  return <Panel title="Mission Control" subtitle="Set one outcome for today, pick Top-3 priorities, and track daily stats." action={<button onClick={() => setState(demoState())} className="rounded-2xl bg-[#49D17D] px-4 py-3 text-sm font-black text-[#0B0D14]">Load demo data</button>}>
    <div className="grid gap-4 lg:grid-cols-[1fr_.9fr]">
      <div className="space-y-3"><TextInput value={state.mission.title} onChange={(e:any)=>updateMission({title:e.target.value})} placeholder="Today's mission"/><TextInput value={state.mission.intention} onChange={(e:any)=>updateMission({intention:e.target.value})} placeholder="Daily intention"/><TextArea rows={3} value={state.mission.why} onChange={(e:any)=>updateMission({why:e.target.value})} placeholder="Why does this matter?"/></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2"><StatPill label="Date" value={state.mission.date}/><StatPill label="Done today" value={stats.doneToday}/><StatPill label="Focus today" value={`${stats.focusToday}m`}/><StatPill label="Streak" value={stats.streak}/></div>
    </div>
    <div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-wider text-[#39D0FF]">Pick Top-3 priorities</p><div className="grid gap-2 sm:grid-cols-3">{state.tasks.length ? state.tasks.filter(t=>t.status!=='done').map(t => <button key={t.id} onClick={()=>toggleTop(t.id)} className={`min-h-12 rounded-2xl border px-4 text-left text-sm font-bold ${state.mission.top3.includes(t.id)?'border-[#49D17D] bg-[#49D17D]/15 text-[#49D17D]':'border-white/10 bg-white/5'}`}>{t.priority} · {t.title}</button>) : <Empty text="No tasks yet. Add tasks in Task Board or load demo data."/>}</div></div>
  </Panel>;
}

function TaskBoard({ state, setState }: { state: AppState; setState: any }) {
  const [title,setTitle]=useState(''); const [notes,setNotes]=useState(''); const [priority,setPriority]=useState<Priority>('P1'); const [tags,setTags]=useState(''); const [filter,setFilter]=useState('all');
  const add = () => { if(!title.trim()) return; setState((s:AppState)=>({...s,tasks:[...s.tasks,{id:uid(),title:title.trim(),notes,status:'backlog',priority,tags:safeTags(tags),createdAt:Date.now()}]})); setTitle(''); setNotes(''); setTags(''); };
  const update = (id:string, patch:Partial<Task>) => setState((s:AppState)=>({...s,tasks:s.tasks.map(t=>t.id===id?{...t,...patch,...(patch.status==='done'&&!t.doneAt?{doneAt:Date.now()}: {})}:t)}));
  const del = (id:string) => setState((s:AppState)=>({...s,tasks:s.tasks.filter(t=>t.id!==id), mission:{...s.mission, top3:s.mission.top3.filter(x=>x!==id)}}));
  const visible=state.tasks.filter(t=>filter==='all'||t.status===filter||t.priority===filter);
  const cols:TaskStatus[]=['backlog','today','doing','done'];
  return <Panel title="Task Board" subtitle="CRUD pipeline: Backlog → Today → Doing → Done. Tap-to-advance works on mobile; no drag dependency.">
    <div className="grid gap-3 rounded-3xl bg-white/[0.03] p-3 sm:grid-cols-[1fr_1fr_auto_auto]"><TextInput value={title} onChange={(e:any)=>setTitle(e.target.value)} placeholder="New task title"/><TextInput value={tags} onChange={(e:any)=>setTags(e.target.value)} placeholder="tags: mobile, deploy"/><select value={priority} onChange={e=>setPriority(e.target.value as Priority)} className="min-h-11 rounded-2xl bg-white/5 px-4 text-base"><option>P0</option><option>P1</option><option>P2</option></select><button onClick={add} className="rounded-2xl bg-[#7C5CFF] px-5 font-black">Add</button><TextArea rows={2} value={notes} onChange={(e:any)=>setNotes(e.target.value)} placeholder="Notes / acceptance criteria" className="sm:col-span-4"/></div>
    <div className="my-4 flex gap-2 overflow-x-auto pb-1">{['all','P0','P1','P2',...cols].map(f=><button key={f} onClick={()=>setFilter(f)} className={`min-h-11 shrink-0 rounded-2xl px-4 text-sm font-black ${filter===f?'bg-[#39D0FF] text-[#0B0D14]':'bg-white/5 text-[#A6ADBD]'}`}>{f}</button>)}</div>
    <div className="grid gap-3 lg:grid-cols-4">{cols.map(col=><div key={col} className="rounded-3xl border border-white/10 bg-black/20 p-3"><h3 className="sticky top-0 mb-3 rounded-2xl bg-[#11131D] p-3 text-sm font-black capitalize text-[#39D0FF]">{col}</h3><div className="space-y-2">{visible.filter(t=>t.status===col).map(t=><TaskCard key={t.id} task={t} update={update} del={del}/>) || null}{visible.filter(t=>t.status===col).length===0&&<p className="py-6 text-center text-xs text-[#A6ADBD]">Empty</p>}</div></div>)}</div>
  </Panel>;
}
function TaskCard({task,update,del}:{task:Task;update:any;del:any}){ const order:TaskStatus[]=['backlog','today','doing','done']; const next=order[Math.min(order.indexOf(task.status)+1,3)]; return <article className="rounded-2xl bg-white/[0.06] p-3"><div className="flex items-start justify-between gap-2"><b className="text-sm">{task.title}</b><span className="rounded-full bg-[#7C5CFF]/20 px-2 py-1 text-[10px] font-black text-[#BFB2FF]">{task.priority}</span></div>{task.notes&&<p className="mt-2 text-xs leading-5 text-[#A6ADBD]">{task.notes}</p>}<div className="mt-2 flex flex-wrap gap-1">{task.tags.map(x=><span key={x} className="rounded-full bg-white/10 px-2 py-1 text-[10px]">#{x}</span>)}</div><div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><button onClick={()=>update(task.id,{status:next})} className="rounded-xl bg-[#49D17D] px-3 py-2 text-xs font-black text-[#0B0D14]">{task.status==='done'?'Done ✓':`Move to ${next}`}</button><button onClick={()=>del(task.id)} className="rounded-xl bg-red-500/15 px-3 py-2 text-red-300"><Trash2 size={14}/></button></div></article> }

function FocusCockpit({state,setState}:{state:AppState;setState:any}){ const [seconds,setSeconds]=useState(25*60); const [running,setRunning]=useState(false); const [preset,setPreset]=useState(25); const [taskId,setTaskId]=useState(''); useEffect(()=>{ if(!running) return; document.title=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} — ShipOS`; const id=setInterval(()=>setSeconds(s=>{ if(s<=1){ setRunning(false); const minutes=preset; setState((st:AppState)=>({...st,sessions:[...st.sessions,{id:uid(),taskId:taskId||undefined,minutes,ts:Date.now()}]})); navigator.vibrate?.(180); document.title='Kenshi ShipOS'; return preset*60;} return s-1;}),1000); return()=>clearInterval(id);},[running,seconds,preset,taskId,setState]); const m=Math.floor(seconds/60), sec=String(seconds%60).padStart(2,'0'); return <Panel title="Focus Cockpit" subtitle="Presets, linked tasks, live countdown, vibration/audio-friendly completion, and session logging."><div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]"><div className="rounded-[2rem] border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 p-6 text-center"><p className="text-xs font-black uppercase tracking-wider text-[#39D0FF]">Focused work sprint</p><div className="my-5 text-7xl font-black tracking-[-.08em]">{m}:{sec}</div><div className="grid grid-cols-3 gap-2">{[25,50,10].map(x=><button key={x} onClick={()=>{setPreset(x);setSeconds(x*60)}} className="rounded-2xl bg-white/10 px-3 py-3 font-black">{x}m</button>)}</div><div className="mt-3 grid grid-cols-3 gap-2"><button onClick={()=>setRunning(true)} className="rounded-2xl bg-[#49D17D] py-4 font-black text-[#0B0D14]"><Play className="mx-auto"/></button><button onClick={()=>setRunning(false)} className="rounded-2xl bg-white/10 py-4"><Pause className="mx-auto"/></button><button onClick={()=>{setRunning(false);setSeconds(preset*60)}} className="rounded-2xl bg-white/10 py-4"><RefreshCw className="mx-auto"/></button></div></div><div><select value={taskId} onChange={e=>setTaskId(e.target.value)} className="mb-4 min-h-11 w-full rounded-2xl bg-white/5 px-4 text-base"><option value="">No linked task</option>{state.tasks.filter(t=>t.status!=='done').map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><div className="space-y-2">{state.sessions.slice().reverse().map(s=><div key={s.id} className="rounded-2xl bg-white/5 p-3 text-sm"><b>{s.minutes} minutes</b><p className="text-xs text-[#A6ADBD]">{new Date(s.ts).toLocaleString()} {s.taskId&&`· ${state.tasks.find(t=>t.id===s.taskId)?.title||'Task'}`}</p></div>)}{!state.sessions.length&&<Empty text="No focus sessions yet. Start a sprint."/>}</div></div></div></Panel> }

function BlockerRadar({state,setState}:{state:AppState;setState:any}){ const [title,setTitle]=useState(''); const [severity,setSeverity]=useState<Severity>('med'); const add=()=>{ if(!title.trim())return; setState((s:AppState)=>({...s,blockers:[...s.blockers,{id:uid(),title:title.trim(),severity,status:'open',note:'',createdAt:Date.now()}]})); setTitle('')}; const patchB=(id:string,patch:Partial<Blocker>)=>setState((s:AppState)=>({...s,blockers:s.blockers.map(b=>b.id===id?{...b,...patch}:b)})); return <Panel title="Blocker Radar" subtitle="CRUD blockers, severity, ageing, resolve notes, and nav badge count."><div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"><TextInput value={title} onChange={(e:any)=>setTitle(e.target.value)} placeholder="What is blocking the ship?"/><select value={severity} onChange={e=>setSeverity(e.target.value as Severity)} className="min-h-11 rounded-2xl bg-white/5 px-4"><option value="low">Low</option><option value="med">Med</option><option value="high">High</option></select><button onClick={add} className="rounded-2xl bg-[#7C5CFF] px-5 font-black">Add</button></div><div className="mt-4 grid gap-3 md:grid-cols-2">{state.blockers.map(b=><article key={b.id} className="rounded-2xl bg-white/5 p-4"><div className="flex justify-between gap-2"><b>{b.title}</b><span className={`rounded-full px-2 py-1 text-xs font-black ${b.severity==='high'?'bg-red-500/20 text-red-300':b.severity==='med'?'bg-yellow-500/20 text-yellow-300':'bg-green-500/20 text-green-300'}`}>{b.severity}</span></div><p className="mt-1 text-xs text-[#A6ADBD]">Age: {Math.max(0,Math.floor((Date.now()-b.createdAt)/3600000))}h · {b.status}</p>{b.status==='open'?<button onClick={()=>patchB(b.id,{status:'resolved',resolvedAt:Date.now(),resolveNote:'Resolved from ShipOS'})} className="mt-3 rounded-xl bg-[#49D17D] px-4 py-2 text-sm font-black text-[#0B0D14]">Resolve</button>:<p className="mt-2 text-sm text-[#49D17D]">Resolved ✓ {b.resolveNote}</p>}</article>)}{!state.blockers.length&&<Empty text="No blockers. Clean runway."/>}</div></Panel> }
function PromptVault({state,setState,setToast}:{state:AppState;setState:any;setToast:any}){ const [q,setQ]=useState(''); const [title,setTitle]=useState(''); const [body,setBody]=useState(''); const [tags,setTags]=useState(''); const list=state.prompts.filter(p=>(p.title+p.body+p.tags.join(' ')).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>Number(b.favorite)-Number(a.favorite)); const add=()=>{if(!title||!body)return;setState((s:AppState)=>({...s,prompts:[...s.prompts,{id:uid(),title,body,tags:safeTags(tags),favorite:false}]}));setTitle('');setBody('');setTags('')}; const copy=(x:string)=>navigator.clipboard.writeText(x).then(()=>setToast('Prompt copied')); return <Panel title="Prompt Vault" subtitle="Reusable instructions for your AI coding/design agent: CRUD, tags, search, favorite, one-tap copy."><div className="grid gap-2 sm:grid-cols-3"><TextInput value={q} onChange={(e:any)=>setQ(e.target.value)} placeholder="Search prompts"/><TextInput value={title} onChange={(e:any)=>setTitle(e.target.value)} placeholder="Prompt title"/><TextInput value={tags} onChange={(e:any)=>setTags(e.target.value)} placeholder="tags"/><TextArea rows={3} value={body} onChange={(e:any)=>setBody(e.target.value)} placeholder="Prompt body" className="sm:col-span-2"/><button onClick={add} className="rounded-2xl bg-[#7C5CFF] font-black">Save prompt</button></div><div className="mt-4 grid gap-3 md:grid-cols-2">{list.map(p=><article key={p.id} className="rounded-2xl bg-white/5 p-4"><div className="flex justify-between gap-2"><b>{p.title}</b><button onClick={()=>setState((s:AppState)=>({...s,prompts:s.prompts.map(x=>x.id===p.id?{...x,favorite:!x.favorite}:x)}))} className="px-2">{p.favorite?'★':'☆'}</button></div><p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-[#A6ADBD]">{p.body}</p><div className="mt-3 flex flex-wrap gap-2"><button onClick={()=>copy(p.body)} className="rounded-xl bg-[#49D17D] px-3 py-2 text-xs font-black text-[#0B0D14]"><Copy size={14} className="inline"/> Copy</button>{p.tags.map(t=><span key={t} className="rounded-full bg-white/10 px-2 py-1 text-xs">#{t}</span>)}</div></article>)}{!list.length&&<Empty text="No prompts found."/>}</div></Panel> }
function DecisionLog({state,setState}:{state:AppState;setState:any}){ const [title,setTitle]=useState(''); const [context,setContext]=useState(''); const [decision,setDecision]=useState(''); const [q,setQ]=useState(''); const add=()=>{if(!title.trim())return;setState((s:AppState)=>({...s,decisions:[...s.decisions,{id:uid(),title,context,decision,date:Date.now()}]}));setTitle('');setContext('');setDecision('')}; const list=state.decisions.filter(d=>(d.title+d.context+d.decision).toLowerCase().includes(q.toLowerCase())).reverse(); return <Panel title="Decision Log" subtitle="Searchable records: title, context, decision, date."><div className="grid gap-2 sm:grid-cols-2"><TextInput value={q} onChange={(e:any)=>setQ(e.target.value)} placeholder="Search decisions"/><TextInput value={title} onChange={(e:any)=>setTitle(e.target.value)} placeholder="Decision title"/><TextArea rows={2} value={context} onChange={(e:any)=>setContext(e.target.value)} placeholder="Context"/><TextArea rows={2} value={decision} onChange={(e:any)=>setDecision(e.target.value)} placeholder="Decision"/><button onClick={add} className="rounded-2xl bg-[#7C5CFF] py-3 font-black sm:col-span-2">Log decision</button></div><div className="mt-4 space-y-2">{list.map(d=><article key={d.id} className="rounded-2xl bg-white/5 p-4"><b>{d.title}</b><p className="mt-1 text-sm text-[#A6ADBD]">{d.context}</p><p className="mt-2 text-sm text-[#39D0FF]">{d.decision}</p><p className="mt-2 text-xs text-[#A6ADBD]">{new Date(d.date).toLocaleString()}</p></article>)}{!list.length&&<Empty text="No decisions yet."/>}</div></Panel> }
function ShipLog({state,setToast}:{state:AppState;setToast:any}){ const [range,setRange]=useState<'today'|'week'>('today'); const text=useMemo(()=>makeShipLog(state,range),[state,range]); const copy=()=>navigator.clipboard.writeText(text).then(()=>setToast('Ship Log copied')); const download=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'text/markdown'}));a.download=`ship-log-${range}-${today()}.md`;a.click()}; return <Panel title="Ship Log Generator" subtitle="Compiles Done tasks, focus totals, decisions, and resolved blockers into Markdown."><div className="mb-3 grid gap-2 sm:flex"><button onClick={()=>setRange('today')} className={`rounded-2xl px-4 py-3 font-black ${range==='today'?'bg-[#7C5CFF]':'bg-white/5'}`}>Today</button><button onClick={()=>setRange('week')} className={`rounded-2xl px-4 py-3 font-black ${range==='week'?'bg-[#7C5CFF]':'bg-white/5'}`}>This Week</button><button onClick={copy} className="rounded-2xl bg-[#49D17D] px-4 py-3 font-black text-[#0B0D14]">Copy</button><button onClick={download} className="rounded-2xl bg-white/10 px-4 py-3 font-black"><Download className="inline" size={16}/> Download .md</button></div><pre className="max-h-[60svh] overflow-auto whitespace-pre-wrap rounded-3xl bg-black/35 p-4 text-sm leading-6 text-[#DDE7FF]">{text}</pre></Panel> }
function StatsPanel({state,stats}:{state:AppState;stats:any}){ const days=[6,5,4,3,2,1,0].map(d=>{const x=new Date();x.setDate(x.getDate()-d);const key=x.toISOString().slice(0,10); const done=state.tasks.filter(t=>t.doneAt&&new Date(t.doneAt).toISOString().slice(0,10)===key).length; const focus=state.sessions.filter(s=>new Date(s.ts).toISOString().slice(0,10)===key).reduce((a,b)=>a+b.minutes,0); return {key,score:done*20+focus};}); return <Panel title="Stats / Ship Score" subtitle="Formula: done tasks ×20 + focus minutes + resolved blockers ×10 − open high blockers ×15."><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><StatPill label="Ship Score" value={stats.score}/><StatPill label="Streak" value={stats.streak}/><StatPill label="Focus week" value={`${stats.focusWeek}m`}/><StatPill label="Resolved" value={stats.resolvedBlockers}/></div><div className="mt-6 rounded-3xl bg-white/5 p-4"><p className="mb-3 text-sm font-black">Weekly bar chart</p><div className="flex h-40 items-end gap-2">{days.map(d=><div key={d.key} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-xl bg-gradient-to-t from-[#7C5CFF] to-[#39D0FF]" style={{height:`${Math.max(8,Math.min(100,d.score))}%`}}/><span className="text-[10px] text-[#A6ADBD]">{d.key.slice(5)}</span></div>)}</div></div></Panel> }
function SettingsPanel({state,setState,setToast}:{state:AppState;setState:any;setToast:any}){ const exportJson=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download=`shipos-export-${today()}.json`;a.click()}; const importJson=(file:File)=>{const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(String(r.result)); if(d.v===2||d.v===3){setState({...d,v:3}); setToast('Import complete')} else setToast('Invalid v2/v3 export')}catch{setToast('Invalid JSON')}};r.readAsText(file)}; return <Panel title="Settings" subtitle="Export/import JSON backup, reset with confirmation, and migration-safe localStorage v3."><div className="grid gap-3 sm:grid-cols-3"><button onClick={exportJson} className="rounded-2xl bg-[#7C5CFF] px-4 py-4 font-black"><Download className="inline"/> Export JSON</button><label className="flex cursor-pointer items-center justify-center rounded-2xl bg-white/10 px-4 py-4 font-black"><Upload className="mr-2"/> Import JSON<input type="file" accept="application/json" className="hidden" onChange={e=>e.target.files?.[0]&&importJson(e.target.files[0])}/></label><button onClick={()=>confirm('Reset all ShipOS data?')&&setState(defaultState())} className="rounded-2xl bg-red-500/20 px-4 py-4 font-black text-red-300"><Trash2 className="inline"/> Reset</button></div><p className="mt-4 text-sm text-[#A6ADBD]">Migrated from old v1 keys if present: {oldKeys.join(', ')}</p></Panel> }
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-[#A6ADBD]">{text}</div>}

function computeStats(s:AppState){ const day=today(); const weekAgo=Date.now()-7*86400000; const doneToday=s.tasks.filter(t=>t.doneAt&&new Date(t.doneAt).toISOString().slice(0,10)===day).length; const focusToday=s.sessions.filter(x=>new Date(x.ts).toISOString().slice(0,10)===day).reduce((a,b)=>a+b.minutes,0); const focusWeek=s.sessions.filter(x=>x.ts>=weekAgo).reduce((a,b)=>a+b.minutes,0); const resolved=s.blockers.filter(b=>b.status==='resolved').length; const highOpen=s.blockers.filter(b=>b.status==='open'&&b.severity==='high').length; const score=Math.max(0,doneToday*20+focusToday+resolved*10-highOpen*15); let streak=0; for(let i=0;i<30;i++){const d=new Date();d.setDate(d.getDate()-i);const k=d.toISOString().slice(0,10); const active=s.tasks.some(t=>t.doneAt&&new Date(t.doneAt).toISOString().slice(0,10)===k)||s.sessions.some(x=>new Date(x.ts).toISOString().slice(0,10)===k); if(active) streak++; else if(i>0) break;} return {doneToday,focusToday,focusWeek,resolvedBlockers:resolved,score,streak};}
function makeShipLog(s:AppState,range:'today'|'week'){ const start=range==='today'?new Date(today()).getTime():Date.now()-7*86400000; const done=s.tasks.filter(t=>(t.doneAt||0)>=start); const focus=s.sessions.filter(x=>x.ts>=start).reduce((a,b)=>a+b.minutes,0); const decisions=s.decisions.filter(d=>d.date>=start); const resolved=s.blockers.filter(b=>b.status==='resolved'&&(b.resolvedAt||0)>=start); return `# Ship Log — ${range === 'today' ? today() : 'This Week'}\n\n## Mission\n${s.mission.title || 'No mission set'}\n\n## Intention\n${s.mission.intention}\n\n## Shipped\n${done.map(t=>`- [${t.priority}] ${t.title}`).join('\n') || '- No done tasks yet'}\n\n## Focus\n- ${focus} focused minutes\n- ${s.sessions.filter(x=>x.ts>=start).length} sessions\n\n## Decisions\n${decisions.map(d=>`- ${d.title}: ${d.decision}`).join('\n') || '- No decisions logged'}\n\n## Resolved Blockers\n${resolved.map(b=>`- ${b.title}`).join('\n') || '- No blockers resolved'}\n\n## Open Blockers\n${s.blockers.filter(b=>b.status==='open').map(b=>`- [${b.severity}] ${b.title}`).join('\n') || '- None'}\n`; }
