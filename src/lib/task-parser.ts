/* ── Natural-Language Quick Capture ───────────────────────── */
import type { Task, Priority, Recurrence } from './state/schema';
import { toLocalDateKey } from './dates/localDate';

const uid = () => Math.random().toString(36).slice(2, 10);

const WEEKDAYS: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

export interface ParsedTask {
  title: string;
  priority: Priority;
  tags: string[];
  dueAt?: number;
  scheduledDate?: string;
  estimateMinutes?: number;
  recurrence: Recurrence;
}

export function parseQuickCapture(input: string): ParsedTask | null {
  let text = input.trim();
  if (!text) return null;

  // Extract priority
  let priority: Priority = 'P1';
  const pMatch = text.match(/\!p([012])\b/i);
  if (pMatch) { priority = ('P' + pMatch[1]) as Priority; text = text.replace(pMatch[0], '').trim(); }

  // Extract tags
  const tags: string[] = [];
  const tagRegex = /#(\w+)/g;
  let m;
  while ((m = tagRegex.exec(text)) !== null) tags.push(m[1]);
  text = text.replace(/#\w+/g, '').trim();

  // Extract estimate
  let estimateMinutes: number | undefined;
  const estMatch = text.match(/\b(\d+)\s*(m|min|minutes?|h|hr|hours?)\b/i);
  if (estMatch) {
    const val = parseInt(estMatch[1]);
    estimateMinutes = /h/i.test(estMatch[2]) ? val * 60 : val;
    text = text.replace(estMatch[0], '').trim();
  }

  // Extract due date
  let dueAt: number | undefined;
  let scheduledDate: string | undefined;
  const now = new Date();

  if (/\btoday\b/i.test(text)) {
    scheduledDate = toLocalDateKey(now);
    dueAt = now.setHours(23, 59, 59, 999);
    text = text.replace(/\btoday\b/i, '').trim();
  } else if (/\btomorrow\b/i.test(text)) {
    const tmr = new Date(now);
    tmr.setDate(tmr.getDate() + 1);
    scheduledDate = toLocalDateKey(tmr);
    dueAt = tmr.setHours(23, 59, 59, 999);
    text = text.replace(/\btomorrow\b/i, '').trim();
  } else {
    for (const [name, dayNum] of Object.entries(WEEKDAYS)) {
      const regex = new RegExp(`\\b${name}\\b`, 'i');
      if (regex.test(text)) {
        const target = new Date(now);
        const diff = (dayNum - now.getDay() + 7) % 7 || 7;
        target.setDate(target.getDate() + diff);
        scheduledDate = toLocalDateKey(target);
        dueAt = target.setHours(23, 59, 59, 999);
        text = text.replace(regex, '').trim();
        break;
      }
    }
  }

  // Extract recurrence
  let recurrence: Recurrence = { type: 'none' };
  if (/\bdaily\b/i.test(text)) {
    recurrence = { type: 'daily', interval: 1 };
    text = text.replace(/\bdaily\b/i, '').trim();
  } else if (/\bevery\s+week\b/i.test(text)) {
    recurrence = { type: 'weekly', interval: 1, days: [now.getDay()] };
    text = text.replace(/\bevery\s+week\b/i, '').trim();
  } else if (/\bweekly\b/i.test(text)) {
    recurrence = { type: 'weekly', interval: 1, days: [now.getDay()] };
    text = text.replace(/\bweekly\b/i, '').trim();
  } else if (/\bmonthly\b/i.test(text)) {
    recurrence = { type: 'monthly', interval: 1, day: now.getDate() };
    text = text.replace(/\bmonthly\b/i, '').trim();
  }

  // Clean up leftover punctuation and whitespace
  text = text.replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();

  if (!text) return null;

  return { title: text, priority, tags, dueAt, scheduledDate, estimateMinutes, recurrence };
}

export function createTaskFromParsed(parsed: ParsedTask): Task {
  const now = Date.now();
  return {
    id: uid(),
    title: parsed.title,
    notes: '',
    status: parsed.scheduledDate ? 'today' : 'inbox',
    priority: parsed.priority,
    tags: parsed.tags,
    subtasks: [],
    dueAt: parsed.dueAt,
    scheduledDate: parsed.scheduledDate,
    estimateMinutes: parsed.estimateMinutes,
    recurrence: parsed.recurrence,
    createdAt: now,
    updatedAt: now,
  };
}
