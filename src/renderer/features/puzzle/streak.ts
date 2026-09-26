/** Today's date as 'YYYY-MM-DD', in the local timezone (matches what the player experiences as "today"). */
export function todayString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / msPerDay);
}

/**
 * Next streak count given the last day a puzzle was solved and today's date.
 * Solving again the same day doesn't change the streak; solving the day right after extends it;
 * any bigger gap (or solving "in the past" somehow) resets to 1.
 */
export function nextStreak(lastSolvedDate: string | null, today: string, currentStreak: number): number {
  if (lastSolvedDate === today) return currentStreak;
  if (lastSolvedDate === null) return 1;
  return daysBetween(lastSolvedDate, today) === 1 ? currentStreak + 1 : 1;
}
