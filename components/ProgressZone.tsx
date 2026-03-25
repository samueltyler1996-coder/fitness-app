"use client";

import { TrainingBlock, TrainingWeek, CoachSessionLog, HyroxBenchmarks, RaceTimePredictions } from "../lib/types";
import ReviewView from "./ReviewView";
import ProgressView from "./ProgressView";

interface Props {
  activeBlock: TrainingBlock | null;
  weeks: TrainingWeek[];
  completedBlocks: TrainingBlock[];
  coachHistory: CoachSessionLog[];
  hyroxBenchmarks: HyroxBenchmarks | null;
  racePredictions?: RaceTimePredictions;
}

export default function ProgressZone({ activeBlock, weeks, completedBlocks, coachHistory, hyroxBenchmarks, racePredictions }: Props) {
  return (
    <div className="min-h-screen bg-[#f8f6f3] px-5 pt-10 pb-8">

      {/* Current block review */}
      {activeBlock && weeks.length > 0 && (
        <div className="mb-10">
          <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-6">This block</p>
          <ReviewView activeBlock={activeBlock} weeks={weeks} />
        </div>
      )}

      {/* Cross-block progress */}
      <div className={activeBlock && weeks.length > 0 ? "border-t border-stone-200 pt-8" : ""}>
        <ProgressView completedBlocks={completedBlocks} coachHistory={coachHistory} hyroxBenchmarks={hyroxBenchmarks} racePredictions={racePredictions} />
      </div>
    </div>
  );
}
