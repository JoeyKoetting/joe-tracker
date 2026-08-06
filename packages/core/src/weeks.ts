import type { WeeklyPoint } from "./types";

/** Academic job-market season starts at ISO week 31 (early August). */
export const ACADEMIC_START_WEEK = 31;

export function isoWeek(date: Date): number {
  // Copy of Date.prototype.getISOWeek via UTC Thursday trick
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function isoWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d.getUTCFullYear();
}

export function academicYearFor(date: Date, startWeek = ACADEMIC_START_WEEK): number {
  const week = isoWeek(date);
  const year = isoWeekYear(date);
  return week < startWeek ? year - 1 : year;
}

export function adjustedWeek(week: number, startWeek = ACADEMIC_START_WEEK): number {
  return week >= startWeek ? week - startWeek + 1 : week + (52 - startWeek + 1);
}

export function calendarWeekFromAdjusted(
  adjusted: number,
  startWeek = ACADEMIC_START_WEEK,
): number {
  return adjusted + startWeek - 1;
}

/**
 * Build cumulative + rolling-4wk series from a flat list of (academicYear, adjustedWeek, count).
 * Optionally interpolate the in-progress academic year's current week.
 */
export function buildWeeklySeries(
  rows: { year: number; week: number; count: number }[],
  options: {
    interpolate?: boolean;
    now?: Date;
    startWeek?: number;
  } = {},
): WeeklyPoint[] {
  const startWeek = options.startWeek ?? ACADEMIC_START_WEEK;
  const now = options.now ?? new Date();
  const byYear = new Map<number, Map<number, number>>();

  for (const row of rows) {
    let weeks = byYear.get(row.year);
    if (!weeks) {
      weeks = new Map();
      byYear.set(row.year, weeks);
    }
    weeks.set(row.week, (weeks.get(row.week) ?? 0) + row.count);
  }

  if (options.interpolate) {
    const currentAcademic = academicYearFor(now, startWeek);
    const currentIso = isoWeek(now);
    const adj = adjustedWeek(currentIso, startWeek);
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // Mon=1..Sun=7
    const fraction = dayOfWeek / 7;
    const weeks = byYear.get(currentAcademic);
    if (weeks && fraction > 0 && fraction < 1) {
      const current = weeks.get(adj) ?? 0;
      if (current > 0) {
        weeks.set(adj, current / fraction);
      }
    }
  }

  const points: WeeklyPoint[] = [];
  for (const [year, weeks] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...weeks.entries()].sort((a, b) => a[0] - b[0]);
    let cumulative = 0;
    const recent: number[] = [];
    for (const [week, count] of sorted) {
      cumulative += count;
      recent.push(count);
      if (recent.length > 4) recent.shift();
      const rolling4wk = recent.reduce((a, b) => a + b, 0);
      points.push({ year, week, count, cumulative, rolling4wk });
    }
  }
  return points;
}

export function yearsInSeries(points: WeeklyPoint[]): number[] {
  return [...new Set(points.map((p) => p.year))].sort((a, b) => a - b);
}
