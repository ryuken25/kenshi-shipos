'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Target, Timer, AlertTriangle, BookOpen, FileText, BarChart3, Download, Upload, Trash2 } from 'lucide-react';
import { loadState, saveState, clearAll } from '@/lib/storage';
import { calcShipScore } from '@/lib/shipScore';

// ========== TYPES ==========
interface Mission {
  title: string;
  whyItMatters: string;
  mode: string;
  energy: string;
  deadline: string;
  intention: string;
  status: 'planned' | 'active' | 'done';
}

interface Task {
  id: string;
  title: string;
  desc: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  mode: string;
  estimate: number;
  status: 'backlog' | 'now' | 'done';
  created: number;
  completed?: number;
}

interface Blocker {
  id: string;
  what: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  nextAction: string;
  status: 'open' | 'resolved';
  created: number;
  resolved?: number;
}

interface Prompt {
  id: string;
  title: string;
  category: string;
  body: string;
  tags: string;
  favorite: boolean;
}

interface Decision {
  id: string;
  decision: string;
  reason: string;
  impact: string;
  time: number;
}

// ========== MAIN COMPONENT ==========
export default function Home() {
  const [activeTab, setActiveTab] = useState<'mission' | 'tasks' | 'focus' | 'blockers' | 'prompts' | 'decisions' | 'log' | 'stats'>('mission');
  const [mission, setMission] = useState<Mission>({ title: '', whyItMatters: '', mode: 'Code', energy: 'Normal', deadline: 'today', intention: 'Build', status: 'planned' });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [focusMinutes, setFocusMinutes] = useState(0);
  const [sprintCount, setSprintCount] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(1500);
  const [timerPreset, setTimerPreset] = useState(25);
  const [streak, setStreak] = useState(0);
  const [shipLogCopied, setShipLogCopied] = useState(false);

  // Load state
  useEffect(() => {
    setMission(loadState('shipos-mission', mission));
    setTasks(loadState('shipos-tasks', []));
    setBlockers(loadState('shipos-blockers', []));
    setPrompts(loadState('shipos-prompts', getStarterPrompts()));
    setDecisions(loadState('shipos-decisions', []));
    setFocusMinutes(loadState('shipos-focus-minutes', 0));
    setSprintCount(loadState('shipos-sprint-count', 0));
    setStreak(loadState('shipos-streak', 0));
  }, []);

  // Save state
  useEffect(() => { saveState('shipos-mission', mission); }, [mission]);
  useEffect(() => { saveState('shipos-tasks', tasks); }, [tasks]);
  useEffect(() => { saveState('shipos-blockers', blockers); }, [blockers]);
  useEffect(() => { saveState('shipos-prompts', prompts); }, [prompts]);
  useEffect(() => { saveState('shipos-decisions', decisions); }, [decisions]);
  useEffect(() => { saveState('shipos-focus-minutes', focusMinutes); }, [focusMinutes]);
  useEffect(() => { saveState('shipos-sprint-count', sprintCount); }, [sprintCount]);
  useEffect(() => { saveState('shipos-streak', streak); }, [streak]);

  // Timer
  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setTimerSeconds(s => {
        if (s <= 1) {
          setTimerRunning(false);
          setFocusMinutes(m => m + timerPreset);
          setSprintCount(c => c + 1);
          return timerPreset * 60;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerPreset]);

  // Tab title
  useEffect(() => {
    if (timerRunning) {
      const m = Math.floor(timerSeconds / 60);
      const s = timerSeconds % 60;
      document.title = `${m}:${s.toString().padStart(2,'0')} — ShipOS`;
    } else {
      document.title = 'Kenshi ShipOS';
    }
  }, [timerRunning, timerSeconds]);

  const doneTasks = tasks.filter(t => t.status === 'done');
  const openBlockers = blockers.filter(b => b.status === 'open');
  const resolvedBlockers = blockers.filter(b => b.status === 'resolved');
  const highBlockers = openBlockers.filter(b => b.severity === 'high');
  const shipScore = calcShipScore({ completedTasks: doneTasks.length, focusMinutes, resolvedBlockers: resolvedBlockers.length, shipLogCopied, openHighBlockers: highBlockers.length });

  const loadDemoWorkspace = () => {
    setMission({
      title: 'Polish QuestPay mobile checkout',
      whyItMatters: 'Make the monthly app understandable and easy to test on phone.',
      mode: 'Design',
      energy: 'Normal',
      deadline: 'today',
      intention: 'Polish',
      status: 'active',
    });
    setTasks([
      { id: 'demo-1', title: 'Audit mobile hero', desc: 'Check first-screen clarity and CTA visibility.', priority: 'high', mode: 'Design', estimate: 20, status: 'done', created: Date.now(), completed: Date.now() },
      { id: 'demo-2', title: 'Fix package card spacing', desc: 'Make packages readable at 390px.', priority: 'high', mode: 'Design', estimate: 25, status: 'now', created: Date.now() },
      { id: 'demo-3', title: 'Test wallet connect copy', desc: 'Confirm wallet area explains public address only.', priority: 'medium', mode: 'Bug', estimate: 15, status: 'backlog', created: Date.now() },
      { id: 'demo-4', title: 'Export ship log', desc: 'Generate a final update for Telegram/GitHub.', priority: 'medium', mode: 'Admin', estimate: 10, status: 'backlog', created: Date.now() },
    ]);
    setBlockers([{ id: 'demo-blocker', what: 'Browser wallet popup needs manual testing', type: 'Missing Info', severity: 'medium', nextAction: 'Open production URL on phone with wallet installed.', status: 'open', created: Date.now() }]);
    setPrompts(getStarterPrompts());
    setDecisions([{ id: 'demo-decision', decision: 'Keep Proof NFT disabled until core app is stable', reason: 'Core productivity flow matters more than optional Web3 badge.', impact: 'Less risk, clearer weekly app.', time: Date.now() }]);
    setFocusMinutes(25);
    setSprintCount(1);
    setActiveTab('mission');
  };

  // ========== RENDER ==========
  return (
    <div className="min-h-screen bg-[#0B0D14]">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-white/5 px-4 pb-10 pt-10 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#7C5CFF]/15 via-transparent to-[#39D0FF]/15" />
        <div className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#7C5CFF]/20 px-3 py-2 text-xs font-bold text-[#7C5CFF]">
              <Rocket className="h-3 w-3" /> Productivity Tools Weekly Entry
            </div>
            <h1 className="font-heading text-[clamp(2.6rem,13vw,5.8rem)] font-black leading-[0.92] tracking-[-0.07em]">Kenshi ShipOS</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#F6F7FB] sm:text-xl">A one-day work dashboard for people building with AI agents.</p>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#A6ADBD] sm:text-base">Put your mission, tasks, timer, blockers, prompts, decisions, and final report in one place — so you stop jumping between chat, notes, and todo apps.</p>
            <p className="mt-3 rounded-2xl border border-[#39D0FF]/20 bg-[#39D0FF]/10 p-3 text-sm font-bold text-[#39D0FF]">No login. No backend. Your data stays in your browser.</p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <button type="button" onClick={() => setActiveTab('mission')} className="min-h-11 rounded-xl bg-[#7C5CFF] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#6a4fee]">Start Today&apos;s Mission</button>
              <button type="button" onClick={loadDemoWorkspace} className="min-h-11 rounded-xl bg-[#49D17D] px-5 py-3 text-sm font-bold text-[#0B0D14] transition hover:bg-[#3cc06c]">Try Demo Day</button>
              <button type="button" onClick={() => setActiveTab('tasks')} className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold transition hover:bg-white/10">Open Workspace</button>
            </div>
          </div>
          <div className="glass-panel p-4 sm:p-5">
            <img src="/brand/kenshi/shipos-core.svg" alt="ShipOS cockpit" className="w-full rounded-3xl" />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-[#A6ADBD]">
              <div className="rounded-2xl bg-white/5 p-3"><span className="block text-white">Mission</span>one outcome</div>
              <div className="rounded-2xl bg-white/5 p-3"><span className="block text-white">Sprint</span>focus timer</div>
              <div className="rounded-2xl bg-white/5 p-3"><span className="block text-white">Report</span>ship log</div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass-panel p-5">
            <h2 className="font-heading text-2xl font-black">How to use ShipOS in 5 minutes</h2>
            <ol className="mt-4 space-y-2 text-sm leading-7 text-[#A6ADBD]">
              <li><b className="text-white">1.</b> Write one mission.</li>
              <li><b className="text-white">2.</b> Generate/add starter tasks.</li>
              <li><b className="text-white">3.</b> Move one task to Now.</li>
              <li><b className="text-white">4.</b> Start a focus sprint.</li>
              <li><b className="text-white">5.</b> Save blockers/prompts/decisions.</li>
              <li><b className="text-white">6.</b> Copy your Ship Log.</li>
            </ol>
            <button type="button" onClick={loadDemoWorkspace} className="mt-4 min-h-11 w-full rounded-xl bg-[#7C5CFF] px-5 py-3 text-sm font-bold text-white">Load demo workspace</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['AI-agent builders','Save prompts, context, blockers, and ship reports so your agent does not lose the plot.'],
              ['Coders','Plan one fix/build/deploy session and track what actually shipped.'],
              ['Designers','Run polish sprints, note visual decisions, and export a clean handoff report.'],
              ['Students / creators','Focus on one outcome, timebox the work, and summarize what changed.'],
            ].map(([title,text]) => <article key={title} className="glass-panel p-4"><h3 className="font-heading text-base font-black text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-[#A6ADBD]">{text}</p></article>)}
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0B0D14]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {[
              { id: 'mission', icon: Target, label: 'Mission' },
              { id: 'tasks', icon: FileText, label: 'Tasks' },
              { id: 'focus', icon: Timer, label: 'Focus' },
              { id: 'blockers', icon: AlertTriangle, label: 'Blockers' },
              { id: 'prompts', icon: BookOpen, label: 'Prompts' },
              { id: 'decisions', icon: FileText, label: 'Decisions' },
              { id: 'log', icon: FileText, label: 'Ship Log' },
              { id: 'stats', icon: BarChart3, label: 'Stats' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${
                  activeTab === tab.id ? 'bg-[#7C5CFF]/20 text-[#7C5CFF]' : 'text-[#A6ADBD] hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === 'mission' && <MissionPanel mission={mission} setMission={setMission} tasks={tasks} setTasks={setTasks} />}
            {activeTab === 'tasks' && <TaskBoard tasks={tasks} setTasks={setTasks} />}
            {activeTab === 'focus' && <FocusCockpit timerSeconds={timerSeconds} setTimerSeconds={setTimerSeconds} timerRunning={timerRunning} setTimerRunning={setTimerRunning} timerPreset={timerPreset} setTimerPreset={setTimerPreset} focusMinutes={focusMinutes} sprintCount={sprintCount} tasks={tasks} blockers={blockers} setBlockers={setBlockers} />}
            {activeTab === 'blockers' && <BlockerRadar blockers={blockers} setBlockers={setBlockers} setTasks={setTasks} />}
            {activeTab === 'prompts' && <PromptVault prompts={prompts} setPrompts={setPrompts} />}
            {activeTab === 'decisions' && <DecisionLog decisions={decisions} setDecisions={setDecisions} />}
            {activeTab === 'log' && <ShipLogGenerator mission={mission} tasks={tasks} focusMinutes={focusMinutes} sprintCount={sprintCount} blockers={blockers} decisions={decisions} setShipLogCopied={setShipLogCopied} />}
            {activeTab === 'stats' && <StatsPanel shipScore={shipScore} focusMinutes={focusMinutes} doneTasks={doneTasks.length} openBlockers={openBlockers.length} resolvedBlockers={resolvedBlockers.length} promptsSaved={prompts.length} streak={streak} clearAll={() => { if(confirm('Clear all data?')) { clearAll(); window.location.reload(); }}} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ========== MISSION PANEL ==========
function MissionPanel({ mission, setMission, tasks, setTasks }: { mission: Mission; setMission: (m: Mission) => void; tasks: Task[]; setTasks: (t: Task[]) => void }) {
  const modes = ['Code', 'Design', 'Study', 'Admin', 'Content', 'Custom'];
  const energies = ['Low', 'Normal', 'High'];
  const intentions = ['Fix', 'Build', 'Learn', 'Polish', 'Deploy', 'Research'];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-panel p-6">
        <h2 className="font-heading text-xl font-bold mb-4 flex items-center gap-2"><Target className="h-5 w-5 text-[#7C5CFF]" /> Mission Control</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-[#A6ADBD] uppercase tracking-wider">Mission Title</label>
            <input value={mission.title} onChange={e => setMission({...mission, title: e.target.value})} placeholder="What are you shipping today?" className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:border-[#7C5CFF] focus:outline-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-[#A6ADBD] uppercase tracking-wider">Why It Matters</label>
            <textarea value={mission.whyItMatters} onChange={e => setMission({...mission, whyItMatters: e.target.value})} placeholder="Why does this matter?" rows={2} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm focus:border-[#7C5CFF] focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[#A6ADBD] uppercase tracking-wider">Mode</label>
              <div className="mt-1 flex flex-wrap gap-1">{modes.map(m => <button key={m} onClick={() => setMission({...mission, mode: m})} className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${mission.mode === m ? 'bg-[#7C5CFF] text-white' : 'bg-white/5 text-[#A6ADBD] hover:bg-white/10'}`}>{m}</button>)}</div>
            </div>
            <div>
              <label className="text-xs font-bold text-[#A6ADBD] uppercase tracking-wider">Energy</label>
              <div className="mt-1 flex flex-wrap gap-1">{energies.map(e => <button key={e} onClick={() => setMission({...mission, energy: e})} className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${mission.energy === e ? 'bg-[#39D0FF] text-[#0B0D14]' : 'bg-white/5 text-[#A6ADBD] hover:bg-white/10'}`}>{e}</button>)}</div>
            </div>
            <div>
              <label className="text-xs font-bold text-[#A6ADBD] uppercase tracking-wider">Intention</label>
              <div className="mt-1 flex flex-wrap gap-1">{intentions.map(i => <button key={i} onClick={() => setMission({...mission, intention: i})} className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${mission.intention === i ? 'bg-[#49D17D] text-[#0B0D14]' : 'bg-white/5 text-[#A6ADBD] hover:bg-white/10'}`}>{i}</button>)}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setMission({...mission, status: 'active'})} className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${mission.status === 'active' ? 'bg-[#49D17D] text-[#0B0D14]' : 'bg-[#7C5CFF] text-white hover:bg-[#6a4fee]'}`}>{mission.status === 'active' ? '✓ Active' : 'Activate Mission'}</button>
            <button onClick={() => setMission({...mission, status: 'done'})} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10">Mark Done</button>
          </div>
        </div>
      </div>
      <div className="glass-panel p-6">
        <h2 className="font-heading text-xl font-bold mb-4">Quick Stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Tasks Done" value={tasks.filter(t=>t.status==='done').length} color="#49D17D" />
          <StatCard label="In Progress" value={tasks.filter(t=>t.status==='now').length} color="#7C5CFF" />
          <StatCard label="Backlog" value={tasks.filter(t=>t.status==='backlog').length} color="#A6ADBD" />
          <StatCard label="Total Tasks" value={tasks.length} color="#39D0FF" />
        </div>
        <div className="mt-4 rounded-lg bg-white/5 p-4">
          <p className="text-xs font-bold text-[#A6ADBD] uppercase tracking-wider">Mission Status</p>
          <p className="mt-1 text-2xl font-heading font-bold capitalize">{mission.status}</p>
          {mission.title && <p className="mt-1 text-sm text-[#A6ADBD]">{mission.title}</p>}
        </div>
      </div>
    </div>
  );
}

// ========== TASK BOARD ==========
function TaskBoard({ tasks, setTasks }: { tasks: Task[]; setTasks: (t: Task[]) => void }) {
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<Task['priority']>('medium');
  const [newMode, setNewMode] = useState('Code');
  const [filter, setFilter] = useState('all');

  const addTask = () => {
    if (!newTitle.trim()) return;
    setTasks([...tasks, { id: Date.now().toString(), title: newTitle, desc: '', priority: newPriority, mode: newMode, estimate: 30, status: 'backlog', created: Date.now() }]);
    setNewTitle('');
  };

  const moveTask = (id: string, status: Task['status']) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, status, completed: status === 'done' ? Date.now() : undefined } : t));
  };

  const deleteTask = (id: string) => setTasks(tasks.filter(t => t.id !== id));

  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.mode === filter || t.priority === filter);
  const backlog = filtered.filter(t => t.status === 'backlog');
  const now = filtered.filter(t => t.status === 'now');
  const done = filtered.filter(t => t.status === 'done');
  const progress = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0;

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-6 rounded-full bg-white/5 h-3 overflow-hidden">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#39D0FF]" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
      </div>

      {/* Add task */}
      <div className="glass-panel mb-6 p-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="Add a task..." className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm focus:border-[#7C5CFF] focus:outline-none" />
        </div>
        <select value={newPriority} onChange={e => setNewPriority(e.target.value as Task['priority'])} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm">
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
        </select>
        <select value={newMode} onChange={e => setNewMode(e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm">
          <option>Code</option><option>Design</option><option>Research</option><option>Bug</option><option>Deploy</option><option>Admin</option>
        </select>
        <button onClick={addTask} className="rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-bold text-white hover:bg-[#6a4fee]">Add</button>
      </div>

      {/* Columns */}
      <div className="grid gap-4 md:grid-cols-3">
        <TaskColumn title="Backlog" tasks={backlog} color="#A6ADBD" onMove={moveTask} onDelete={deleteTask} moveTarget="now" moveLabel="Start" />
        <TaskColumn title="Now" tasks={now} color="#7C5CFF" onMove={moveTask} onDelete={deleteTask} moveTarget="done" moveLabel="Done" />
        <TaskColumn title="Done" tasks={done} color="#49D17D" onMove={moveTask} onDelete={deleteTask} moveTarget="backlog" moveLabel="Back" />
      </div>
    </div>
  );
}

function TaskColumn({ title, tasks, color, onMove, onDelete, moveTarget, moveLabel }: { title: string; tasks: Task[]; color: string; onMove: (id: string, s: Task['status']) => void; onDelete: (id: string) => void; moveTarget: Task['status']; moveLabel: string }) {
  return (
    <div className="glass-panel p-4">
      <h3 className="font-heading text-sm font-bold mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {title} <span className="text-[#A6ADBD]">({tasks.length})</span>
      </h3>
      <div className="space-y-2 min-h-[100px]">
        {tasks.map(t => (
          <motion.div key={t.id} layout className="rounded-lg bg-white/5 border border-white/5 p-3" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{t.title}</p>
                <div className="mt-1 flex gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    t.priority === 'critical' ? 'bg-[#FF5C7A]/20 text-[#FF5C7A]' : t.priority === 'high' ? 'bg-[#FFD166]/20 text-[#FFD166]' : t.priority === 'medium' ? 'bg-[#7C5CFF]/20 text-[#7C5CFF]' : 'bg-white/10 text-[#A6ADBD]'
                  }`}>{t.priority}</span>
                  <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[#A6ADBD]">{t.mode}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onMove(t.id, moveTarget)} className="rounded bg-white/10 px-2 py-1 text-[10px] font-bold hover:bg-white/20">{moveLabel}</button>
                <button onClick={() => onDelete(t.id)} className="rounded bg-[#FF5C7A]/10 px-2 py-1 text-[10px] font-bold text-[#FF5C7A] hover:bg-[#FF5C7A]/20">×</button>
              </div>
            </div>
          </motion.div>
        ))}
        {tasks.length === 0 && <p className="text-center text-xs text-[#A6ADBD] py-8">No tasks here</p>}
      </div>
    </div>
  );
}

// ========== FOCUS COCKPIT ==========
function FocusCockpit({ timerSeconds, setTimerSeconds, timerRunning, setTimerRunning, timerPreset, setTimerPreset, focusMinutes, sprintCount, tasks, blockers, setBlockers }: {
  timerSeconds: number; setTimerSeconds: (n: number) => void; timerRunning: boolean; setTimerRunning: (b: boolean) => void;
  timerPreset: number; setTimerPreset: (n: number) => void; focusMinutes: number; sprintCount: number;
  tasks: Task[]; blockers: Blocker[]; setBlockers: (b: Blocker[]) => void;
}) {
  const [blockerText, setBlockerText] = useState('');
  const presets = [{ work: 15, break: 5 }, { work: 25, break: 5 }, { work: 50, break: 10 }];

  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  const progress = 1 - timerSeconds / (timerPreset * 60);

  const addQuickBlocker = () => {
    if (!blockerText.trim()) return;
    setBlockers([...blockers, { id: Date.now().toString(), what: blockerText, type: 'Other', severity: 'medium', nextAction: '', status: 'open', created: Date.now() }]);
    setBlockerText('');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-panel p-6 flex flex-col items-center">
        <h2 className="font-heading text-xl font-bold mb-6 flex items-center gap-2"><Timer className="h-5 w-5 text-[#39D0FF]" /> Focus Cockpit</h2>
        {/* Timer ring */}
        <div className="relative w-48 h-48 mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
            <circle cx="50" cy="50" r="45" fill="none" stroke={timerRunning ? "#7C5CFF" : "#39D0FF"} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${progress * 283} 283`} className="transition-all duration-1000" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-4xl font-bold">{minutes}:{seconds.toString().padStart(2, '0')}</span>
            <span className="text-xs text-[#A6ADBD]">{timerRunning ? 'Focusing...' : 'Ready'}</span>
          </div>
        </div>
        {/* Controls */}
        <div className="flex gap-2 mb-4">
          {!timerRunning ? (
            <button onClick={() => setTimerRunning(true)} className="rounded-lg bg-[#49D17D] px-6 py-2 text-sm font-bold text-[#0B0D14] hover:bg-[#3cc06c]">Start</button>
          ) : (
            <button onClick={() => setTimerRunning(false)} className="rounded-lg bg-[#FFD166] px-6 py-2 text-sm font-bold text-[#0B0D14] hover:bg-[#eec055]">Pause</button>
          )}
          <button onClick={() => { setTimerRunning(false); setTimerSeconds(timerPreset * 60); }} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10">Reset</button>
        </div>
        {/* Presets */}
        <div className="flex gap-2">
          {presets.map(p => (
            <button key={p.work} onClick={() => { setTimerPreset(p.work); setTimerSeconds(p.work * 60); setTimerRunning(false); }} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${timerPreset === p.work ? 'bg-[#7C5CFF] text-white' : 'bg-white/5 text-[#A6ADBD] hover:bg-white/10'}`}>{p.work}/{p.break}</button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <div className="glass-panel p-4">
          <h3 className="text-sm font-bold mb-2">Session Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Focus Minutes" value={focusMinutes} color="#7C5CFF" />
            <StatCard label="Sprints Done" value={sprintCount} color="#39D0FF" />
          </div>
        </div>
        <div className="glass-panel p-4">
          <h3 className="text-sm font-bold mb-2">Quick Blocker</h3>
          <div className="flex gap-2">
            <input value={blockerText} onChange={e => setBlockerText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addQuickBlocker()} placeholder="What blocked you?" className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-[#FF5C7A] focus:outline-none" />
            <button onClick={addQuickBlocker} className="rounded-lg bg-[#FF5C7A]/20 px-3 py-2 text-sm font-bold text-[#FF5C7A]">+</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== BLOCKER RADAR ==========
function BlockerRadar({ blockers, setBlockers, setTasks }: { blockers: Blocker[]; setBlockers: (b: Blocker[]) => void; setTasks: (t: Task[]) => void }) {
  const [what, setWhat] = useState('');
  const [type, setType] = useState('Bug');
  const [severity, setSeverity] = useState<Blocker['severity']>('medium');
  const [nextAction, setNextAction] = useState('');

  const addBlocker = () => {
    if (!what.trim()) return;
    setBlockers([...blockers, { id: Date.now().toString(), what, type, severity, nextAction, status: 'open', created: Date.now() }]);
    setWhat(''); setNextAction('');
  };

  const resolveBlocker = (id: string) => setBlockers(blockers.map(b => b.id === id ? { ...b, status: 'resolved', resolved: Date.now() } : b));
  const deleteBlocker = (id: string) => setBlockers(blockers.filter(b => b.id !== id));

  const toTask = (b: Blocker) => {
    setTasks((prev: Task[]) => [...prev, { id: Date.now().toString(), title: `[Blocker] ${b.what}`, desc: b.nextAction, priority: b.severity === 'high' ? 'critical' : b.severity, mode: 'Bug', estimate: 30, status: 'now', created: Date.now() }]);
    resolveBlocker(b.id);
  };

  const open = blockers.filter(b => b.status === 'open');
  const resolved = blockers.filter(b => b.status === 'resolved');

  return (
    <div>
      <div className="glass-panel mb-6 p-4">
        <h3 className="font-heading text-sm font-bold mb-3">Add Blocker</h3>
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={what} onChange={e => setWhat(e.target.value)} placeholder="What blocked you?" className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-[#FF5C7A] focus:outline-none sm:col-span-2" />
          <select value={type} onChange={e => setType(e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm">
            <option>Bug</option><option>Missing Info</option><option>Decision</option><option>Distraction</option><option>Waiting</option><option>Other</option>
          </select>
          <div className="flex gap-2">
            <select value={severity} onChange={e => setSeverity(e.target.value as Blocker['severity'])} className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
            </select>
            <button onClick={addBlocker} className="rounded-lg bg-[#FF5C7A] px-4 py-2 text-sm font-bold text-white">Add</button>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold mb-3 text-[#FF5C7A]">Open ({open.length})</h3>
          <div className="space-y-2">{open.map(b => (
            <div key={b.id} className="glass-panel p-3 flex items-center justify-between">
              <div><p className="text-sm font-bold">{b.what}</p><p className="text-xs text-[#A6ADBD]">{b.type} · {b.severity}</p></div>
              <div className="flex gap-1">
                <button onClick={() => toTask(b)} className="rounded bg-[#7C5CFF]/20 px-2 py-1 text-[10px] font-bold text-[#7C5CFF]">→Task</button>
                <button onClick={() => resolveBlocker(b.id)} className="rounded bg-[#49D17D]/20 px-2 py-1 text-[10px] font-bold text-[#49D17D]">✓</button>
                <button onClick={() => deleteBlocker(b.id)} className="rounded bg-[#FF5C7A]/10 px-2 py-1 text-[10px] font-bold text-[#FF5C7A]">×</button>
              </div>
            </div>
          ))}{open.length === 0 && <p className="text-xs text-[#A6ADBD] text-center py-4">No open blockers 🎉</p>}</div>
        </div>
        <div>
          <h3 className="text-sm font-bold mb-3 text-[#49D17D]">Resolved ({resolved.length})</h3>
          <div className="space-y-2">{resolved.slice(-5).map(b => (
            <div key={b.id} className="glass-panel p-3 opacity-60"><p className="text-sm line-through">{b.what}</p><p className="text-xs text-[#A6ADBD]">{b.type} · resolved</p></div>
          ))}{resolved.length === 0 && <p className="text-xs text-[#A6ADBD] text-center py-4">No resolved blockers yet</p>}</div>
        </div>
      </div>
    </div>
  );
}

// ========== PROMPT VAULT ==========
function PromptVault({ prompts, setPrompts }: { prompts: Prompt[]; setPrompts: (p: Prompt[]) => void }) {
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Custom');

  const filtered = prompts.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.body.toLowerCase().includes(search.toLowerCase()));

  const addPrompt = () => {
    if (!title.trim() || !body.trim()) return;
    setPrompts([...prompts, { id: Date.now().toString(), title, body, category, tags: '', favorite: false }]);
    setTitle(''); setBody(''); setShowAdd(false);
  };

  const toggleFav = (id: string) => setPrompts(prompts.map(p => p.id === id ? { ...p, favorite: !p.favorite } : p));
  const deletePrompt = (id: string) => setPrompts(prompts.filter(p => p.id !== id));
  const copyPrompt = (body: string) => navigator.clipboard.writeText(body);

  return (
    <div>
      <div className="glass-panel mb-4 p-4">
        <h2 className="font-heading text-xl font-black text-white">Prompt Vault</h2>
        <p className="mt-2 text-sm leading-6 text-[#A6ADBD]">Prompt Vault keeps reusable instructions for your AI coding/design agent. Copy one when you need to restart context or ask for a focused fix.</p>
      </div>
      <div className="flex gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prompts..." className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm focus:border-[#7C5CFF] focus:outline-none" />
        <button onClick={() => setShowAdd(!showAdd)} className="rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-bold text-white">+ Add</button>
      </div>
      {showAdd && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="glass-panel mb-4 p-4">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm mb-2 focus:border-[#7C5CFF] focus:outline-none" />
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Prompt body..." rows={4} className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm mb-2 focus:border-[#7C5CFF] focus:outline-none resize-none font-mono" />
          <div className="flex gap-2">
            <select value={category} onChange={e => setCategory(e.target.value)} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm">
              <option>Debug</option><option>Design</option><option>Deploy</option><option>Research</option><option>Refactor</option><option>Writing</option><option>Custom</option>
            </select>
            <button onClick={addPrompt} className="rounded-lg bg-[#49D17D] px-4 py-2 text-sm font-bold text-[#0B0D14]">Save</button>
          </div>
        </motion.div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map(p => (
          <div key={p.id} className="glass-panel p-4">
            <div className="flex items-start justify-between">
              <div><h3 className="text-sm font-bold">{p.title}</h3><span className="text-[10px] text-[#A6ADBD]">{p.category}</span></div>
      <div className="flex gap-1">
                <button onClick={() => toggleFav(p.id)} className={`text-sm ${p.favorite ? 'text-[#FFD166]' : 'text-[#A6ADBD]'}`}>★</button>
                <button onClick={() => copyPrompt(p.body)} className="rounded bg-white/10 px-2 py-1 text-[10px] font-bold hover:bg-white/20">Copy</button>
                <button onClick={() => copyPrompt(`${p.body}\n\nCurrent mission context: use the active ShipOS mission, current task, blockers, and decisions as context.`)} className="rounded bg-[#7C5CFF]/20 px-2 py-1 text-[10px] font-bold text-[#7C5CFF]">Use mission</button>
                <button onClick={() => deletePrompt(p.id)} className="rounded bg-[#FF5C7A]/10 px-2 py-1 text-[10px] font-bold text-[#FF5C7A]">×</button>
              </div>
            </div>
            <pre className="mt-2 text-xs text-[#A6ADBD] whitespace-pre-wrap font-mono line-clamp-4">{p.body}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

// ========== DECISION LOG ==========
function DecisionLog({ decisions, setDecisions }: { decisions: Decision[]; setDecisions: (d: Decision[]) => void }) {
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [impact, setImpact] = useState('');

  const addDecision = () => {
    if (!decision.trim()) return;
    setDecisions([...decisions, { id: Date.now().toString(), decision, reason, impact, time: Date.now() }]);
    setDecision(''); setReason(''); setImpact('');
  };

  return (
    <div>
      <div className="glass-panel mb-6 p-4 space-y-2">
        <input value={decision} onChange={e => setDecision(e.target.value)} placeholder="Decision" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-[#7C5CFF] focus:outline-none" />
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-[#7C5CFF] focus:outline-none" />
        <input value={impact} onChange={e => setImpact(e.target.value)} placeholder="Impact" className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm focus:border-[#7C5CFF] focus:outline-none" />
        <button onClick={addDecision} className="rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-bold text-white">Log Decision</button>
      </div>
      <div className="space-y-2">
        {decisions.slice().reverse().map(d => (
          <div key={d.id} className="glass-panel p-4">
            <p className="text-sm font-bold">{d.decision}</p>
            {d.reason && <p className="text-xs text-[#A6ADBD] mt-1">Reason: {d.reason}</p>}
            {d.impact && <p className="text-xs text-[#39D0FF] mt-1">Impact: {d.impact}</p>}
            <p className="text-[10px] text-[#A6ADBD] mt-2">{new Date(d.time).toLocaleString()}</p>
          </div>
        ))}
        {decisions.length === 0 && <p className="text-center text-xs text-[#A6ADBD] py-8">No decisions logged yet</p>}
      </div>
    </div>
  );
}

// ========== SHIP LOG GENERATOR ==========
function ShipLogGenerator({ mission, tasks, focusMinutes, sprintCount, blockers, decisions, setShipLogCopied }: {
  mission: Mission; tasks: Task[]; focusMinutes: number; sprintCount: number; blockers: Blocker[]; decisions: Decision[]; setShipLogCopied: (b: boolean) => void;
}) {
  const [logText, setLogText] = useState('');

  const generateLog = () => {
    const done = tasks.filter(t => t.status === 'done');
    const open = blockers.filter(b => b.status === 'open');
    const resolved = blockers.filter(b => b.status === 'resolved');
    const next = tasks.filter(t => t.status === 'now')[0] || tasks.filter(t => t.status === 'backlog')[0];

    const log = `# Ship Log — ${new Date().toLocaleDateString()}

## Mission
${mission.title || 'No mission set'}

## Shipped
${done.map(t => `- ${t.title}`).join('\n') || '- No tasks completed'}

## Focus
- Total focused minutes: ${focusMinutes}
- Sprints completed: ${sprintCount}

## Blockers
- Open: ${open.length}
- Resolved: ${resolved.length}

## Decisions
${decisions.map(d => `- ${d.decision}`).join('\n') || '- No decisions logged'}

## Next Step
${next ? next.title : 'Set a new mission'}

## Links / Contact
GitHub: https://github.com/ryuken25
X: https://x.com/Atttar4
Discord: kenshiwassleepy`;

    setLogText(log);
  };

  const copyLog = () => { navigator.clipboard.writeText(logText); setShipLogCopied(true); };

  return (
    <div>
      <div className="glass-panel mb-4 p-4">
        <h2 className="font-heading text-xl font-black text-white">Ship Log</h2>
        <p className="mt-2 text-sm leading-6 text-[#A6ADBD]">Ship Log turns your session into a copyable update for Discord, GitHub, X, or your own notes.</p>
      </div>
      <div className="grid gap-2 mb-4 sm:flex">
        <button onClick={generateLog} className="rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-bold text-white">Generate Ship Log</button>
        {logText && <button onClick={copyLog} className="rounded-lg bg-[#49D17D] px-4 py-2 text-sm font-bold text-[#0B0D14]">Copy Log</button>}
        {logText && <button onClick={() => { const blob = new Blob([logText], { type: 'text/markdown' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ship-log-${new Date().toISOString().slice(0,10)}.md`; a.click(); }} className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10">Download MD</button>}
      </div>
      {logText && <pre className="glass-panel p-6 text-sm font-mono whitespace-pre-wrap">{logText}</pre>}
      {!logText && <p className="text-center text-sm text-[#A6ADBD] py-12">Click Generate to create your ship log from today&apos;s data.</p>}
    </div>
  );
}

// ========== STATS PANEL ==========
function StatsPanel({ shipScore, focusMinutes, doneTasks, openBlockers, resolvedBlockers, promptsSaved, streak, clearAll }: {
  shipScore: number; focusMinutes: number; doneTasks: number; openBlockers: number; resolvedBlockers: number; promptsSaved: number; streak: number; clearAll: () => void;
}) {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Ship Score" value={shipScore} color="#7C5CFF" />
        <StatCard label="Focus Minutes" value={focusMinutes} color="#39D0FF" />
        <StatCard label="Tasks Done" value={doneTasks} color="#49D17D" />
        <StatCard label="Streak" value={streak} color="#FFD166" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Open Blockers" value={openBlockers} color="#FF5C7A" />
        <StatCard label="Resolved Blockers" value={resolvedBlockers} color="#49D17D" />
        <StatCard label="Prompts Saved" value={promptsSaved} color="#A6ADBD" />
      </div>
      {shipScore < 20 && <p className="text-sm text-[#A6ADBD] mb-4">Small ship is still a ship. Pick one next action.</p>}
      <div className="flex gap-2">
        <button onClick={() => { const data = { shipScore, focusMinutes, doneTasks, openBlockers, resolvedBlockers, promptsSaved }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shipos-export.json'; a.click(); }} className="rounded-lg bg-[#7C5CFF] px-4 py-2 text-sm font-bold text-white flex items-center gap-2"><Download className="h-4 w-4" /> Export JSON</button>
        <button onClick={clearAll} className="rounded-lg bg-[#FF5C7A]/20 px-4 py-2 text-sm font-bold text-[#FF5C7A] flex items-center gap-2"><Trash2 className="h-4 w-4" /> Reset All</button>
      </div>
    </div>
  );
}

// ========== HELPERS ==========
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass-panel p-4">
      <p className="text-xs font-bold text-[#A6ADBD] uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-2xl font-heading font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function getStarterPrompts(): Prompt[] {
  return [
    { id: '1', title: 'Bug Audit Prompt', body: 'Audit this repo for the bug below. Find likely files, fix root cause, run build, and report changed files.', category: 'Debug', tags: 'bug,audit', favorite: false },
    { id: '2', title: 'Responsive QA Prompt', body: 'Test layout at 320/390/768/1024/1440 widths. Fix overlap, overflow, and spacing regressions.', category: 'Design', tags: 'qa,responsive', favorite: false },
    { id: '3', title: 'Deployment Guard Prompt', body: 'Run build, inspect env requirements, verify public production URL, and report any blockers honestly.', category: 'Deploy', tags: 'deploy,guard', favorite: false },
    { id: '4', title: 'UI Polish Prompt', body: 'Improve visual hierarchy, color balance, hover states, and empty states without changing core logic.', category: 'Design', tags: 'ui,polish', favorite: false },
    { id: '5', title: 'Final Report Prompt', body: 'Summarize features shipped, tests run, known issues, production URL, and next steps.', category: 'Writing', tags: 'report,summary', favorite: false },
  ];
}
