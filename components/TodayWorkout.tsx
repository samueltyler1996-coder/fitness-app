import { Session } from "../lib/types";

interface Props {
  session: Session | null;
}

const RUN_TYPE: Record<string, string> = {
  easy: "Easy Run",
  tempo: "Tempo Run",
  long: "Long Run",
  intervals: "Intervals",
};

export default function TodayWorkout({ session }: Props) {
  const dayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long" });

  if (!session || !session.category) {
    return (
      <div className="py-6 border-l-4 border-stone-100 pl-5">
        <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-3">{dayLabel}</p>
        <p className="text-4xl font-black tracking-tight text-stone-200">Rest</p>
      </div>
    );
  }

  const { category, completed, prescription } = session;
  const isRun = category === "Run";
  const isStrength = category === "Strength";
  const isRest = category === "Rest";

  const borderColor = isRun ? "border-blue-500" : isStrength ? "border-amber-500" : "border-stone-200";

  const headline = isRun
    ? RUN_TYPE[prescription?.type ?? ""] ?? "Run"
    : isStrength
    ? `${prescription?.focus ? prescription.focus + " " : ""}Strength`
    : "Rest";

  return (
    <div className={`border-l-4 pl-5 ${borderColor}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">{dayLabel}</p>
        {completed && (
          <p className="text-[10px] tracking-[0.15em] uppercase text-emerald-500">✓ done</p>
        )}
      </div>

      <h1 className={`text-5xl font-black tracking-tight leading-none mb-1 ${completed ? "opacity-25" : ""}`}>
        {headline}
      </h1>

      {isRun && (prescription?.distanceKm != null || prescription?.targetPace) && (
        <div className={`flex items-end gap-8 mt-5 ${completed ? "opacity-25" : ""}`}>
          {prescription?.distanceKm != null && (
            <div>
              <p className="text-[42px] font-black tabular-nums leading-none">{prescription.distanceKm}</p>
              <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mt-1">km</p>
            </div>
          )}
          {prescription?.targetPace && (
            <div>
              <p className="text-[42px] font-black tabular-nums leading-none">{prescription.targetPace}</p>
              <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mt-1">/km</p>
            </div>
          )}
        </div>
      )}

      {isStrength && prescription?.guidance && !completed && (
        <p className="text-sm text-stone-500 leading-relaxed mt-4 max-w-xs">{prescription.guidance}</p>
      )}

      {isRest && !completed && (
        <p className="text-sm text-stone-400 leading-relaxed mt-4">
          Adaptation happens at rest. Let your body recover today.
        </p>
      )}

      {isRun && prescription?.guidance && !completed && (
        <div className="mt-5 pt-4 border-t border-stone-100">
          <p className="text-[11px] text-stone-400 leading-relaxed">{prescription.guidance}</p>
        </div>
      )}

      {completed && (
        <p className="text-sm text-emerald-600 font-medium mt-4">Session complete.</p>
      )}
    </div>
  );
}
