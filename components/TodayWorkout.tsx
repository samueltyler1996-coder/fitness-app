import { useState, useEffect } from "react";
import { Session, Actual, StrengthPrescription, WodPrescription, RunPrescription } from "../lib/types";
import { StravaActivity, computePaceStr, inferEffort } from "../lib/strava";

interface Props {
  session: Session | null;
  blockId: string | null;
  weekId: string | null;
  stravaToken?: string;
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

export default function TodayWorkout({ session, blockId, weekId, stravaToken, onToggle, onLogActual }: Props) {
  const [logText, setLogText] = useState("");
  const [parsed, setParsed] = useState<{ summary: string; actual: Actual } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stravaActivity, setStravaActivity] = useState<StravaActivity | null>(null);
  const [stravaExpanded, setStravaExpanded] = useState(false);
  const [stravaNote, setStravaNote] = useState("");
  const [stravaSaving, setStravaSaving] = useState(false);

  const dayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long" });
  const todayISO = new Date().toISOString().split("T")[0];

  const isRun = session?.category === "Run";

  useEffect(() => {
    if (!isRun || !stravaToken || session?.completed) return;
    setStravaActivity(null);
    fetch("/api/strava/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: stravaToken, after: todayISO, before: todayISO }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.activities?.length) setStravaActivity(data.activities[0]); })
      .catch(() => {});
  }, [isRun, stravaToken, todayISO, session?.id, session?.completed]);

  const WORKOUT_TYPE_LABEL: Record<number, string> = { 1: "race", 2: "long_run", 3: "workout" };

  const handleStravaConfirm = async (note: string) => {
    if (!stravaActivity || !blockId || !weekId || !onLogActual) return;
    setStravaSaving(true);
    const distanceKm = Math.round(stravaActivity.distance / 100) / 10;
    const pace = computePaceStr(stravaActivity.moving_time, stravaActivity.distance);
    const effort = inferEffort(stravaActivity.perceived_exertion, stravaActivity.average_heartrate);
    const actual: Actual = {
      distanceKm,
      pace,
      effort: effort ?? null,
      rawText: `${distanceKm} km at ${pace} — from Strava: "${stravaActivity.name}"`,
      ...(note.trim() ? { notes: note.trim() } : {}),
      ...(stravaActivity.average_heartrate ? { avgHr: Math.round(stravaActivity.average_heartrate) } : {}),
      ...(stravaActivity.total_elevation_gain ? { elevationGain: Math.round(stravaActivity.total_elevation_gain) } : {}),
      ...(stravaActivity.suffer_score ? { sufferScore: stravaActivity.suffer_score } : {}),
      ...(stravaActivity.workout_type && WORKOUT_TYPE_LABEL[stravaActivity.workout_type]
        ? { workoutType: WORKOUT_TYPE_LABEL[stravaActivity.workout_type] } : {}),
      ...(stravaActivity.achievement_count ? { achievements: stravaActivity.achievement_count } : {}),
    };
    await onLogActual(blockId, weekId, session!.id, actual);
    if (!completed && onToggle) await onToggle(blockId, weekId, session!.id, false);
    setStravaExpanded(false);
    setStravaNote("");
    setStravaSaving(false);
  };

  if (!session || !session.category) {
    return (
      <div className="py-6 border-l-4 border-stone-100 pl-5">
        <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-3">{dayLabel}</p>
        <p className="text-4xl font-black tracking-tight text-stone-200">Rest</p>
      </div>
    );
  }

  const { category, completed, prescription } = session;
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
                  {session.actual.avgHr && <span className="text-stone-500">♥ {session.actual.avgHr} bpm</span>}
                  {session.actual.elevationGain ? <span className="text-stone-500">↑ {session.actual.elevationGain}m</span> : null}
                  {session.actual.sufferScore ? <span className="text-stone-500">effort {session.actual.sufferScore}</span> : null}
                  {session.actual.achievements ? <span className="text-stone-500">🏆 {session.actual.achievements} PR{session.actual.achievements > 1 ? "s" : ""}</span> : null}
                  {session.actual.notes && <span className="text-[11px] text-stone-400 italic w-full">{session.actual.notes}</span>}
                </div>
              )}
            </div>
          )}

          {/* Not completed — input panel */}
          {!completed && stravaExpanded && stravaActivity && (
            <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-orange-500 shrink-0" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                  </svg>
                  <span className="text-[13px] font-semibold text-orange-700">
                    {(stravaActivity.distance / 1000).toFixed(1)} km · {computePaceStr(stravaActivity.moving_time, stravaActivity.distance)}
                  </span>
                  <span className="text-[11px] text-orange-400 truncate">{stravaActivity.name}</span>
                </div>
                <button onClick={() => setStravaExpanded(false)} className="text-orange-300 hover:text-orange-500 text-lg leading-none ml-2 shrink-0">×</button>
              </div>
              {(stravaActivity.average_heartrate || stravaActivity.total_elevation_gain || stravaActivity.suffer_score || stravaActivity.achievement_count) && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {stravaActivity.average_heartrate && <span className="text-[11px] text-orange-500">♥ {Math.round(stravaActivity.average_heartrate)} bpm</span>}
                  {stravaActivity.total_elevation_gain ? <span className="text-[11px] text-orange-500">↑ {Math.round(stravaActivity.total_elevation_gain)}m</span> : null}
                  {stravaActivity.suffer_score ? <span className="text-[11px] text-orange-500">effort {stravaActivity.suffer_score}</span> : null}
                  {stravaActivity.achievement_count ? <span className="text-[11px] text-orange-500">🏆 {stravaActivity.achievement_count} PR{stravaActivity.achievement_count > 1 ? "s" : ""}</span> : null}
                </div>
              )}
              <input
                type="text"
                value={stravaNote}
                onChange={e => setStravaNote(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleStravaConfirm(stravaNote)}
                placeholder="Add a comment (optional)"
                className="bg-white border border-orange-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-orange-400 transition-colors placeholder:text-orange-200"
                autoFocus
              />
              <button
                onClick={() => handleStravaConfirm(stravaNote)}
                disabled={stravaSaving}
                className="w-full bg-stone-900 hover:bg-stone-800 text-white text-[11px] tracking-[0.1em] uppercase py-3 rounded-xl disabled:opacity-40 transition-colors"
              >{stravaSaving ? "Saving…" : "Save & complete"}</button>
            </div>
          )}

          {!completed && !parsed && !stravaExpanded && (
            <div className="bg-stone-50 rounded-2xl px-4 py-4 flex flex-col gap-3">
              <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400">How did it go?</p>
              {isRun && stravaActivity && (
                <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-orange-500 shrink-0" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                    </svg>
                    <span className="text-[12px] text-orange-700 font-medium">
                      {(stravaActivity.distance / 1000).toFixed(1)} km · {computePaceStr(stravaActivity.moving_time, stravaActivity.distance)}
                    </span>
                    <span className="text-[10px] text-orange-400 truncate">{stravaActivity.name}</span>
                  </div>
                  <button
                    onClick={() => setStravaExpanded(true)}
                    className="text-[11px] tracking-[0.05em] uppercase text-orange-600 hover:text-orange-900 font-semibold transition-colors shrink-0 ml-2"
                  >
                    Import →
                  </button>
                </div>
              )}
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
