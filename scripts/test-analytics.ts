import { computeInsights, computeBlockMetrics } from "../lib/analytics";
import { TrainingWeek } from "../lib/types";

// Today is 2026-03-21. We need past weeks (endDate < today).
// Build 4 completed weeks ending before today.

function makeWeek(id: string, startDate: string, endDate: string, sessions: any[]): TrainingWeek {
  return { id, startDate, endDate, sessions } as TrainingWeek;
}

function session(id: string, day: string, category: string, completed: boolean, prescription: any = {}, actual: any = {}) {
  return { id, day, category, completed, prescription, actual, aiGenerated: true, manuallyModified: false };
}

// Week 1: 2026-02-23 → 2026-03-01 — good week, mostly completed
const w1 = makeWeek("w1", "2026-02-23", "2026-03-01", [
  session("s1", "Monday",    "Run",      true,  { type: "intervals", distanceKm: 8 }, { distanceKm: 7.5, effort: "hard" }),
  session("s2", "Tuesday",   "Rest",     false),
  session("s3", "Wednesday", "Strength", true,  { focus: "upper" }),
  session("s4", "Thursday",  "WOD",      true,  { format: "amrap" }),
  session("s5", "Friday",    "Run",      true,  { type: "easy", distanceKm: 6 }, { distanceKm: 5.8, effort: "easy" }),
  session("s6", "Saturday",  "Run",      false, { type: "long", distanceKm: 14 }),
  session("s7", "Sunday",    "Rest",     false),
]);

// Week 2: 2026-03-02 → 2026-03-08 — strength kept being skipped
const w2 = makeWeek("w2", "2026-03-02", "2026-03-08", [
  session("s8",  "Monday",    "Run",      true,  { type: "tempo",     distanceKm: 9 }, { distanceKm: 8, effort: "moderate" }),
  session("s9",  "Tuesday",   "Rest",     false),
  session("s10", "Wednesday", "Strength", false, { focus: "lower" }),   // skipped
  session("s11", "Thursday",  "WOD",      true,  { format: "for_time" }),
  session("s12", "Friday",    "Run",      true,  { type: "easy",      distanceKm: 7 }, { distanceKm: 5, effort: "easy" }),
  session("s13", "Saturday",  "Run",      false, { type: "long",      distanceKm: 15 }), // skipped
  session("s14", "Sunday",    "Rest",     false),
]);

// Week 3: 2026-03-09 → 2026-03-15 — low completion week (only 2/5)
const w3 = makeWeek("w3", "2026-03-09", "2026-03-15", [
  session("s15", "Monday",    "Run",      false, { type: "intervals", distanceKm: 9 }),  // skipped
  session("s16", "Tuesday",   "Rest",     false),
  session("s17", "Wednesday", "Strength", false, { focus: "full" }),    // skipped again
  session("s18", "Thursday",  "WOD",      true,  { format: "emom" }),
  session("s19", "Friday",    "Run",      false, { type: "tempo",     distanceKm: 8 }),  // skipped
  session("s20", "Saturday",  "Run",      true,  { type: "long",      distanceKm: 12 }, { distanceKm: 9, effort: "moderate" }),
  session("s21", "Sunday",    "Rest",     false),
]);

// Week 4: 2026-03-16 → 2026-03-22 — current week (endDate >= today, should be excluded from insights)
const w4 = makeWeek("w4", "2026-03-16", "2026-03-22", [
  session("s22", "Monday",    "Run",      true,  { type: "intervals", distanceKm: 8 }, { distanceKm: 8, effort: "hard" }),
  session("s23", "Wednesday", "Strength", false, { focus: "upper" }),
  session("s24", "Thursday",  "WOD",      false, { format: "amrap" }),
  session("s25", "Saturday",  "Run",      false, { type: "tempo",     distanceKm: 10 }),
  session("s26", "Sunday",    "Rest",     false),
]);

const weeks = [w1, w2, w3, w4];

console.log("=== Block metrics ===");
const metrics = computeBlockMetrics(weeks);
console.log(`Overall: ${metrics.completedSessions}/${metrics.totalSessions} (${Math.round(metrics.completionRate * 100)}%)`);
console.log("By category:");
for (const [cat, s] of Object.entries(metrics.byCategory)) {
  if (s.planned > 0) console.log(`  ${cat}: ${s.completed}/${s.planned} (${Math.round(s.rate * 100)}%)`);
}
console.log("Run comparisons:", metrics.runComparisons.length);

console.log("\n=== Insight signals (lookback 3 past weeks) ===");
const insights = computeInsights(weeks, 4);
if (insights.length === 0) {
  console.log("No signals generated.");
} else {
  insights.forEach(s => console.log(`[${s.type}]${s.category ? ` [${s.category}]` : ""} ${s.message}`));
}
