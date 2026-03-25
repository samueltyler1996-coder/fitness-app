import { BlockSummary, CoachSessionLog, HyroxBenchmarks, HyroxTimePrediction, IncidentType, RaceTimePredictions, RiegelPrediction, RunActual, StrengthLoadProgression, StrengthLogEntry, StrengthPrescription, TrainingBlock, TrainingWeek } from "./types";

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

// ─── Block summary (snapshot written to Firestore on completion) ──────────────

// "5:30/km" → 330 seconds. Returns null if unparseable.
function parsePaceToSecs(pace: string | null | undefined): number | null {
  if (!pace) return null;
  const match = pace.match(/^(\d+):(\d{2})/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

export function computeBlockSummary(
  weeks: TrainingWeek[],
  completedAt: string,
  incidentCount?: number,
): BlockSummary {
  const metrics = computeBlockMetrics(weeks);
  const { completionRate, completedSessions, totalSessions, byCategory } = metrics;

  // Derive run actuals from completed run sessions
  const completedRuns = weeks
    .flatMap(w => w.sessions)
    .filter(s => s.category === "Run" && s.completed);

  let totalActualKm: number | undefined;
  let longestActualRunKm: number | undefined;
  let avgEasyPaceSecs: number | undefined;

  if (completedRuns.length > 0) {
    const kms = completedRuns.map(s => (s.actual as any)?.distanceKm).filter((k): k is number => typeof k === "number");
    if (kms.length > 0) {
      totalActualKm = kms.reduce((s, k) => s + k, 0);
      longestActualRunKm = Math.max(...kms);
    }

    const easyRuns = completedRuns.filter(s => (s.prescription as any)?.type === "easy");
    const easyPaces = easyRuns
      .map(s => parsePaceToSecs((s.actual as any)?.pace))
      .filter((p): p is number => p !== null);
    if (easyPaces.length > 0) {
      avgEasyPaceSecs = Math.round(easyPaces.reduce((s, p) => s + p, 0) / easyPaces.length);
    }
  }

  return {
    completionRate,
    completedSessions,
    totalSessions,
    ...(byCategory.Run.planned > 0 && { runAdherence: byCategory.Run.rate }),
    ...(byCategory.Strength.planned > 0 && { strengthAdherence: byCategory.Strength.rate }),
    ...(byCategory.WOD.planned > 0 && { wodAdherence: byCategory.WOD.rate }),
    ...(incidentCount !== undefined && { incidentCount }),
    ...(totalActualKm !== undefined && { totalActualKm }),
    ...(longestActualRunKm !== undefined && { longestActualRunKm }),
    ...(avgEasyPaceSecs !== undefined && { avgEasyPaceSecs }),
    completedAt,
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

// ─── Progress insights (cross-block longitudinal signals) ─────────────────────

export interface ProgressSignal {
  type: "positive" | "warning" | "info";
  category: "run" | "strength" | "wod" | "adherence" | "incidents" | "coaching";
  title: string;
  detail: string;
}

// Converts seconds/km back to "M:SS/km" display string
export function secsTopace(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}/km`;
}

export function computeProgressInsights(
  completedBlocks: TrainingBlock[],
  coachHistory: CoachSessionLog[],
): ProgressSignal[] {
  const signals: ProgressSignal[] = [];
  const withSummary = completedBlocks.filter(b => b.summary).slice(0, 6); // most recent first

  // ── Run volume trend ────────────────────────────────────────────────────────
  const runVolumeBlocks = withSummary.filter(b => b.summary!.totalActualKm !== undefined);
  if (runVolumeBlocks.length >= 2) {
    const recent = runVolumeBlocks[0].summary!.totalActualKm!;
    const older = runVolumeBlocks[runVolumeBlocks.length - 1].summary!.totalActualKm!;
    if (recent > older * 1.15) {
      signals.push({ type: "positive", category: "run", title: "Run volume increasing", detail: `Up from ${Math.round(older)} km to ${Math.round(recent)} km across recent blocks.` });
    } else if (recent < older * 0.8) {
      signals.push({ type: "warning", category: "run", title: "Run volume dropping", detail: `Down from ${Math.round(older)} km to ${Math.round(recent)} km across recent blocks.` });
    } else {
      signals.push({ type: "info", category: "run", title: "Run volume stable", detail: `Averaging around ${Math.round(recent)} km per block.` });
    }
  }

  // ── Easy pace trend ─────────────────────────────────────────────────────────
  const paceBlocks = withSummary.filter(b => b.summary!.avgEasyPaceSecs !== undefined);
  if (paceBlocks.length >= 2) {
    const recentSecs = paceBlocks[0].summary!.avgEasyPaceSecs!;
    const olderSecs = paceBlocks[paceBlocks.length - 1].summary!.avgEasyPaceSecs!;
    const diffSecs = olderSecs - recentSecs; // positive = got faster
    if (diffSecs >= 10) {
      signals.push({ type: "positive", category: "run", title: "Easy pace improving", detail: `Easy runs averaging ${secsTopace(recentSecs)}, down from ${secsTopace(olderSecs)}.` });
    } else if (diffSecs <= -15) {
      signals.push({ type: "warning", category: "run", title: "Easy pace slowing", detail: `Easy runs averaging ${secsTopace(recentSecs)}, up from ${secsTopace(olderSecs)}.` });
    } else {
      signals.push({ type: "info", category: "run", title: "Easy pace consistent", detail: `Averaging ${secsTopace(recentSecs)} on easy runs.` });
    }
  }

  // ── Adherence trends ────────────────────────────────────────────────────────
  const runAdhBlocks = withSummary.filter(b => b.summary!.runAdherence !== undefined);
  if (runAdhBlocks.length >= 2) {
    const avg = runAdhBlocks.reduce((s, b) => s + b.summary!.runAdherence!, 0) / runAdhBlocks.length;
    if (avg < 0.65) {
      signals.push({ type: "warning", category: "run", title: "Run adherence low", detail: `Averaging ${Math.round(avg * 100)}% run completion across recent blocks.` });
    }
  }

  const strAdhBlocks = withSummary.filter(b => b.summary!.strengthAdherence !== undefined);
  if (strAdhBlocks.length >= 2) {
    const avg = strAdhBlocks.reduce((s, b) => s + b.summary!.strengthAdherence!, 0) / strAdhBlocks.length;
    if (avg < 0.65) {
      signals.push({ type: "warning", category: "strength", title: "Strength adherence low", detail: `Averaging ${Math.round(avg * 100)}% strength completion across recent blocks.` });
    } else if (avg >= 0.85) {
      signals.push({ type: "positive", category: "strength", title: "Strength consistency strong", detail: `Averaging ${Math.round(avg * 100)}% strength completion across recent blocks.` });
    }
  }

  // ── Incident patterns ───────────────────────────────────────────────────────
  const INCIDENT_TYPES: IncidentType[] = ["illness", "injury", "fatigue"];
  for (const itype of INCIDENT_TYPES) {
    const count = coachHistory.filter(s => s.incidentType === itype).length;
    if (count >= 2) {
      const label = itype === "missed_session" ? "missed sessions" : itype;
      signals.push({ type: "warning", category: "incidents", title: `Repeated ${label}`, detail: `${count} ${label} incidents logged across recent coach sessions.` });
    }
  }

  // ── Coaching patterns ───────────────────────────────────────────────────────
  // Sessions where coach made changes (not just acknowledged)
  const sessionsWithChanges = coachHistory.filter(s => s.changesCount > 0);
  if (sessionsWithChanges.length >= 3 && coachHistory.length >= 4) {
    const changeRate = sessionsWithChanges.length / coachHistory.length;
    if (changeRate >= 0.7) {
      signals.push({ type: "info", category: "coaching", title: "Frequent plan adjustments", detail: `${sessionsWithChanges.length} of the last ${coachHistory.length} coach sessions resulted in plan changes — the plan may need calibrating.` });
    }
  }

  // Category most often changed by coach
  const changeCounts: Record<string, number> = {};
  for (const session of coachHistory) {
    for (const change of session.changes ?? []) {
      const cat = change.toCategory ?? change.fromCategory ?? "unknown";
      if (cat) changeCounts[cat] = (changeCounts[cat] ?? 0) + 1;
    }
  }
  const topCat = Object.entries(changeCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCat && topCat[1] >= 3) {
    signals.push({ type: "info", category: "coaching", title: `${topCat[0]} sessions adjusted most`, detail: `Coach has modified ${topCat[0]} sessions ${topCat[1]} times — worth reviewing if the prescription fits.` });
  }

  return signals;
}

// ─── Strength load progression ────────────────────────────────────────────────

// Tries to parse a numeric kg/lb value out of a load string like "60kg" or "80 lbs".
function parseLoadNumber(load: string | null | undefined): number | null {
  if (!load) return null;
  const match = load.match(/(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

export function computeStrengthLoadProgression(weeks: TrainingWeek[]): StrengthLoadProgression[] {
  // Map from lowercase exercise name → aggregation state
  const map = new Map<string, {
    exerciseName: string; // original casing from first encounter
    totalStrengthSessions: number;
    loggedSessions: number;
    entries: StrengthLogEntry[];
  }>();

  weeks.forEach((week, weekIndex) => {
    for (const session of week.sessions) {
      if (session.category !== "Strength" || !session.completed) continue;

      const presc = session.prescription as StrengthPrescription;
      const mainExercises = presc?.sections?.main ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actualExercises: any[] = (session.actual as any)?.strengthExercises ?? [];

      for (const ex of mainExercises) {
        const key = ex.name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, { exerciseName: ex.name.trim(), totalStrengthSessions: 0, loggedSessions: 0, entries: [] });
        }
        const entry = map.get(key)!;
        entry.totalStrengthSessions++;

        // Find matching logged actual (case-insensitive name match)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loggedActual = actualExercises.find(
          (a: { name?: string }) => typeof a.name === "string" && a.name.trim().toLowerCase() === key
        );

        const logEntry: StrengthLogEntry = {
          weekNumber: weekIndex + 1,
          weekStartDate: week.startDate,
          sets: loggedActual?.sets ?? null,
          reps: loggedActual?.reps ?? null,
          load: loggedActual?.load ?? null,
          logged: !!loggedActual,
        };

        if (loggedActual) entry.loggedSessions++;
        entry.entries.push(logEntry);
      }
    }
  });

  const result: StrengthLoadProgression[] = [];

  for (const [, data] of map) {
    // Sort entries by weekNumber ascending
    const sortedEntries = data.entries.slice().sort((a, b) => a.weekNumber - b.weekNumber);

    // Compute trend: compare first and last entries that have a numeric load
    const numericLoads = sortedEntries
      .map(e => ({ weekNumber: e.weekNumber, value: parseLoadNumber(e.load ?? null) }))
      .filter((e): e is { weekNumber: number; value: number } => e.value !== null);

    let trend: "up" | "down" | "flat" | null = null;
    if (numericLoads.length >= 2) {
      const first = numericLoads[0].value;
      const last = numericLoads[numericLoads.length - 1].value;
      if (last > first) trend = "up";
      else if (last < first) trend = "down";
      else trend = "flat";
    }

    // maxLoad: the highest numeric load string seen
    let maxLoad: string | null = null;
    if (numericLoads.length > 0) {
      const maxValue = Math.max(...numericLoads.map(e => e.value));
      const maxEntry = sortedEntries.find(e => parseLoadNumber(e.load ?? null) === maxValue);
      maxLoad = maxEntry?.load ?? null;
    }

    result.push({
      exerciseName: data.exerciseName,
      totalStrengthSessions: data.totalStrengthSessions,
      loggedSessions: data.loggedSessions,
      entries: sortedEntries,
      maxLoad,
      trend,
    });
  }

  // Sort by exerciseName alphabetically
  result.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
  return result;
}

// ─── Race time predictions (Phase O) ─────────────────────────────────────────

/** Extracts completed run actuals from all weeks. Filters out sessions without valid distance (≥0.5 km) and parseable pace. */
export function extractRunActuals(weeks: TrainingWeek[]): RunActual[] {
  const runs: RunActual[] = [];
  for (const week of weeks) {
    for (const session of week.sessions ?? []) {
      if (session.category !== "Run" || !session.completed) continue;
      const dist = (session.actual as any)?.distanceKm;
      const pace = (session.actual as any)?.pace;
      if (!dist || typeof dist !== "number" || dist < 0.5) continue;
      const paceSecs = parsePaceToSecs(pace);
      if (!paceSecs || paceSecs <= 0) continue;
      runs.push({
        distanceKm: dist,
        paceSecs,
        effort: (session.actual as any)?.effort ?? null,
        date: week.startDate,
      });
    }
  }
  return runs;
}

/** Infers race distance in km from goal string keywords. Supports marathon (42.195), half (21.0975), 10k, 5k. Returns null for Hyrox goals or unrecognised distances. */
export function inferRaceDistanceKm(goal: string): number | null {
  const g = goal.toLowerCase();
  if (g.includes("marathon") && !g.includes("half")) return 42.195;
  if (g.includes("half") || g.includes("21.1") || g.includes("21k")) return 21.0975;
  if (g.includes("10k") || g.includes("10 k")) return 10;
  if (g.includes("5k") || g.includes("5 k")) return 5;
  return null;
}

/**
 * Riegel formula: predicted pace = avgPace × (targetDist / avgDist)^0.06
 * Uses the 3 longest logged runs. Confidence: high (3+ runs ±3%), medium (2 ±5%), low (1 ±8%).
 * Returns null if insufficient data or if the result is non-finite.
 */
export function predictRaceTimeRiegel(
  runs: RunActual[],
  targetDistanceKm: number,
): RiegelPrediction | null {
  if (!runs.length || targetDistanceKm <= 0) return null;
  const sorted = [...runs].sort((a, b) => b.distanceKm - a.distanceKm);
  const selected = sorted.slice(0, Math.min(3, sorted.length));
  const avgDistanceKm = selected.reduce((s, r) => s + r.distanceKm, 0) / selected.length;
  const avgPaceSecs = selected.reduce((s, r) => s + r.paceSecs, 0) / selected.length;
  // Riegel: predicted pace = avg pace × (D2/D1)^0.06
  if (avgDistanceKm <= 0) return null;
  const predictedPaceSecs = avgPaceSecs * Math.pow(targetDistanceKm / avgDistanceKm, 0.06);
  const predictedTimeSecs = predictedPaceSecs * targetDistanceKm;
  if (!isFinite(predictedTimeSecs) || predictedTimeSecs <= 0) return null;
  const confidenceLevel: "high" | "medium" | "low" =
    runs.length >= 3 ? "high" : runs.length === 2 ? "medium" : "low";
  const confidencePct = confidenceLevel === "high" ? 0.03 : confidenceLevel === "medium" ? 0.05 : 0.08;
  const confidenceRangeMinutes = Math.max(1, Math.round((predictedTimeSecs * confidencePct) / 60));
  return { predictedTimeSecs, confidenceLevel, confidenceRangeMinutes, sampleSize: runs.length, averageDistanceKm: avgDistanceKm, averagePaceSecs: avgPaceSecs };
}

/**
 * Hyrox projection: total = (8 × 1km pace) + sum of station benchmarks.
 * 1km pace derived from 3 most recent runs (recency matters more than distance for Hyrox).
 * Requires ≥6 of 8 station benchmarks. Returns null if insufficient data.
 */
export function predictHyroxTime(
  benchmarks: HyroxBenchmarks,
  runs: RunActual[],
): HyroxTimePrediction | null {
  if (!runs.length) return null;
  const sorted = [...runs].sort((a, b) => b.date.localeCompare(a.date));
  const selected = sorted.slice(0, Math.min(3, sorted.length));
  const oneKmPaceSecs = selected.reduce((s, r) => s + r.paceSecs, 0) / selected.length;
  const runComponentSecs = oneKmPaceSecs * 8;
  const stationKeys: (keyof HyroxBenchmarks)[] = ["skiErg","sledPush","sledPull","burpeeBroadJump","rowing","farmersCarry","sandbagLunges","wallBalls"];
  const stationTimes = stationKeys.map(k => benchmarks[k] as number).filter(v => typeof v === "number" && v > 0);
  if (stationTimes.length < 6) return null;
  const stationComponentSecs = stationTimes.reduce((s, v) => s + v, 0);
  const projectedTimeSecs = runComponentSecs + stationComponentSecs;
  if (!isFinite(projectedTimeSecs) || projectedTimeSecs <= 0) return null;
  const confidenceLevel: "high" | "medium" | "low" =
    stationTimes.length === 8 && runs.length >= 3 ? "high" : stationTimes.length >= 6 ? "medium" : "low";
  const confidencePct = confidenceLevel === "high" ? 0.05 : 0.1;
  const confidenceRangeMinutes = Math.max(1, Math.round((projectedTimeSecs * confidencePct) / 60));
  return { projectedTimeSecs, runComponentSecs, stationComponentSecs, oneKmPaceSecs, benchmarksUsed: stationTimes.length, confidenceLevel, confidenceRangeMinutes };
}

export function computeRacePredictions(
  weeks: TrainingWeek[],
  goal: string,
  hyroxBenchmarks?: HyroxBenchmarks | null,
): RaceTimePredictions {
  const runs = extractRunActuals(weeks);
  const result: RaceTimePredictions = {};
  const targetDist = inferRaceDistanceKm(goal);
  if (targetDist && runs.length >= 1) {
    const riegel = predictRaceTimeRiegel(runs, targetDist);
    if (riegel) result.riegel = riegel;
  }
  if (hyroxBenchmarks && runs.length >= 1) {
    const hyrox = predictHyroxTime(hyroxBenchmarks, runs);
    if (hyrox) result.hyrox = hyrox;
  }
  return result;
}

// ─── Progress context for AI prompts ─────────────────────────────────────────
// Produces a compact plain-text summary of the athlete's cross-block history.
// Returns empty string if there is not enough data to say anything useful.

export function formatProgressContext(
  completedBlocks: TrainingBlock[],
  coachHistory: CoachSessionLog[],
): string {
  const withSummary = completedBlocks.filter(b => b.summary).slice(0, 4);
  if (withSummary.length === 0) return "";

  const lines: string[] = ["Athlete cross-block history:"];

  // Run volume trend (oldest → newest)
  const runVol = withSummary.filter(b => b.summary!.totalActualKm !== undefined);
  if (runVol.length >= 2) {
    const kms = [...runVol].reverse().map(b => `${Math.round(b.summary!.totalActualKm!)}km`).join(" → ");
    lines.push(`- Run volume per block: ${kms}`);
  }

  // Easy pace
  const paceBlock = withSummary.find(b => b.summary!.avgEasyPaceSecs !== undefined);
  if (paceBlock) {
    lines.push(`- Easy run pace (most recent block): ${secsTopace(paceBlock.summary!.avgEasyPaceSecs!)}`);
  }

  // Longest run
  const longestBlock = withSummary.find(b => b.summary!.longestActualRunKm !== undefined);
  if (longestBlock) {
    lines.push(`- Longest run logged: ${longestBlock.summary!.longestActualRunKm!.toFixed(1)}km`);
  }

  // Adherence averages
  const runAdh = withSummary.filter(b => b.summary!.runAdherence !== undefined);
  if (runAdh.length >= 1) {
    const avg = Math.round(runAdh.reduce((s, b) => s + b.summary!.runAdherence!, 0) / runAdh.length * 100);
    lines.push(`- Run adherence average: ${avg}%`);
  }
  const strAdh = withSummary.filter(b => b.summary!.strengthAdherence !== undefined);
  if (strAdh.length >= 1) {
    const avg = Math.round(strAdh.reduce((s, b) => s + b.summary!.strengthAdherence!, 0) / strAdh.length * 100);
    lines.push(`- Strength adherence average: ${avg}%`);
  }

  // Overall completion
  const rates = withSummary.map(b => b.summary!.completionRate);
  const avgCompletion = Math.round(rates.reduce((s, r) => s + r, 0) / rates.length * 100);
  lines.push(`- Overall completion average: ${avgCompletion}%`);

  // Incident history
  const incidentCounts: Partial<Record<IncidentType, number>> = {};
  for (const s of coachHistory) {
    if (s.incidentType && s.incidentType !== "general") {
      incidentCounts[s.incidentType] = (incidentCounts[s.incidentType] ?? 0) + 1;
    }
  }
  const incidentSummary = Object.entries(incidentCounts)
    .map(([t, c]) => `${t.replace("_", " ")} x${c}`)
    .join(", ");
  if (incidentSummary) lines.push(`- Logged incidents: ${incidentSummary}`);

  // Most-adjusted category
  const changeCounts: Record<string, number> = {};
  for (const session of coachHistory) {
    for (const change of session.changes ?? []) {
      const cat = change.toCategory ?? change.fromCategory;
      if (cat) changeCounts[cat] = (changeCounts[cat] ?? 0) + 1;
    }
  }
  const topCat = Object.entries(changeCounts).sort((a, b) => b[1] - a[1])[0];
  if (topCat && topCat[1] >= 2) {
    lines.push(`- Most coach-adjusted session type: ${topCat[0]} (${topCat[1]} times)`);
  }

  return lines.join("\n");
}
