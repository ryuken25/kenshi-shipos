export interface ScoreInput {
  completedTasks: number;
  focusMinutes: number;
  resolvedBlockers: number;
  shipLogCopied: boolean;
  openHighBlockers: number;
}

export function calcShipScore(i: ScoreInput): number {
  let score = 0;
  score += i.completedTasks * 10;
  score += Math.min(i.focusMinutes, 120);
  score += i.resolvedBlockers * 15;
  if (i.shipLogCopied) score += 10;
  score -= i.openHighBlockers * 5;
  return Math.max(0, score);
}
