import { TrainingBlock, TrainingWeek } from "../lib/types";

interface Props {
  block: TrainingBlock;
  weeks: TrainingWeek[];
  goal: string;
  eventDate: string;
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function shortDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function ActiveBlock({ block, weeks, goal, eventDate }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentWeekIndex = weeks.findIndex((w) => {
    const s = new Date(w.startDate + "T00:00:00");
    const e = new Date(w.endDate + "T00:00:00");
    return today >= s && today <= e;
  });
  const currentWeekNumber = currentWeekIndex >= 0 ? currentWeekIndex + 1 : null;

  const trainingSessions = weeks
    .flatMap((w) => w.sessions)
    .filter((s) => s.category && s.category !== "Rest");
  const done = trainingSessions.filter((s) => s.completed).length;
  const total = trainingSessions.length;

  const daysToRace = daysUntil(eventDate);

  return (
    <div className="py-5 border-t border-stone-100">
      <div className="flex items-start justify-between mb-4">
        <div>
          {goal && (
            <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-1">{goal}</p>
          )}
          <h2 className="text-base font-bold tracking-tight">{block.name}</h2>
        </div>

        {daysToRace !== null && daysToRace > 0 && (
          <div className="text-right">
            <p className="text-3xl font-black tabular-nums leading-none">{daysToRace}</p>
            <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400 mt-0.5">days</p>
          </div>
        )}
        {daysToRace === 0 && (
          <p className="text-sm font-bold text-emerald-600">Race day</p>
        )}
        {daysToRace !== null && daysToRace < 0 && (
          <p className="text-[11px] text-stone-400">Completed</p>
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        {currentWeekNumber ? (
          <p className="text-[11px] text-stone-500">
            Week <span className="font-bold text-stone-900">{currentWeekNumber}</span> of {weeks.length}
          </p>
        ) : (
          <p className="text-[11px] text-stone-400">—</p>
        )}
        <p className="text-[11px] text-stone-400">{done}/{total} sessions</p>
      </div>

      <div className="flex gap-[3px]">
        {weeks.map((w) => {
          const s = new Date(w.startDate + "T00:00:00");
          const e = new Date(w.endDate + "T00:00:00");
          const isCurrent = today >= s && today <= e;
          const isPast = e < today;
          return (
            <div
              key={w.id}
              className={`h-[5px] flex-1 rounded-sm ${
                isPast ? "bg-stone-800" : isCurrent ? "bg-stone-400" : "bg-stone-100"
              }`}
            />
          );
        })}
      </div>

      {eventDate && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-[10px] text-stone-400">
            {shortDate(block.startDate)} → {shortDate(block.endDate)}
          </p>
          <p className="text-[10px] text-stone-500 font-medium">
            ↗ {new Date(eventDate + "T00:00:00").toLocaleDateString("en-GB", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </p>
        </div>
      )}
    </div>
  );
}
