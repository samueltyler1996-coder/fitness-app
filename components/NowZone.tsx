"use client";

import { useState, useEffect } from "react";
import {
  Session, TrainingBlock, TrainingWeek, Actual,
  RunPrescription, StrengthPrescription, WodPrescription, RaceTimePredictions,
} from "../lib/types";
import { StravaActivity, computePaceStr, inferEffort } from "../lib/strava";
import RaceWeekCard from "./RaceWeekCard";
import RacePredictionPanel from "./RacePredictionPanel";

interface Props {
  activeBlock: TrainingBlock | null;
  currentWeek: TrainingWeek | null;
  todaySession: Session | null;
  stravaToken?: string;
  daysToRace?: number | null;
  eventDate?: string;
  racePredictions?: RaceTimePredictions;
  onToggleSession: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onLogActual: (blockId: string, weekId: string, sessionId: string, actual: Actual) => void;
  onGoToBlock: () => void;
  onViewBriefing?: () => void;
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

const WORKOUT_TYPE_LABEL: Record<number, string> = { 1: "race", 2: "long_run", 3: "workout" };

export default function NowZone({
  activeBlock, currentWeek, todaySession, stravaToken,
  daysToRace, eventDate, racePredictions,
  onToggleSession, onLogActual, onGoToBlock, onViewBriefing,
}: Props) {
  const [logText, setLogText] = useState("");
  const [parsed, setParsed] = useState<{ summary: string; actual: Actual } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stravaActivity, setStravaActivity] = useState<StravaActivity | null>(null);
  const [stravaExpanded, setStravaExpanded] = useState(false);
  const [stravaNote, setStravaNote] = useState("");
  const [stravaSaving, setStravaSaving] = useState(false);

  const dayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase();
  const todayISO = new Date().toISOString().split("T")[0];

  const session = todaySession;
  const blockId = activeBlock?.id ?? null;
  const weekId = currentWeek?.id ?? null;
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

  // ── No block ────────────────────────────────────────────────────────────────
  if (!activeBlock) {
    return (
      <div className="min-h-screen bg-stone-950 px-5 pt-14 pb-28 flex flex-col">
        <p className="text-[10px] tracking-[0.25em] uppercase text-stone-600 mb-10">{dayLabel}</p>
        {daysToRace !== null && daysToRace !== undefined && daysToRace <= 7 && eventDate && (
          <RaceWeekCard eventDate={eventDate} activeBlock={activeBlock} onViewBriefing={onViewBriefing ?? (() => {})} />
        )}
        {daysToRace !== null && daysToRace !== undefined && daysToRace <= 7 && racePredictions?.riegel && (
          <div className="mt-2">
            <RacePredictionPanel prediction={racePredictions.riegel} />
          </div>
        )}
        <div className="flex-1 flex flex-col justify-center gap-6">
          <p
            className="font-display font-black text-stone-700 leading-none tracking-tight"
            style={{ fontSize: "clamp(42px, 12vw, 56px)" }}
          >
            No training<br />block active.
          </p>
          <button
            onClick={onGoToBlock}
            className="self-start text-sm text-stone-500 border border-stone-800 rounded-xl px-5 py-3 hover:border-stone-600 hover:text-stone-300 transition-colors"
          >
            Set up a block →
          </button>
        </div>
      </div>
    );
  }

  // ── Rest / no session ────────────────────────────────────────────────────────
  if (!session || !session.category || session.category === "Rest") {
    return (
      <div className="min-h-screen bg-stone-950 px-5 pt-14 pb-28 flex flex-col">
        <p className="text-[10px] tracking-[0.25em] uppercase text-stone-600 mb-10">{dayLabel}</p>
        {daysToRace !== null && daysToRace !== undefined && daysToRace <= 7 && eventDate && (
          <RaceWeekCard eventDate={eventDate} activeBlock={activeBlock} onViewBriefing={onViewBriefing ?? (() => {})} />
        )}
        {daysToRace !== null && daysToRace !== undefined && daysToRace <= 7 && racePredictions?.riegel && (
          <div className="mt-2">
            <RacePredictionPanel prediction={racePredictions.riegel} />
          </div>
        )}
        <div className="flex-1 flex flex-col justify-center">
          <p
            className="font-display font-black text-white leading-none tracking-tight mb-5"
            style={{ fontSize: "clamp(64px, 18vw, 88px)" }}
          >
            Rest
          </p>
          <p className="text-[13px] text-stone-500 leading-relaxed max-w-xs">
            Recovery is where adaptation happens.<br />Let your body rebuild today.
          </p>
        </div>
        {activeBlock && (
          <div className="mt-auto pt-4 border-t border-stone-900">
            <p className="text-[10px] tracking-[0.2em] uppercase text-stone-700 mb-0.5">
              {activeBlock.primaryGoal}
            </p>
            <p className="text-[11px] text-stone-600">{activeBlock.name}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Active session ────────────────────────────────────────────────────────────
  const { category, completed, prescription } = session;
  const isStrength = category === "Strength";
  const isWod = category === "WOD";

  const runP = isRun ? (prescription as RunPrescription) : null;
  const strengthP = isStrength ? (prescription as StrengthPrescription) : null;
  const wodP = isWod ? (prescription as WodPrescription) : null;

  const headline = isRun
    ? (RUN_TYPE[runP?.type ?? ""] ?? "Run")
    : isStrength
    ? `${strengthP?.focus ? strengthP.focus.charAt(0).toUpperCase() + strengthP.focus.slice(1) + " " : ""}Strength`
    : isWod
    ? (wodP?.sections?.main?.wodName ?? WOD_FORMAT[wodP?.format ?? ""] ?? "WOD")
    : "Rest";

  const mainExercises = strengthP?.sections?.main ?? [];
  const warmupExercises = strengthP?.sections?.warmup ?? [];
  const accessoryExercises = strengthP?.sections?.accessory ?? [];
  const hasActual = session.actual && Object.keys(session.actual).length > 0;
  const canInteract = !!(blockId && weekId);

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
    if (!parsed || !blockId || !weekId) return;
    setSaving(true);
    await onLogActual(blockId, weekId, session.id, { ...parsed.actual, rawText: logText });
    if (!completed) await onToggleSession(blockId, weekId, session.id, false);
    setParsed(null);
    setLogText("");
    setSaving(false);
  };

  const handleMarkComplete = () => {
    if (!blockId || !weekId) return;
    onToggleSession(blockId, weekId, session.id, completed);
  };

  const handleStravaConfirm = async (note: string) => {
    if (!stravaActivity || !blockId || !weekId) return;
    setStravaSaving(true);
    const distanceKm = Math.round(stravaActivity.distance / 100) / 10;
    const pace = computePaceStr(stravaActivity.moving_time, stravaActivity.distance);
    const effort = inferEffort(stravaActivity.perceived_exertion, stravaActivity.average_heartrate);
    const actual: Actual = {
      distanceKm, pace, effort: effort ?? null,
      rawText: `${distanceKm} km at ${pace} — from Strava: "${stravaActivity.name}"`,
      ...(note.trim() ? { notes: note.trim() } : {}),
      ...(stravaActivity.average_heartrate ? { avgHr: Math.round(stravaActivity.average_heartrate) } : {}),
      ...(stravaActivity.total_elevation_gain ? { elevationGain: Math.round(stravaActivity.total_elevation_gain) } : {}),
      ...(stravaActivity.suffer_score ? { sufferScore: stravaActivity.suffer_score } : {}),
      ...(stravaActivity.workout_type && WORKOUT_TYPE_LABEL[stravaActivity.workout_type]
        ? { workoutType: WORKOUT_TYPE_LABEL[stravaActivity.workout_type] } : {}),
      ...(stravaActivity.achievement_count ? { achievements: stravaActivity.achievement_count } : {}),
    };
    await onLogActual(blockId, weekId, session.id, actual);
    if (!completed) await onToggleSession(blockId, weekId, session.id, false);
    setStravaExpanded(false);
    setStravaNote("");
    setStravaSaving(false);
  };

  return (
    <div className="min-h-screen bg-stone-950 px-5 pt-14 pb-28 flex flex-col">

      {/* Day */}
      <p className="text-[10px] tracking-[0.25em] uppercase text-stone-600 mb-6">{dayLabel}</p>

      {/* Race week card */}
      {daysToRace !== null && daysToRace !== undefined && daysToRace <= 7 && eventDate && (
        <RaceWeekCard eventDate={eventDate} activeBlock={activeBlock} onViewBriefing={onViewBriefing ?? (() => {})} />
      )}
      {daysToRace !== null && daysToRace !== undefined && daysToRace <= 7 && racePredictions?.riegel && (
        <div className="mt-2">
          <RacePredictionPanel prediction={racePredictions.riegel} />
        </div>
      )}

      {/* Session headline */}
      <h1
        className={`font-display font-black text-white leading-none tracking-tight mb-4 transition-opacity ${completed ? "opacity-25" : ""}`}
        style={{ fontSize: "clamp(42px, 11vw, 56px)" }}
      >
        {headline}
      </h1>

      {/* Run numbers */}
      {isRun && (runP?.distanceKm != null || runP?.targetPace) && (
        <div className={`flex items-end gap-8 mb-6 transition-opacity ${completed ? "opacity-25" : ""}`}>
          {runP?.distanceKm != null && (
            <div>
              <p className="font-display font-black text-white leading-none" style={{ fontSize: "46px" }}>
                {runP.distanceKm}
              </p>
              <p className="text-[9px] tracking-[0.25em] uppercase text-stone-600 mt-1">km</p>
            </div>
          )}
          {runP?.targetPace && (
            <div>
              <p className="font-display font-black text-white leading-none" style={{ fontSize: "46px" }}>
                {runP.targetPace}
              </p>
              <p className="text-[9px] tracking-[0.25em] uppercase text-stone-600 mt-1">/km</p>
            </div>
          )}
        </div>
      )}

      {/* Run intervals */}
      {isRun && runP?.type === "intervals" && runP?.intervals && runP.intervals.length > 0 && !completed && (
        <div className="mb-8 flex flex-col gap-2">
          {runP.intervals.map((interval, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-stone-700 text-[11px] w-4 tabular-nums">{i + 1}</span>
              <span className="font-semibold text-stone-200 text-sm">{interval.reps}×</span>
              {interval.distanceM && <span className="text-stone-300 text-sm">{interval.distanceM}m</span>}
              {interval.targetPace && <span className="text-stone-500 text-sm">@ {interval.targetPace}</span>}
              {interval.restSec && <span className="text-stone-700 text-[11px]">{interval.restSec}s rest</span>}
            </div>
          ))}
        </div>
      )}

      {/* Run guidance */}
      {isRun && runP?.guidance && !completed && (
        <div className="mb-8 pt-5 border-t border-stone-800">
          <p className="text-[13px] text-stone-300 leading-relaxed">{runP.guidance}</p>
        </div>
      )}

      {/* Strength */}
      {isStrength && !completed && (
        <div className="mb-8 flex flex-col gap-5">
          {strengthP?.guidance && (
            <p className="text-[13px] text-stone-300 leading-relaxed">{strengthP.guidance}</p>
          )}
          {warmupExercises.length > 0 && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-stone-500 mb-3">Warmup</p>
              <div className="flex flex-col gap-1.5">
                {warmupExercises.map((ex, i) => (
                  <div key={i} className="flex items-baseline gap-2.5 text-sm">
                    <span className="text-stone-300">{ex.name}</span>
                    {ex.sets && ex.reps && <span className="text-stone-600 text-[11px]">{ex.sets}×{ex.reps}</span>}
                    {ex.notes && <span className="text-stone-600 text-[11px]">{ex.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {mainExercises.length > 0 && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-stone-500 mb-3">Main</p>
              <div className="flex flex-col gap-2.5">
                {mainExercises.map((ex, i) => (
                  <div key={i} className="flex items-baseline justify-between py-2.5 border-b border-stone-900 last:border-0">
                    <div className="flex items-baseline gap-2.5">
                      <span className="font-semibold text-white text-[15px]">{ex.name}</span>
                      {ex.sets && ex.reps && <span className="text-stone-500 text-sm">{ex.sets}×{ex.reps}</span>}
                    </div>
                    {ex.load && <span className="text-[11px] text-stone-500">{ex.load}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {accessoryExercises.length > 0 && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-stone-500 mb-3">Accessory</p>
              <div className="flex flex-col gap-1.5">
                {accessoryExercises.map((ex, i) => (
                  <div key={i} className="flex items-baseline gap-2.5 text-sm">
                    <span className="text-stone-300">{ex.name}</span>
                    {ex.sets && ex.reps && <span className="text-stone-600 text-[11px]">{ex.sets}×{ex.reps}</span>}
                    {ex.load && <span className="text-stone-600 text-[11px]">{ex.load}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WOD */}
      {isWod && !completed && (
        <div className="mb-8 flex flex-col gap-4">
          {wodP?.sections?.main?.structure && (
            <p className="text-[13px] font-medium text-stone-300">{wodP.sections.main.structure}</p>
          )}
          <div className="flex gap-6">
            {wodP?.format && (
              <div>
                <p className="text-[9px] tracking-[0.2em] uppercase text-stone-700 mb-1">Format</p>
                <p className="text-sm font-semibold text-stone-200">{WOD_FORMAT[wodP.format] ?? wodP.format}</p>
              </div>
            )}
            {wodP?.durationCapMin && (
              <div>
                <p className="text-[9px] tracking-[0.2em] uppercase text-stone-700 mb-1">Cap</p>
                <p className="text-sm font-semibold text-stone-200">{wodP.durationCapMin} min</p>
              </div>
            )}
          </div>
          {wodP?.sections?.main?.stations && wodP.sections.main.stations.length > 0 && (
            <div className="flex flex-col gap-2">
              {wodP.sections.main.stations.map((station, i) => (
                <div key={i} className="flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-stone-700 text-[11px] w-4 shrink-0">{i + 1}</span>
                    <span className="font-semibold text-white text-[15px]">{station.movement}</span>
                    {station.reps && <span className="text-stone-500 text-sm">{station.reps} reps</span>}
                  </div>
                  {station.load && <span className="text-[11px] text-stone-600">{station.load}</span>}
                </div>
              ))}
            </div>
          )}
          {wodP?.guidance && (
            <p className="text-[13px] text-stone-300 leading-relaxed pt-2 border-t border-stone-800">{wodP.guidance}</p>
          )}
        </div>
      )}

      {/* Push logging to bottom */}
      <div className="mt-8" />

      {/* ── Logging ── */}
      {canInteract && (
        <div className="flex flex-col gap-3">

          {/* Completed state */}
          {completed && (
            <div className="bg-stone-800 rounded-xl px-4 py-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] tracking-[0.2em] uppercase text-emerald-500 font-medium">Done ✓</p>
                <button
                  onClick={handleMarkComplete}
                  className="text-[10px] tracking-[0.1em] uppercase text-stone-700 hover:text-stone-500 transition-colors"
                >
                  Undo
                </button>
              </div>
              {hasActual && (
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {session.actual.distanceKm && (
                    <span className="font-semibold text-white text-sm">{session.actual.distanceKm} km</span>
                  )}
                  {session.actual.pace && <span className="text-stone-400 text-sm">{session.actual.pace}/km</span>}
                  {session.actual.effort && (
                    <span className="text-stone-500 text-sm capitalize">{session.actual.effort}</span>
                  )}
                  {session.actual.avgHr && (
                    <span className="text-stone-500 text-sm">♥ {session.actual.avgHr} bpm</span>
                  )}
                  {session.actual.elevationGain ? (
                    <span className="text-stone-500 text-sm">↑ {session.actual.elevationGain}m</span>
                  ) : null}
                  {session.actual.achievements ? (
                    <span className="text-stone-500 text-sm">🏆 {session.actual.achievements} PR{session.actual.achievements > 1 ? "s" : ""}</span>
                  ) : null}
                  {session.actual.notes && (
                    <span className="text-[11px] text-stone-600 italic w-full mt-0.5">{session.actual.notes}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Strava expanded */}
          {!completed && stravaExpanded && stravaActivity && (
            <div className="bg-stone-800 rounded-xl px-4 py-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-orange-500 shrink-0" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                  </svg>
                  <span className="text-[13px] font-semibold text-orange-400">
                    {(stravaActivity.distance / 1000).toFixed(1)} km · {computePaceStr(stravaActivity.moving_time, stravaActivity.distance)}
                  </span>
                  <span className="text-[11px] text-stone-600 truncate">{stravaActivity.name}</span>
                </div>
                <button onClick={() => setStravaExpanded(false)} className="text-stone-700 hover:text-stone-400 text-xl leading-none ml-2 shrink-0">×</button>
              </div>
              {(stravaActivity.average_heartrate || stravaActivity.total_elevation_gain || stravaActivity.suffer_score || stravaActivity.achievement_count) && (
                <div className="flex flex-wrap gap-x-3">
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
                className="bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-stone-500 transition-colors placeholder:text-stone-600"
                autoFocus
              />
              <button
                onClick={() => handleStravaConfirm(stravaNote)}
                disabled={stravaSaving}
                className="w-full bg-white hover:bg-stone-100 text-stone-900 text-[11px] tracking-[0.12em] uppercase font-semibold py-3.5 rounded-xl disabled:opacity-40 transition-colors"
              >
                {stravaSaving ? "Saving…" : "Save & complete"}
              </button>
            </div>
          )}

          {/* Default logging panel */}
          {!completed && !parsed && !stravaExpanded && (
            <div className="bg-stone-800 rounded-xl px-4 py-4 flex flex-col gap-3">
              <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">How did it go?</p>
              {isRun && stravaActivity && (
                <div className="flex items-center justify-between bg-stone-800 border border-stone-700 rounded-xl px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-orange-500 shrink-0" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                    </svg>
                    <span className="text-[12px] text-orange-400 font-medium">
                      {(stravaActivity.distance / 1000).toFixed(1)} km · {computePaceStr(stravaActivity.moving_time, stravaActivity.distance)}
                    </span>
                    <span className="text-[10px] text-stone-600 truncate">{stravaActivity.name}</span>
                  </div>
                  <button
                    onClick={() => setStravaExpanded(true)}
                    className="text-[11px] tracking-[0.05em] uppercase text-orange-500 hover:text-orange-300 font-semibold transition-colors shrink-0 ml-2"
                  >
                    Import →
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={logText}
                  onChange={e => setLogText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleParse()}
                  placeholder={isRun ? "e.g. 8km at 5:20, felt strong" : "e.g. Hit all sets, felt good"}
                  className="flex-1 bg-stone-900 border border-stone-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-stone-600 transition-colors placeholder:text-stone-600"
                />
                <button
                  onClick={handleParse}
                  disabled={parsing || !logText.trim()}
                  className="shrink-0 bg-white hover:bg-stone-100 text-stone-900 text-[11px] tracking-[0.12em] uppercase font-semibold px-4 py-2.5 rounded-xl disabled:opacity-30 transition-colors"
                >
                  {parsing ? "…" : "Log"}
                </button>
              </div>
              <button
                onClick={handleMarkComplete}
                className="self-center text-[10px] tracking-[0.1em] uppercase text-stone-700 hover:text-stone-500 transition-colors pt-0.5"
              >
                Mark done without logging
              </button>
            </div>
          )}

          {/* Parsed confirm */}
          {!completed && parsed && (
            <div className="bg-stone-800 rounded-xl px-4 py-4 flex flex-col gap-3">
              <p className="text-[10px] tracking-[0.2em] uppercase text-stone-600">Confirm</p>
              <p className="text-sm text-stone-300 leading-relaxed">{parsed.summary}</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 bg-white hover:bg-stone-100 text-stone-900 text-[11px] tracking-[0.12em] uppercase font-semibold py-3.5 rounded-xl disabled:opacity-40 transition-colors"
                >
                  {saving ? "Saving…" : "Save & complete"}
                </button>
                <button
                  onClick={() => setParsed(null)}
                  className="px-4 text-[11px] tracking-[0.1em] uppercase text-stone-500 hover:text-stone-300 border border-stone-800 rounded-xl transition-colors"
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
