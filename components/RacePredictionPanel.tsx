"use client";

import { RiegelPrediction } from "../lib/types";

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "–";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface Props {
  prediction: RiegelPrediction;
}

export default function RacePredictionPanel({ prediction }: Props) {
  return (
    <div className="border-l-2 border-emerald-500/50 bg-stone-900/60 px-4 py-3 rounded-r-lg">
      <p className="text-[13px] text-stone-300">
        Predicted finish:{" "}
        <span className="text-white font-semibold">
          {formatTime(prediction.predictedTimeSecs)}
        </span>
        <span className="text-stone-500 text-[11px] ml-1.5">
          ±{prediction.confidenceRangeMinutes}m
        </span>
      </p>
    </div>
  );
}
