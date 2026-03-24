import { TrainingBlock } from "../lib/types";
import { getDaysToRace } from "../lib/race";

interface Props {
  eventDate: string;
  activeBlock: TrainingBlock | null;
  onViewBriefing: () => void;
}

export default function RaceWeekCard({ eventDate, activeBlock, onViewBriefing }: Props) {
  const daysToRace = getDaysToRace(eventDate);

  if (daysToRace === null) return null;

  // Post-race
  if (daysToRace < 0) {
    return (
      <div className="bg-stone-900 border border-emerald-500/20 rounded-xl px-5 py-6 mb-4">
        <p className="text-[10px] tracking-[0.2em] uppercase text-emerald-500/60 mb-2">YOU DID IT</p>
        <p className="text-xl font-black text-white tracking-tight">Race complete</p>
        <p className="text-[12px] text-stone-500 mt-1">Time to recover and reflect on what you built.</p>
      </div>
    );
  }

  // Race day
  if (daysToRace === 0) {
    return (
      <div className="bg-stone-900 border border-emerald-500/20 rounded-xl px-5 py-6 mb-4">
        <p className="text-[10px] tracking-[0.2em] uppercase text-emerald-500 mb-3">RACE DAY</p>
        <p
          className="font-display font-black text-emerald-400 leading-none tracking-tight mb-4"
          style={{ fontSize: "clamp(48px, 14vw, 64px)" }}
        >
          TODAY
        </p>
        <button
          onClick={onViewBriefing}
          className="text-[12px] tracking-[0.1em] uppercase text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/50 rounded-lg px-4 py-2.5 transition-colors"
        >
          View race morning briefing →
        </button>
      </div>
    );
  }

  // Race week (1–7 days)
  const totalTaperDays = 7;
  const taperProgress = Math.round(((totalTaperDays - daysToRace) / totalTaperDays) * 100);

  return (
    <div className="bg-stone-900 border border-emerald-500/20 rounded-xl px-5 py-6 mb-4">
      <p className="text-[10px] tracking-[0.2em] uppercase text-emerald-500 mb-3">RACE WEEK</p>

      <div className="flex items-end gap-3 mb-4">
        <p
          className="font-display font-black text-emerald-500 leading-none tracking-tight"
          style={{ fontSize: "clamp(56px, 16vw, 72px)" }}
        >
          {daysToRace}
        </p>
        <div className="pb-2">
          <p className="text-[10px] tracking-[0.2em] uppercase text-stone-500">DAYS</p>
          {activeBlock && (
            <p className="text-[11px] text-stone-400 mt-0.5">{activeBlock.primaryGoal}</p>
          )}
        </div>
      </div>

      <p className="text-[13px] text-stone-400 leading-relaxed mb-4">
        Trust your training. Rest is your weapon.
      </p>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[9px] tracking-[0.15em] uppercase text-stone-600">Taper progress</p>
          <p className="text-[9px] tracking-[0.1em] text-stone-600">{taperProgress}%</p>
        </div>
        <div className="w-full h-[3px] bg-stone-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${taperProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
