"use client";

import { HyroxTimePrediction } from "../lib/types";

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "–";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Props {
  prediction: HyroxTimePrediction;
}

export default function HyroxPredictionCard({ prediction }: Props) {
  const confidenceBadge =
    prediction.confidenceLevel === "high"
      ? "text-violet-700 bg-violet-50"
      : prediction.confidenceLevel === "medium"
      ? "text-amber-700 bg-amber-50"
      : "text-stone-500 bg-stone-100";

  const confidenceLabel =
    prediction.confidenceLevel === "high"
      ? "High confidence"
      : prediction.confidenceLevel === "medium"
      ? "Moderate confidence"
      : "Low confidence";

  const paceMin = Math.floor(prediction.oneKmPaceSecs / 60);
  const paceSec = Math.round(prediction.oneKmPaceSecs % 60);

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-violet-500">Hyrox projection</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${confidenceBadge}`}>
          {confidenceLabel}
        </span>
      </div>

      <p className="text-3xl font-black text-stone-900 tracking-tight">
        {formatTime(prediction.projectedTimeSecs)}
      </p>

      <div className="flex flex-col gap-0.5 text-[11px] text-stone-500">
        <p>Run: {formatTime(prediction.runComponentSecs)} (8 × 1 km @ {paceMin}:{String(paceSec).padStart(2, "0")}/km)</p>
        <p>Stations: {formatTime(prediction.stationComponentSecs)} ({prediction.benchmarksUsed}/8 benchmarks)</p>
      </div>

      <p className="text-[10px] text-stone-400">±{prediction.confidenceRangeMinutes} min range</p>
    </div>
  );
}
