import { TrainingWeek } from "./types";

const CATS = ["Run", "Strength", "WOD"] as const;
type Cat = "Run" | "Strength" | "WOD";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryStats {
  planned: number;
  completed: number;
  rate: number; // 0–1
}

export interface RunComparison {
  weekId: string;
  weekStartDate: string;
  day: string;
  plannedKm: number | null;
  actualKm: number | null;
  plannedPace: string | null;
  actualPace: string | null;
  effort: string | null;
}

export interface WeekMetrics {
  weekId: string;
  startDate: string;
  endDate: string;
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  byCategory: Record<Cat, CategoryStats>;
  runComparisons: RunComparison[];
}

export interface BlockMetrics {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  byCategory: Record<Cat, CategoryStats>;
  weekMetrics: WeekMetrics[];
  runComparisons: RunComparison[];
}

export interface InsightSignal {
  type: "warning" | "positive" | "info";
  message: string;
  category?: Cat;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyCats(): Record<Cat, CategoryStats> {
  return {
    Run: { planned: 0, completed: 0, rate: 0 },
    Strength: { planned: 0, completed: 0, rate: 0 },
    WOD: { planned: 0, completed: 0, rate: 0 },
  };
}

// ─── Week metrics ─────────────────────────────────────────────────────────────

export function computeWeekMetrics(week: TrainingWeek): WeekMetrics {
  const byCategory = emptyCats();
  let totalSessions = 0;
  let completedSessions = 0;
  const runComparisons: RunComparison[] = [];

  for (const s of week.sessions) {
    if (!s.category || s.category === "Rest") continue;
    totalSessions++;
    if (s.completed) completedSessions++;

    if ((CATS as readonly string[]).includes(s.category)) {
      const cat = s.category as Cat;
      byCategory[cat].planned++;
      if (s.completed) byCategory[cat].completed++;
    }

    if (s.category === "Run" && s.completed) {
      const p = s.prescription as any;
      const a = s.actual as any;
      runComparisons.push({
        weekId: week.id,
        weekStartDate: week.startDate,
        day: s.day,
        plannedKm: p?.distanceKm ?? null,
        actualKm: a?.distanceKm ?? null,
        plannedPace: p?.targetPace ?? null,
        actualPace: a?.pace ?? null,
        effort: a?.effort ?? null,
      });
    }
  }

  for (const cat of CATS) {
    const c = byCategory[cat];
    c.rate = c.planned > 0 ? c.completed / c.planned : 0;
  }

  return {
    weekId: week.id,
    startDate: week.startDate,
    endDate: week.endDate,
    totalSessions,
    completedSessions,
    completionRate: totalSessions > 0 ? completedSessions / totalSessions : 0,
    byCategory,
    runComparisons,
  };
}

// ─── Block metrics ────────────────────────────────────────────────────────────

export function computeBlockMetrics(weeks: TrainingWeek[]): BlockMetrics {
  const weekMetrics = weeks.map(computeWeekMetrics);
  const byCategory = emptyCats();
  let totalSessions = 0;
  let completedSessions = 0;
  const runComparisons: RunComparison[] = [];

  for (const wm of weekMetrics) {
    totalSessions += wm.totalSessions;
    completedSessions += wm.completedSessions;
    runComparisons.push(...wm.runComparisons);
    for (const cat of CATS) {
      byCategory[cat].planned += wm.byCategory[cat].planned;
      byCategory[cat].completed += wm.byCategory[cat].completed;
    }
  }

  for (const cat of CATS) {
    const c = byCategory[cat];
    c.rate = c.planned > 0 ? c.completed / c.planned : 0;
  }

  return {
    totalSessions,
    completedSessions,
    completionRate: totalSessions > 0 ? completedSessions / totalSessions : 0,
    byCategory,
    weekMetrics,
    runComparisons,
  };
}

// ─── Insight signals ──────────────────────────────────────────────────────────
// Looks at recent completed weeks and surfaces actionable patterns.

export function computeInsights(weeks: TrainingWeek[], lookbackWeeks = 4): InsightSignal[] {
  const todayStr = new Date().toISOString().split("T")[0];
  const pastWeeks = weeks.filter(w => w.endDate < todayStr);
  const recent = pastWeeks.slice(-lookbackWeeks);

  if (recent.length === 0) return [];

  const signals: InsightSignal[] = [];

  // Per-category missed session patterns
  for (const cat of CATS) {
    const weeksWithCat = recent.filter(w =>
      w.sessions.some(s => s.category === cat)
    );
    if (weeksWithCat.length < 2) continue;

    const missedWeeks = weeksWithCat.filter(w =>
      w.sessions.filter(s => s.category === cat).some(s => !s.completed)
    );
    const missRate = missedWeeks.length / weeksWithCat.length;

    if (missRate >= 0.5) {
      signals.push({
        type: "warning",
        category: cat,
        message: `${cat} sessions missed in ${missedWeeks.length} of the last ${weeksWithCat.length} weeks.`,
      });
    } else if (missRate === 0 && weeksWithCat.length >= 3) {
      signals.push({
        type: "positive",
        category: cat,
        message: `${cat} consistency is strong — ${weeksWithCat.length} weeks in a row.`,
      });
    }
  }

  // Overall completion trend
  const recentMetrics = recent.map(computeWeekMetrics);
  const avgRate = recentMetrics.reduce((s, m) => s + m.completionRate, 0) / recentMetrics.length;

  if (avgRate < 0.5 && recent.length >= 2) {
    signals.push({
      type: "warning",
      message: `Overall completion averaging ${Math.round(avgRate * 100)}% recently — worth considering a lighter week.`,
    });
  } else if (avgRate >= 0.85 && recent.length >= 3) {
    signals.push({
      type: "positive",
      message: `${Math.round(avgRate * 100)}% completion over the last ${recent.length} weeks — strong block.`,
    });
  }

  // Run km shortfall pattern
  const runComps = recentMetrics
    .flatMap(m => m.runComparisons)
    .filter(r => r.plannedKm != null && r.actualKm != null);

  if (runComps.length >= 3) {
    const shortfalls = runComps.filter(r => r.actualKm! < r.plannedKm! * 0.85);
    if (shortfalls.length / runComps.length >= 0.6) {
      signals.push({
        type: "info",
        category: "Run",
        message: `Runs are consistently coming in shorter than planned. Target distances may need adjusting.`,
      });
    }
  }

  return signals;
}
