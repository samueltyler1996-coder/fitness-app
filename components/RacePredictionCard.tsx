"use client";

import { RiegelPrediction } from "../lib/types";

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "–";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface Props {
  prediction: RiegelPrediction;
}

export default function RacePredictionCard({ prediction }: Props) {
  const confidenceBadge =
    prediction.confidenceLevel === "high"
      ? "text-emerald-700 bg-emerald-50"
      : prediction.confidenceLevel === "medium"
      ? "text-amber-700 bg-amber-50"
      : "text-stone-500 bg-stone-100";

  const confidenceLabel =
    prediction.confidenceLevel === "high"
      ? "High confidence"
      : prediction.confidenceLevel === "medium"
      ? "Moderate confidence"
      : "Low confidence";

  const avgPaceMin = Math.floor(prediction.averagePaceSecs / 60);
  const avgPaceSec = Math.round(prediction.averagePaceSecs % 60);
  const paceStr = `${avgPaceMin}:${String(avgPaceSec).padStart(2, "0")}/km`;

  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-stone-400">Predicted finish</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${confidenceBadge}`}>
          {confidenceLabel}
        </span>
      </div>

      <p className="text-3xl font-black text-stone-900 tracking-tight">
        {formatTime(prediction.predictedTimeSecs)}
      </p>

      <p className="text-[11px] text-stone-500">
        ±{prediction.confidenceRangeMinutes} min · based on {prediction.sampleSize} run{prediction.sampleSize !== 1 ? "s" : ""} · avg {paceStr} over {prediction.averageDistanceKm.toFixed(1)} km
      </p>

      {prediction.sampleSize < 3 && (
        <div className="mt-1">
          <div className="flex justify-between text-[10px] text-stone-400 mb-1">
            <span>Building confidence</span>
            <span>{prediction.sampleSize}/3 runs</span>
          </div>
          <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full"
              style={{ width: `${(prediction.sampleSize / 3) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
