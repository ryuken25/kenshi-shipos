export function loadState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export function saveState<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function clearAll() {
  if (typeof window === "undefined") return;
  const keys = ["shipos-mission", "shipos-tasks", "shipos-blockers", "shipos-prompts", "shipos-decisions", "shipos-sprints", "shipos-streak"];
  keys.forEach(k => localStorage.removeItem(k));
}
