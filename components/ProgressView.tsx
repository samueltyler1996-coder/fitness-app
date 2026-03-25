"use client";

import { TrainingBlock, CoachSessionLog, HyroxBenchmarks, RaceTimePredictions } from "../lib/types";
import { computeProgressInsights, secsTopace, ProgressSignal } from "../lib/analytics";
import RacePredictionCard from "./RacePredictionCard";
import HyroxPredictionCard from "./HyroxPredictionCard";

interface Props {
  completedBlocks: TrainingBlock[];
  coachHistory: CoachSessionLog[];
  hyroxBenchmarks: HyroxBenchmarks | null;
  racePredictions?: RaceTimePredictions;
}

const CATEGORY_COLORS: Record<ProgressSignal["category"], string> = {
  run: "bg-blue-50 border-blue-100 text-blue-700",
  strength: "bg-amber-50 border-amber-100 text-amber-700",
  wod: "bg-violet-50 border-violet-100 text-violet-700",
  adherence: "bg-stone-50 border-stone-100 text-stone-600",
  incidents: "bg-red-50 border-red-100 text-red-700",
  coaching: "bg-stone-50 border-stone-100 text-stone-600",
};

const SIGNAL_ICONS: Record<ProgressSignal["type"], string> = {
  positive: "↑",
  warning: "↓",
  info: "→",
};

function SignalCard({ signal }: { signal: ProgressSignal }) {
  const colors = CATEGORY_COLORS[signal.category];
  const icon = SIGNAL_ICONS[signal.type];
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors}`}>
      <div className="flex items-start gap-2">
        <span className="text-[13px] font-bold leading-tight shrink-0 mt-0.5">{icon}</span>
        <div>
          <p className="text-[12px] font-semibold leading-snug">{signal.title}</p>
          <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{signal.detail}</p>
        </div>
      </div>
    </div>
  );
}

function secsToMmss(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const HYROX_STATION_LABELS: { key: keyof Omit<HyroxBenchmarks, "weightCategory" | "lastUpdated">; label: string; isReps: boolean }[] = [
  { key: "skiErg",          label: "SkiErg 1000m",          isReps: false },
  { key: "sledPush",        label: "Sled Push 50m",          isReps: false },
  { key: "sledPull",        label: "Sled Pull 50m",          isReps: false },
  { key: "burpeeBroadJump", label: "Burpee Broad Jump 80m",  isReps: false },
  { key: "rowing",          label: "Rowing 1000m",           isReps: false },
  { key: "farmersCarry",    label: "Farmer's Carry 200m",    isReps: false },
  { key: "sandbagLunges",   label: "Sandbag Lunges 100m",    isReps: false },
  { key: "wallBalls",       label: "Wall Balls (reps/2min)", isReps: true  },
];

export default function ProgressView({ completedBlocks, coachHistory, hyroxBenchmarks, racePredictions }: Props) {
  const withSummary = completedBlocks.filter(b => b.summary);

  if (withSummary.length === 0) {
    return (
      <div className="flex flex-col gap-4 pt-4">
        <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">Progress</p>
        {(racePredictions?.riegel || racePredictions?.hyrox) && (
          <div className="flex flex-col gap-3">
            <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400">Race Prediction</p>
            {racePredictions.riegel && <RacePredictionCard prediction={racePredictions.riegel} />}
            {racePredictions.hyrox && <HyroxPredictionCard prediction={racePredictions.hyrox} />}
          </div>
        )}
        {hyroxBenchmarks && (
          <div className="flex flex-col gap-3">
            <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400">Hyrox Benchmarks</p>
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-wide text-violet-500 font-semibold capitalize">{hyroxBenchmarks.weightCategory}</p>
                <p className="text-[9px] text-stone-400">
                  Updated {new Date(hyroxBenchmarks.lastUpdated).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              {HYROX_STATION_LABELS.map(st => (
                <div key={st.key} className="flex items-center justify-between">
                  <p className="text-[11px] text-stone-600">{st.label}</p>
                  <p className="text-[11px] font-semibold text-stone-800 tabular-nums">
                    {st.isReps ? `${hyroxBenchmarks[st.key]} reps` : secsToMmss(hyroxBenchmarks[st.key] as number)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {!racePredictions?.riegel && !racePredictions?.hyrox && !hyroxBenchmarks && (
          <p className="text-sm text-stone-400">Complete your first training block to start seeing progress trends here.</p>
        )}
      </div>
    );
  }

  const signals = computeProgressInsights(completedBlocks, coachHistory);
  const runSignals = signals.filter(s => s.category === "run");
  const strengthSignals = signals.filter(s => s.category === "strength");
  const incidentSignals = signals.filter(s => s.category === "incidents");
  const coachSignals = signals.filter(s => s.category === "coaching" || s.category === "adherence");

  // Block-level run volume for the sparkline-style row
  const runVolumeRows = withSummary
    .filter(b => b.summary!.totalActualKm !== undefined)
    .slice(0, 5)
    .reverse(); // oldest first for visual trend

  const maxKm = Math.max(...runVolumeRows.map(b => b.summary!.totalActualKm!), 1);

  return (
    <div className="flex flex-col gap-6 pt-4">
      <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">Progress</p>

      {/* Run trends */}
      {(runSignals.length > 0 || runVolumeRows.length > 0) && (
        <div className="flex flex-col gap-3">
          <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400">Running</p>

          {/* Volume bar chart */}
          {runVolumeRows.length >= 2 && (
            <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-stone-400 mb-3">Total km per block</p>
              <div className="flex items-end gap-2 h-12">
                {runVolumeRows.map((b, i) => {
                  const km = b.summary!.totalActualKm!;
                  const height = Math.round((km / maxKm) * 100);
                  const isLatest = i === runVolumeRows.length - 1;
                  return (
                    <div key={b.id} className="flex-1 flex flex-col items-center gap-1">
                      <p className="text-[9px] text-stone-400 tabular-nums">{Math.round(km)}</p>
                      <div
                        className={`w-full rounded-sm transition-all ${isLatest ? "bg-blue-500" : "bg-blue-200"}`}
                        style={{ height: `${Math.max(height, 8)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] text-stone-300 mt-2 text-right">oldest → latest</p>
            </div>
          )}

          {/* Easy pace if available */}
          {withSummary[0]?.summary?.avgEasyPaceSecs && (
            <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3 flex items-center justify-between">
              <p className="text-[11px] text-stone-500">Avg easy pace (last block)</p>
              <p className="text-sm font-bold text-stone-800">{secsTopace(withSummary[0].summary.avgEasyPaceSecs)}</p>
            </div>
          )}

          {runSignals.map((s, i) => <SignalCard key={i} signal={s} />)}
        </div>
      )}

      {/* Strength trends */}
      {strengthSignals.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400">Strength</p>
          {strengthSignals.map((s, i) => <SignalCard key={i} signal={s} />)}
        </div>
      )}

      {/* Incident history */}
      <div className="flex flex-col gap-3">
        <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400">Incidents & interruptions</p>
        {incidentSignals.length > 0
          ? incidentSignals.map((s, i) => <SignalCard key={i} signal={s} />)
          : <p className="text-[11px] text-stone-400">No repeated incidents logged.</p>
        }

        {/* Recent incident log */}
        {coachHistory.filter(s => s.incidentType && s.incidentType !== "general").length > 0 && (
          <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3 flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-wide text-stone-400 mb-1">Incident log</p>
            {coachHistory
              .filter(s => s.incidentType && s.incidentType !== "general")
              .slice(0, 5)
              .map(s => {
                const date = new Date(s.appliedAt.seconds * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                return (
                  <div key={s.id} className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-stone-500 capitalize">{s.incidentType?.replace("_", " ")}</span>
                    <span className="text-[10px] text-stone-400 shrink-0">{date}</span>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Coaching patterns */}
      {coachSignals.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400">Coaching patterns</p>
          {coachSignals.map((s, i) => <SignalCard key={i} signal={s} />)}
        </div>
      )}

      {/* Race Predictions */}
      {(racePredictions?.riegel || racePredictions?.hyrox) && (
        <div className="flex flex-col gap-3">
          <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400">Race Prediction</p>
          {racePredictions.riegel && <RacePredictionCard prediction={racePredictions.riegel} />}
          {racePredictions.hyrox && <HyroxPredictionCard prediction={racePredictions.hyrox} />}
        </div>
      )}

      {/* Hyrox Benchmarks */}
      {hyroxBenchmarks && (
        <div className="flex flex-col gap-3">
          <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400">Hyrox Benchmarks</p>
          <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase tracking-wide text-violet-500 font-semibold capitalize">{hyroxBenchmarks.weightCategory}</p>
              <p className="text-[9px] text-stone-400">
                Updated {new Date(hyroxBenchmarks.lastUpdated).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            {HYROX_STATION_LABELS.map(st => (
              <div key={st.key} className="flex items-center justify-between">
                <p className="text-[11px] text-stone-600">{st.label}</p>
                <p className="text-[11px] font-semibold text-stone-800 tabular-nums">
                  {st.isReps ? `${hyroxBenchmarks[st.key]} reps` : secsToMmss(hyroxBenchmarks[st.key] as number)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
