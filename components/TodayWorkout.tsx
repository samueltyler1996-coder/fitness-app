import { useState } from "react";
import { Session, Actual, StrengthPrescription, WodPrescription, RunPrescription } from "../lib/types";

interface Props {
  session: Session | null;
  blockId: string | null;
  weekId: string | null;
  onToggle?: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onLogActual?: (blockId: string, weekId: string, sessionId: string, actual: Actual) => void;
}

const RUN_TYPE: Record<string, string> = {
  easy: "Easy Run",
  tempo: "Tempo Run",
  long: "Long Run",
  intervals: "Intervals",
};

const WOD_FORMAT: Record<string, string> = {
  for_time: "For Time",
  amrap: "AMRAP",
  emom: "EMOM",
  intervals: "Intervals",
  stations: "Stations",
};

export default function TodayWorkout({ session, blockId, weekId, onToggle, onLogActual }: Props) {
  const [logText, setLogText] = useState("");
  const [parsed, setParsed] = useState<{ summary: string; actual: Actual } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const isWod = category === "WOD";
  const isRest = category === "Rest";

  const borderColor = isRun
    ? "border-blue-500"
    : isStrength
    ? "border-amber-500"
    : isWod
    ? "border-violet-500"
    : "border-stone-200";

  const runP = isRun ? (prescription as RunPrescription) : null;
  const strengthP = isStrength ? (prescription as StrengthPrescription) : null;
  const wodP = isWod ? (prescription as WodPrescription) : null;

  const headline = isRun
    ? RUN_TYPE[runP?.type ?? ""] ?? "Run"
    : isStrength
    ? `${strengthP?.focus ? strengthP.focus.charAt(0).toUpperCase() + strengthP.focus.slice(1) + " " : ""}Strength`
    : isWod
    ? (wodP?.sections?.main?.wodName ?? WOD_FORMAT[wodP?.format ?? ""] ?? "WOD")
    : "Rest";

  const mainExercises = strengthP?.sections?.main ?? [];
  const warmupExercises = strengthP?.sections?.warmup ?? [];
  const accessoryExercises = strengthP?.sections?.accessory ?? [];

  const hasActual = session.actual && Object.keys(session.actual).length > 0;
  const canInteract = !isRest && blockId && weekId && onToggle && onLogActual;

  const handleParse = async () => {
    if (!logText.trim()) return;
    setParsing(true);
    setParsed(null);
    try {
      const res = await fetch("/api/parse-actual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescription, category, userText: logText }),
      });
      if (!res.ok) throw new Error();
      setParsed(await res.json());
    } catch {
      setParsed(null);
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!parsed || !blockId || !weekId || !onLogActual) return;
    setSaving(true);
    const actual: Actual = { ...parsed.actual, rawText: logText };
    await onLogActual(blockId, weekId, session.id, actual);
    if (!completed && onToggle) {
      await onToggle(blockId, weekId, session.id, false);
    }
    setParsed(null);
    setLogText("");
    setSaving(false);
  };

  const handleMarkComplete = () => {
    if (!blockId || !weekId || !onToggle) return;
    onToggle(blockId, weekId, session.id, completed);
  };

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

      {/* Run stats */}
      {isRun && (runP?.distanceKm != null || runP?.targetPace) && (
        <div className={`flex items-end gap-8 mt-5 ${completed ? "opacity-25" : ""}`}>
          {runP?.distanceKm != null && (
            <div>
              <p className="text-[42px] font-black tabular-nums leading-none">{runP.distanceKm}</p>
              <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mt-1">km</p>
            </div>
          )}
          {runP?.targetPace && (
            <div>
              <p className="text-[42px] font-black tabular-nums leading-none">{runP.targetPace}</p>
              <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mt-1">/km</p>
            </div>
          )}
        </div>
      )}

      {/* Run intervals */}
      {isRun && runP?.type === "intervals" && runP?.intervals && runP.intervals.length > 0 && !completed && (
        <div className="mt-5 flex flex-col gap-1.5">
          {runP.intervals.map((interval, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-stone-300 text-[11px] w-4">{i + 1}</span>
              <span className="font-semibold">{interval.reps}×</span>
              {interval.distanceM && <span>{interval.distanceM}m</span>}
              {interval.targetPace && <span className="text-stone-400">@ {interval.targetPace}</span>}
              {interval.restSec && <span className="text-stone-300 text-[11px]">{interval.restSec}s rest</span>}
            </div>
          ))}
        </div>
      )}

      {/* Run guidance */}
      {isRun && runP?.guidance && !completed && (
        <div className="mt-5 pt-4 border-t border-stone-100">
          <p className="text-[11px] text-stone-400 leading-relaxed">{runP.guidance}</p>
        </div>
      )}

      {/* Strength */}
      {isStrength && !completed && (
        <div className="mt-5 flex flex-col gap-4">
          {strengthP?.guidance && (
            <p className="text-sm text-stone-500 leading-relaxed">{strengthP.guidance}</p>
          )}
          {warmupExercises.length > 0 && (
            <div>
              <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Warmup</p>
              <div className="flex flex-col gap-1.5">
                {warmupExercises.map((ex, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="font-medium text-stone-700">{ex.name}</span>
                    {ex.sets && ex.reps && <span className="text-stone-400 text-[11px]">{ex.sets}×{ex.reps}</span>}
                    {ex.notes && <span className="text-stone-300 text-[11px]">{ex.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {mainExercises.length > 0 && (
            <div>
              <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Main</p>
              <div className="flex flex-col gap-2">
                {mainExercises.map((ex, i) => (
                  <div key={i} className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-stone-900">{ex.name}</span>
                      {ex.sets && ex.reps && <span className="text-stone-500 text-sm">{ex.sets}×{ex.reps}</span>}
                    </div>
                    <div className="flex items-baseline gap-2 text-right">
                      {ex.load && <span className="text-[11px] text-stone-400">{ex.load}</span>}
                      {ex.tempo && <span className="text-[10px] text-stone-300 font-mono">{ex.tempo}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {accessoryExercises.length > 0 && (
            <div>
              <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Accessory</p>
              <div className="flex flex-col gap-1.5">
                {accessoryExercises.map((ex, i) => (
                  <div key={i} className="flex items-baseline gap-2 text-sm">
                    <span className="font-medium text-stone-700">{ex.name}</span>
                    {ex.sets && ex.reps && <span className="text-stone-400 text-[11px]">{ex.sets}×{ex.reps}</span>}
                    {ex.load && <span className="text-stone-300 text-[11px]">{ex.load}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WOD */}
      {isWod && !completed && (
        <div className="mt-5 flex flex-col gap-4">
          {wodP?.sections?.main?.structure && (
            <p className="text-sm font-medium text-stone-700">{wodP.sections.main.structure}</p>
          )}
          <div className="flex gap-4">
            {wodP?.format && (
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400">Format</p>
                <p className="text-sm font-semibold">{WOD_FORMAT[wodP.format] ?? wodP.format}</p>
              </div>
            )}
            {wodP?.durationCapMin && (
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400">Cap</p>
                <p className="text-sm font-semibold">{wodP.durationCapMin} min</p>
              </div>
            )}
            {wodP?.sections?.main?.targetEffort && (
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400">Effort</p>
                <p className="text-sm font-semibold">{wodP.sections.main.targetEffort}</p>
              </div>
            )}
          </div>
          {wodP?.sections?.main?.stations && wodP.sections.main.stations.length > 0 && (
            <div>
              <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Stations</p>
              <div className="flex flex-col gap-2">
                {wodP.sections.main.stations.map((station, i) => (
                  <div key={i} className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-stone-300 text-[11px] w-4 shrink-0">{i + 1}</span>
                      <span className="font-semibold text-stone-900">{station.movement}</span>
                      {station.reps && <span className="text-stone-500 text-sm">{station.reps} reps</span>}
                      {station.distance && <span className="text-stone-500 text-sm">{station.distance}</span>}
                      {station.calories && <span className="text-stone-500 text-sm">{station.calories} cal</span>}
                    </div>
                    {station.load && <span className="text-[11px] text-stone-400">{station.load}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {wodP?.guidance && (
            <div className="pt-3 border-t border-stone-100">
              <p className="text-[11px] text-stone-400 leading-relaxed">{wodP.guidance}</p>
            </div>
          )}
        </div>
      )}

      {/* Rest */}
      {isRest && (
        <p className="text-sm text-stone-400 leading-relaxed mt-4">
          Adaptation happens at rest. Let your body recover today.
        </p>
      )}

      {/* ── Logging module ── */}
      {canInteract && (
        <div className="mt-6">

          {/* Completed */}
          {completed && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] tracking-[0.15em] uppercase text-emerald-600 font-semibold">Session complete</p>
                <button
                  onClick={handleMarkComplete}
                  className="text-[10px] tracking-[0.1em] uppercase text-stone-300 hover:text-stone-500 transition-colors"
                >
                  Undo
                </button>
              </div>
              {hasActual && (
                <div className="flex flex-wrap gap-3 text-sm">
                  {session.actual.distanceKm && <span className="font-semibold">{session.actual.distanceKm} km</span>}
                  {session.actual.pace && <span className="text-stone-500">{session.actual.pace}</span>}
                  {session.actual.effort && <span className="text-stone-500 capitalize">{session.actual.effort} effort</span>}
                  {session.actual.notes && <span className="text-[11px] text-stone-400 italic w-full">{session.actual.notes}</span>}
                </div>
              )}
            </div>
          )}

          {/* Not completed — input panel */}
          {!completed && !parsed && (
            <div className="bg-stone-50 rounded-2xl px-4 py-4 flex flex-col gap-3">
              <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400">How did it go?</p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={logText}
                  onChange={e => setLogText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleParse()}
                  placeholder={isRun ? "e.g. 8km at 5:20, felt strong" : "e.g. Hit all sets, felt good"}
                  className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-stone-400 transition-colors placeholder:text-stone-300"
                />
                <button
                  onClick={handleParse}
                  disabled={parsing || !logText.trim()}
                  className="shrink-0 bg-stone-900 hover:bg-stone-700 text-white text-[11px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-xl disabled:opacity-30 transition-colors"
                >
                  {parsing ? "…" : "Log"}
                </button>
              </div>
              <button
                onClick={handleMarkComplete}
                className="self-center text-[10px] tracking-[0.1em] uppercase text-stone-300 hover:text-stone-500 transition-colors pt-1"
              >
                Mark done without logging
              </button>
            </div>
          )}

          {/* Parsed confirmation */}
          {!completed && parsed && (
            <div className="bg-stone-50 rounded-2xl px-4 py-4 flex flex-col gap-3">
              <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400">Confirm</p>
              <p className="text-sm text-stone-700 leading-relaxed">{parsed.summary}</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 bg-stone-900 hover:bg-stone-800 text-white text-[11px] tracking-[0.1em] uppercase py-3 rounded-xl disabled:opacity-40 transition-colors"
                >
                  {saving ? "Saving…" : "Save & complete"}
                </button>
                <button
                  onClick={() => setParsed(null)}
                  className="px-4 text-[11px] tracking-[0.1em] uppercase text-stone-400 hover:text-stone-700 border border-stone-200 rounded-xl transition-colors"
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
