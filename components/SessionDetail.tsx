"use client";
import { useState, useEffect } from "react";
import { Session, Actual, Prescription, Category, StrengthPrescription, WodPrescription, RunPrescription } from "../lib/types";
import { StravaActivity, computePaceStr, inferEffort } from "../lib/strava";
import SessionEditModal from "./SessionEditModal";

interface Props {
  session: Session;
  blockId: string;
  weekId: string;
  isToday?: boolean;
  stravaToken?: string;
  sessionDate?: string;
  onToggle: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onLogActual: (blockId: string, weekId: string, sessionId: string, actual: Actual) => void;
  onEditPrescription: (blockId: string, weekId: string, sessionId: string, category: Category, prescription: Prescription) => Promise<void>;
}

const RUN_TYPE: Record<string, string> = {
  easy: "Easy Run", tempo: "Tempo Run", long: "Long Run", intervals: "Intervals",
};
const WOD_FORMAT: Record<string, string> = {
  for_time: "For Time", amrap: "AMRAP", emom: "EMOM", intervals: "Intervals", stations: "Stations",
};

function prescLine(parts: (string | number | null | undefined)[]): string {
  return parts.filter(Boolean).join("  ·  ");
}

export default function SessionDetail({ session, blockId, weekId, isToday, stravaToken, sessionDate, onToggle, onLogActual, onEditPrescription }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [logText, setLogText] = useState("");
  const [parsed, setParsed] = useState<{ summary: string; actual: Actual } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stravaActivity, setStravaActivity] = useState<StravaActivity | null>(null);
  const [stravaExpanded, setStravaExpanded] = useState(false);
  const [stravaNote, setStravaNote] = useState("");
  const [stravaSaving, setStravaSaving] = useState(false);

  const isRun = session.category === "Run";
  const isStrength = session.category === "Strength";
  const isWod = session.category === "WOD";
  const isRest = session.category === "Rest";

  useEffect(() => {
    if (!isRun || !stravaToken || !sessionDate || session.completed) return;
    setStravaActivity(null);
    fetch("/api/strava/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: stravaToken, after: sessionDate, before: sessionDate }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.activities?.length) setStravaActivity(data.activities[0]); })
      .catch(() => {});
  }, [isRun, stravaToken, sessionDate, session.id, session.completed]);

  const runP = isRun ? (session.prescription as RunPrescription) : null;
  const strengthP = isStrength ? (session.prescription as StrengthPrescription) : null;
  const wodP = isWod ? (session.prescription as WodPrescription) : null;

  const hasActual = session.actual && Object.keys(session.actual).length > 0;

  const title = isRun
    ? (RUN_TYPE[runP?.type ?? ""] ?? "Run")
    : isStrength
    ? `${strengthP?.focus ? strengthP.focus.charAt(0).toUpperCase() + strengthP.focus.slice(1) + " " : ""}Strength`
    : isWod
    ? (wodP?.sections?.main?.wodName ?? WOD_FORMAT[wodP?.format ?? ""] ?? "WOD")
    : "Rest";

  const WORKOUT_TYPE_LABEL: Record<number, string> = { 1: "race", 2: "long_run", 3: "workout" };

  const handleStravaConfirm = async (note: string) => {
    if (!stravaActivity) return;
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
    await onLogActual(blockId, weekId, session.id, actual);
    if (!session.completed) await onToggle(blockId, weekId, session.id, false);
    setStravaExpanded(false);
    setStravaNote("");
    setStravaSaving(false);
  };

  const handleParse = async () => {
    if (!logText.trim()) return;
    setParsing(true);
    setParsed(null);
    try {
      const res = await fetch("/api/parse-actual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescription: session.prescription, category: session.category, userText: logText }),
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
    if (!parsed) return;
    setSaving(true);
    const actual: Actual = { ...parsed.actual, rawText: logText };
    await onLogActual(blockId, weekId, session.id, actual);
    if (!session.completed) await onToggle(blockId, weekId, session.id, false);
    setParsed(null);
    setLogText("");
    setSaving(false);
  };

  return (
    <div className={`rounded-xl px-4 py-4 flex flex-col gap-4 ${isToday ? "bg-blue-50/40 border border-blue-100" : "bg-stone-50"}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-[0.15em] uppercase text-stone-400">{session.day}</span>
          {isToday && (
            <span className="text-[9px] tracking-wide uppercase bg-blue-100 text-blue-500 px-1.5 py-0.5 rounded-full">today</span>
          )}
          <span className="text-sm font-semibold text-stone-800">{title}</span>
          {session.manuallyModified && (
            <span className="text-[9px] text-stone-300 tracking-wide">edited</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {session.completed && (
            <span className="text-[10px] text-emerald-500">✓</span>
          )}
          {!isRest && (
            <button
              onClick={() => setEditOpen(true)}
              className="text-stone-300 hover:text-stone-600 text-[13px] transition-colors"
              title="Edit session"
            >✎</button>
          )}
        </div>
      </div>

      {/* Guidance */}
      {(runP?.guidance ?? strengthP?.guidance ?? wodP?.guidance) && (
        <p className="text-[11px] text-stone-500 leading-relaxed bg-white rounded-lg px-3 py-2.5 border border-stone-100">
          {runP?.guidance ?? strengthP?.guidance ?? wodP?.guidance}
        </p>
      )}

      {/* ── Run ── */}
      {isRun && (
        <div className="flex flex-col gap-3">
          {(runP?.distanceKm != null || runP?.targetPace) && (
            <div className="flex gap-6">
              {runP?.distanceKm != null && (
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-stone-400 mb-0.5">Distance</p>
                  <p className="text-lg font-black tabular-nums leading-none">
                    {runP.distanceKm} <span className="text-[11px] font-normal text-stone-400">km</span>
                  </p>
                </div>
              )}
              {runP?.targetPace && (
                <div>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-stone-400 mb-0.5">Pace</p>
                  <p className="text-lg font-black tabular-nums leading-none">
                    {runP.targetPace} <span className="text-[11px] font-normal text-stone-400">/km</span>
                  </p>
                </div>
              )}
            </div>
          )}
          {runP?.type === "intervals" && (runP?.intervals ?? []).length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-stone-300 mb-2">Intervals</p>
              <div className="flex flex-col gap-1.5">
                {runP!.intervals!.map((iv, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-stone-300 text-[10px] w-4">{i + 1}</span>
                    <span className="font-medium">{iv.reps}×</span>
                    {iv.distanceM && <span>{iv.distanceM}m</span>}
                    {iv.targetPace && <span className="text-stone-400">@ {iv.targetPace}</span>}
                    {iv.restSec && <span className="text-stone-300 text-[11px]">{iv.restSec}s rest</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Strength ── */}
      {isStrength && (
        <div className="flex flex-col">

          {/* Warm-up */}
          {(strengthP?.sections?.warmup ?? []).length > 0 && (
            <div className="pb-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-stone-300 mb-2">Warm-up</p>
              <div className="flex flex-col gap-2">
                {strengthP!.sections.warmup!.map((ex, i) => (
                  <div key={i} className="flex items-baseline justify-between">
                    <span className="text-[12px] text-stone-600">{ex.name}</span>
                    <span className="text-[11px] text-stone-400">
                      {prescLine([ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : null, ex.notes])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main */}
          {(strengthP?.sections?.main ?? []).length > 0 && (
            <div className="py-3 border-t border-stone-100">
              <p className="text-[9px] uppercase tracking-[0.2em] text-stone-300 mb-3">Main</p>
              <div className="flex flex-col gap-3.5">
                {strengthP!.sections.main!.map((ex, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-stone-900">{ex.name}</span>
                    <span className="text-[11px] text-stone-400">
                      {prescLine([
                        ex.sets && ex.reps ? `${ex.sets} × ${ex.reps}` : null,
                        ex.load,
                        ex.restSec ? `Rest ${ex.restSec}s` : null,
                        ex.tempo ? `Tempo ${ex.tempo}` : null,
                      ])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accessory */}
          {(strengthP?.sections?.accessory ?? []).length > 0 && (
            <div className="py-3 border-t border-stone-100">
              <p className="text-[9px] uppercase tracking-[0.2em] text-stone-300 mb-2">Accessory</p>
              <div className="flex flex-col gap-2">
                {strengthP!.sections.accessory!.map((ex, i) => (
                  <div key={i} className="flex items-baseline justify-between">
                    <span className="text-[12px] text-stone-700 font-medium">{ex.name}</span>
                    <span className="text-[11px] text-stone-400">
                      {prescLine([ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : null, ex.load])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Finisher */}
          {(strengthP?.sections?.finisher ?? []).length > 0 && (
            <div className="py-3 border-t border-stone-100">
              <p className="text-[9px] uppercase tracking-[0.2em] text-stone-300 mb-2">Finisher</p>
              {strengthP!.sections.finisher!.map((ex, i) => (
                <div key={i} className="flex flex-col gap-1 mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-medium text-stone-700">{ex.name}</span>
                    {ex.rounds && <span className="text-[11px] text-stone-400">{ex.rounds} rounds</span>}
                  </div>
                  {ex.items?.map((item, j) => (
                    <span key={j} className="text-[11px] text-stone-400 pl-2">· {item}</span>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Cool-down */}
          {(strengthP?.sections?.cooldown ?? []).length > 0 && (
            <div className="py-3 border-t border-stone-100">
              <p className="text-[9px] uppercase tracking-[0.2em] text-stone-300 mb-2">Cool-down</p>
              <div className="flex flex-col gap-1.5">
                {strengthP!.sections.cooldown!.map((ex, i) => (
                  <div key={i} className="flex items-baseline justify-between">
                    <span className="text-[12px] text-stone-500">{ex.name}</span>
                    {ex.notes && <span className="text-[11px] text-stone-300">{ex.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── WOD ── */}
      {isWod && (
        <div className="flex flex-col gap-3">
          {wodP?.sections?.main?.structure && (
            <p className="text-sm font-medium text-stone-700">{wodP.sections.main.structure}</p>
          )}
          <div className="flex gap-4">
            {wodP?.format && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.15em] text-stone-400 mb-0.5">Format</p>
                <p className="text-sm font-semibold">{WOD_FORMAT[wodP.format] ?? wodP.format}</p>
              </div>
            )}
            {wodP?.durationCapMin && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.15em] text-stone-400 mb-0.5">Cap</p>
                <p className="text-sm font-semibold">{wodP.durationCapMin} min</p>
              </div>
            )}
            {wodP?.sections?.main?.targetEffort && (
              <div>
                <p className="text-[9px] uppercase tracking-[0.15em] text-stone-400 mb-0.5">Effort</p>
                <p className="text-sm font-semibold">{wodP.sections.main.targetEffort}</p>
              </div>
            )}
          </div>
          {(wodP?.sections?.main?.stations ?? []).length > 0 && (
            <div>
              <p className="text-[9px] uppercase tracking-[0.15em] text-stone-400 mb-2">Stations</p>
              <div className="flex flex-col gap-2">
                {wodP!.sections.main.stations.map((station, i) => (
                  <div key={i} className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="text-stone-300 text-[10px] w-4 shrink-0">{i + 1}</span>
                      <span className="font-medium text-stone-900">{station.movement}</span>
                      {station.reps && <span className="text-stone-500 text-[12px]">{station.reps} reps</span>}
                      {station.distance && <span className="text-stone-500 text-[12px]">{station.distance}</span>}
                      {station.calories && <span className="text-stone-500 text-[12px]">{station.calories} cal</span>}
                    </div>
                    {station.load && <span className="text-[11px] text-stone-400">{station.load}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Rest ── */}
      {isRest && (
        <p className="text-[11px] text-stone-400">Recovery day. Let your body adapt.</p>
      )}

      {/* ── Logged actuals ── */}
      {hasActual && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2.5">
          <p className="text-[9px] uppercase tracking-[0.15em] text-emerald-600 mb-1.5">Logged</p>
          <div className="flex flex-wrap gap-2 text-[12px]">
            {session.actual.distanceKm && <span className="font-semibold">{session.actual.distanceKm} km</span>}
            {session.actual.pace && <span className="text-stone-500">{session.actual.pace}</span>}
            {session.actual.effort && <span className="text-stone-500 capitalize">{session.actual.effort} effort</span>}
            {session.actual.avgHr && <span className="text-stone-500">♥ {session.actual.avgHr} bpm</span>}
            {session.actual.elevationGain ? <span className="text-stone-500">↑ {session.actual.elevationGain}m</span> : null}
            {session.actual.sufferScore ? <span className="text-stone-500">effort score {session.actual.sufferScore}</span> : null}
            {session.actual.workoutType && <span className="text-stone-500 capitalize">{session.actual.workoutType.replace("_", " ")}</span>}
            {session.actual.achievements ? <span className="text-stone-500">🏆 {session.actual.achievements} PR{session.actual.achievements > 1 ? "s" : ""}</span> : null}
            {session.actual.notes && <span className="text-stone-400 italic w-full">{session.actual.notes}</span>}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      {!isRest && (
        <div className="pt-1 border-t border-stone-100 flex flex-col gap-3">
          {session.completed ? (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] uppercase tracking-[0.1em] text-emerald-600">Session complete</span>
              <button
                onClick={() => onToggle(blockId, weekId, session.id, session.completed)}
                className="text-[10px] uppercase tracking-[0.1em] text-stone-300 hover:text-stone-500 transition-colors"
              >Undo</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              {/* Strava expanded form — replaces log input when active */}
              {stravaExpanded && stravaActivity && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-orange-500 shrink-0" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                      </svg>
                      <span className="text-[12px] font-semibold text-orange-700">
                        {(stravaActivity.distance / 1000).toFixed(1)} km · {computePaceStr(stravaActivity.moving_time, stravaActivity.distance)}
                      </span>
                      <span className="text-[10px] text-orange-400 truncate">{stravaActivity.name}</span>
                    </div>
                    <button onClick={() => setStravaExpanded(false)} className="text-orange-300 hover:text-orange-500 text-base leading-none ml-2 shrink-0">×</button>
                  </div>
                  {(stravaActivity.average_heartrate || stravaActivity.total_elevation_gain || stravaActivity.suffer_score || stravaActivity.achievement_count) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {stravaActivity.average_heartrate && <span className="text-[10px] text-orange-500">♥ {Math.round(stravaActivity.average_heartrate)} bpm</span>}
                      {stravaActivity.total_elevation_gain ? <span className="text-[10px] text-orange-500">↑ {Math.round(stravaActivity.total_elevation_gain)}m</span> : null}
                      {stravaActivity.suffer_score ? <span className="text-[10px] text-orange-500">effort {stravaActivity.suffer_score}</span> : null}
                      {stravaActivity.achievement_count ? <span className="text-[10px] text-orange-500">🏆 {stravaActivity.achievement_count} PR{stravaActivity.achievement_count > 1 ? "s" : ""}</span> : null}
                    </div>
                  )}
                  <input
                    type="text"
                    value={stravaNote}
                    onChange={e => setStravaNote(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleStravaConfirm(stravaNote)}
                    placeholder="Add a comment (optional)"
                    className="bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition-colors placeholder:text-orange-200"
                    autoFocus
                  />
                  <button
                    onClick={() => handleStravaConfirm(stravaNote)}
                    disabled={stravaSaving}
                    className="w-full bg-stone-900 hover:bg-stone-800 text-white text-[11px] tracking-[0.1em] uppercase py-2.5 rounded-lg disabled:opacity-40 transition-colors"
                  >{stravaSaving ? "Saving…" : "Save & complete"}</button>
                </div>
              )}

              {!stravaExpanded && !parsed ? (
                <>
                  {isRun && stravaActivity && (
                    <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <svg viewBox="0 0 24 24" className="w-3 h-3 fill-orange-500 shrink-0" xmlns="http://www.w3.org/2000/svg">
                          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                        </svg>
                        <span className="text-[11px] text-orange-700">
                          {(stravaActivity.distance / 1000).toFixed(1)} km · {computePaceStr(stravaActivity.moving_time, stravaActivity.distance)}
                        </span>
                      </div>
                      <button
                        onClick={() => setStravaExpanded(true)}
                        className="text-[10px] tracking-[0.1em] uppercase text-orange-600 hover:text-orange-800 font-medium transition-colors"
                      >
                        Import
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
                      className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-stone-400 transition-colors placeholder:text-stone-300"
                    />
                    <button
                      onClick={handleParse}
                      disabled={parsing || !logText.trim()}
                      className="shrink-0 bg-stone-900 hover:bg-stone-700 text-white text-[11px] tracking-[0.1em] uppercase px-4 py-2 rounded-xl disabled:opacity-30 transition-colors"
                    >{parsing ? "…" : "Log"}</button>
                  </div>
                  <button
                    onClick={() => onToggle(blockId, weekId, session.id, session.completed)}
                    className="self-center text-[10px] uppercase tracking-[0.1em] text-stone-300 hover:text-stone-500 transition-colors"
                  >Mark done without logging</button>
                </>
              ) : null}

              {!stravaExpanded && parsed && (
                <>
                  <p className="text-sm text-stone-700 leading-relaxed">{parsed.summary}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirm}
                      disabled={saving}
                      className="flex-1 bg-stone-900 hover:bg-stone-800 text-white text-[11px] tracking-[0.1em] uppercase py-2.5 rounded-xl disabled:opacity-40 transition-colors"
                    >{saving ? "Saving…" : "Save & complete"}</button>
                    <button
                      onClick={() => setParsed(null)}
                      className="px-4 text-[11px] tracking-[0.1em] uppercase text-stone-400 hover:text-stone-700 border border-stone-200 rounded-xl transition-colors"
                    >Edit</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {editOpen && (
        <SessionEditModal
          session={session}
          onSave={async (category, prescription) => {
            await onEditPrescription(blockId, weekId, session.id, category, prescription);
            setEditOpen(false);
          }}
          onClose={() => setEditOpen(false)}
        />
      )}
    </div>
  );
}
