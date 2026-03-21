import { useState } from "react";
import { Session, Category, Actual, Prescription, StrengthPrescription, WodPrescription, RunPrescription } from "../lib/types";
import SessionEditModal from "./SessionEditModal";

interface Props {
  session: Session;
  blockId: string;
  weekId: string;
  isToday?: boolean;
  onToggle: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onCategoryChange: (blockId: string, weekId: string, sessionId: string, category: Category) => void;
  onLogActual: (blockId: string, weekId: string, sessionId: string, actual: Actual) => void;
  onEditPrescription: (blockId: string, weekId: string, sessionId: string, category: Category, prescription: Prescription) => Promise<void>;
}

const RUN_TYPE_LABEL: Record<string, string> = {
  easy: "Easy Run",
  tempo: "Tempo Run",
  long: "Long Run",
  intervals: "Intervals",
};

const WOD_FORMAT_LABEL: Record<string, string> = {
  for_time: "For Time",
  amrap: "AMRAP",
  emom: "EMOM",
  intervals: "Intervals",
  stations: "Stations",
};

export default function SessionRow({ session, blockId, weekId, isToday, onToggle, onCategoryChange, onLogActual, onEditPrescription }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [logText, setLogText] = useState("");
  const [parsed, setParsed] = useState<{ summary: string; actual: Actual } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isRun = session.category === "Run";
  const isStrength = session.category === "Strength";
  const isWod = session.category === "WOD";
  const isRest = session.category === "Rest";

  const runP = isRun ? (session.prescription as RunPrescription) : null;
  const strengthP = isStrength ? (session.prescription as StrengthPrescription) : null;
  const wodP = isWod ? (session.prescription as WodPrescription) : null;

  const hasActual = session.actual && Object.keys(session.actual).length > 0;

  const rowLabel = isRun
    ? (RUN_TYPE_LABEL[runP?.type ?? ""] ?? "Run")
    : isStrength
    ? `${strengthP?.focus ? strengthP.focus.charAt(0).toUpperCase() + strengthP.focus.slice(1) + " " : ""}Strength`
    : isWod
    ? (wodP?.sections?.main?.wodName ?? WOD_FORMAT_LABEL[wodP?.format ?? ""] ?? "WOD")
    : isRest
    ? "Rest"
    : "—";

  const handleParse = async () => {
    if (!logText.trim()) return;
    setParsing(true);
    setParsed(null);
    try {
      const res = await fetch("/api/parse-actual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prescription: session.prescription,
          category: session.category,
          userText: logText,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setParsed(data);
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
    onLogActual(blockId, weekId, session.id, actual);
    setParsed(null);
    setLogText("");
    setSaving(false);
  };

  return (
    <div className={`border-b border-stone-100 transition-colors ${isToday ? "bg-blue-50 -mx-4 px-4" : ""}`}>

      {/* Collapsed header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex justify-between items-center py-3 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isToday ? "text-blue-700" : "text-stone-700"}`}>
            {session.day}
          </span>
          {isToday && (
            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full tracking-wide">today</span>
          )}
          {session.completed && !isRest && (
            <span className="text-[10px] text-emerald-500">✓</span>
          )}
          {session.manuallyModified && (
            <span className="text-[9px] text-stone-300 tracking-wide">edited</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[11px] ${isRest ? "text-stone-300" : "text-stone-400"}`}>{rowLabel}</span>
          {runP?.distanceKm && (
            <span className="text-[11px] text-stone-300">{runP.distanceKm}km</span>
          )}
          {!isRest && (
            <button
              onClick={e => { e.stopPropagation(); setEditModalOpen(true); }}
              className="text-stone-300 hover:text-stone-600 text-[13px] leading-none px-1 transition-colors"
              title="Edit session"
            >
              ✎
            </button>
          )}
          <span className="text-stone-200 text-[10px]">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="pb-4 flex flex-col gap-4">

          {/* Run prescription */}
          {isRun && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-5">
                {runP?.distanceKm != null && (
                  <div>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-0.5">Distance</p>
                    <p className="text-sm font-semibold">{runP.distanceKm} km</p>
                  </div>
                )}
                {runP?.targetPace && (
                  <div>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-0.5">Pace</p>
                    <p className="text-sm font-semibold">{runP.targetPace}</p>
                  </div>
                )}
              </div>

              {/* Intervals */}
              {runP?.type === "intervals" && runP?.intervals && runP.intervals.length > 0 && (
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-1.5">Intervals</p>
                  <div className="flex flex-col gap-1">
                    {runP.intervals.map((interval, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-stone-300 text-[11px] w-4">{i + 1}</span>
                        <span className="font-medium">{interval.reps}×</span>
                        {interval.distanceM && <span>{interval.distanceM}m</span>}
                        {interval.targetPace && <span className="text-stone-400">@ {interval.targetPace}</span>}
                        {interval.restSec && <span className="text-stone-300 text-[11px]">{interval.restSec}s rest</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {runP?.guidance && (
                <p className="text-[11px] text-stone-400 leading-relaxed">{runP.guidance}</p>
              )}
            </div>
          )}

          {/* Strength prescription */}
          {isStrength && (
            <div className="flex flex-col gap-3">
              {strengthP?.guidance && (
                <p className="text-[11px] text-stone-400 leading-relaxed">{strengthP.guidance}</p>
              )}

              {/* Warmup */}
              {(strengthP?.sections?.warmup ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-1.5">Warmup</p>
                  <div className="flex flex-col gap-1">
                    {strengthP!.sections.warmup!.map((ex, i) => (
                      <div key={i} className="flex items-baseline gap-2 text-sm">
                        <span className="text-stone-700">{ex.name}</span>
                        {ex.sets && ex.reps && (
                          <span className="text-stone-400 text-[11px]">{ex.sets}×{ex.reps}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main */}
              {(strengthP?.sections?.main ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-1.5">Main</p>
                  <div className="flex flex-col gap-2">
                    {strengthP!.sections.main!.map((ex, i) => (
                      <div key={i} className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="font-semibold text-stone-900 text-sm">{ex.name}</span>
                          {ex.sets && ex.reps && (
                            <span className="text-stone-500 text-[11px]">{ex.sets}×{ex.reps}</span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          {ex.load && <span className="text-[11px] text-stone-400">{ex.load}</span>}
                          {ex.restSec && <span className="text-[10px] text-stone-300">{ex.restSec}s</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Accessory */}
              {(strengthP?.sections?.accessory ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-1.5">Accessory</p>
                  <div className="flex flex-col gap-1">
                    {strengthP!.sections.accessory!.map((ex, i) => (
                      <div key={i} className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="text-stone-700">{ex.name}</span>
                          {ex.sets && ex.reps && (
                            <span className="text-stone-400 text-[11px]">{ex.sets}×{ex.reps}</span>
                          )}
                        </div>
                        {ex.load && <span className="text-[11px] text-stone-400">{ex.load}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Finisher */}
              {(strengthP?.sections?.finisher ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-1.5">Finisher</p>
                  <div className="flex flex-col gap-1">
                    {strengthP!.sections.finisher!.map((ex, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="text-stone-700 font-medium">{ex.name}</span>
                          {ex.rounds && <span className="text-stone-400 text-[11px]">{ex.rounds} rounds</span>}
                        </div>
                        {ex.items && ex.items.map((item, j) => (
                          <span key={j} className="text-[11px] text-stone-400 pl-3">· {item}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cooldown */}
              {(strengthP?.sections?.cooldown ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-1.5">Cooldown</p>
                  <div className="flex flex-col gap-1">
                    {strengthP!.sections.cooldown!.map((ex, i) => (
                      <div key={i} className="flex items-baseline gap-2 text-sm text-stone-500">
                        <span>{ex.name}</span>
                        {ex.notes && <span className="text-stone-300 text-[11px]">{ex.notes}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* WOD prescription */}
          {isWod && (
            <div className="flex flex-col gap-3">
              {/* Structure */}
              {wodP?.sections?.main?.structure && (
                <p className="text-sm font-medium text-stone-700">{wodP.sections.main.structure}</p>
              )}

              {/* Meta */}
              <div className="flex gap-4">
                {wodP?.format && (
                  <div>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-0.5">Format</p>
                    <p className="text-sm font-semibold">{WOD_FORMAT_LABEL[wodP.format] ?? wodP.format}</p>
                  </div>
                )}
                {wodP?.durationCapMin && (
                  <div>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-0.5">Cap</p>
                    <p className="text-sm font-semibold">{wodP.durationCapMin} min</p>
                  </div>
                )}
                {wodP?.sections?.main?.targetEffort && (
                  <div>
                    <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-0.5">Effort</p>
                    <p className="text-sm font-semibold">{wodP.sections.main.targetEffort}</p>
                  </div>
                )}
              </div>

              {/* Stations */}
              {(wodP?.sections?.main?.stations ?? []).length > 0 && (
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-1.5">Stations</p>
                  <div className="flex flex-col gap-2">
                    {wodP!.sections.main.stations.map((station, i) => (
                      <div key={i} className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-2 text-sm">
                          <span className="text-stone-300 text-[11px] w-4 shrink-0">{i + 1}</span>
                          <span className="font-semibold text-stone-900">{station.movement}</span>
                          {station.reps && <span className="text-stone-500">{station.reps} reps</span>}
                          {station.distance && <span className="text-stone-500">{station.distance}</span>}
                          {station.calories && <span className="text-stone-500">{station.calories} cal</span>}
                        </div>
                        {station.load && <span className="text-[11px] text-stone-400">{station.load}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {wodP?.guidance && (
                <p className="text-[11px] text-stone-400 leading-relaxed">{wodP.guidance}</p>
              )}
            </div>
          )}

          {/* Rest */}
          {isRest && (
            <p className="text-[11px] text-stone-400">Recovery day.</p>
          )}

          {/* Already logged actuals */}
          {hasActual && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm">
              <p className="text-[10px] tracking-[0.15em] uppercase text-emerald-600 mb-1.5">Logged</p>
              {session.actual.distanceKm && <p>{session.actual.distanceKm} km</p>}
              {session.actual.pace && <p>{session.actual.pace}</p>}
              {session.actual.effort && <p className="capitalize">{session.actual.effort} effort</p>}
              {session.actual.notes && <p className="text-stone-500 text-[11px] italic">{session.actual.notes}</p>}
            </div>
          )}

          {/* Complete toggle */}
          {!isRest && (
            <button
              onClick={() => onToggle(blockId, weekId, session.id, session.completed)}
              className={`text-[11px] tracking-[0.1em] uppercase px-3 py-2 rounded-lg font-medium transition-colors w-fit ${
                session.completed
                  ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                  : "bg-stone-900 text-white hover:bg-stone-700"
              }`}
            >
              {session.completed ? "Completed ✓" : "Mark complete"}
            </button>
          )}

          {/* Log actuals */}
          {!isRest && (
            <div className="flex flex-col gap-2">
              <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400">How did it go?</p>

              {!parsed ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={logText}
                    onChange={(e) => setLogText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleParse()}
                    placeholder={isRun ? "e.g. Did 6km at 5:40, felt strong" : "e.g. Good session, hit all the sets"}
                    className="flex-1 border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors placeholder:text-stone-300"
                  />
                  <button
                    onClick={handleParse}
                    disabled={parsing || !logText.trim()}
                    className="text-[11px] tracking-[0.1em] uppercase px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg disabled:opacity-40 hover:bg-stone-200 transition-colors"
                  >
                    {parsing ? "..." : "Parse"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="bg-stone-50 border border-stone-100 rounded-lg px-3 py-2 text-sm text-stone-700">
                    {parsed.summary}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirm}
                      disabled={saving}
                      className="text-[11px] tracking-[0.1em] uppercase px-3 py-2 bg-stone-900 text-white rounded-lg"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setParsed(null)}
                      className="text-[11px] tracking-[0.1em] uppercase px-3 py-2 border border-stone-200 rounded-lg text-stone-500"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Category selector */}
          <select
            value={session.category || ""}
            onChange={(e) => onCategoryChange(blockId, weekId, session.id, (e.target.value || null) as Category)}
            className="border-0 border-b border-stone-200 pb-1 text-[11px] text-stone-400 bg-transparent focus:outline-none w-fit"
          >
            <option value="">—</option>
            <option value="Run">Run</option>
            <option value="Strength">Strength</option>
            <option value="WOD">WOD</option>
            <option value="Rest">Rest</option>
          </select>

        </div>
      )}
      {editModalOpen && (
        <SessionEditModal
          session={session}
          onSave={async (category, prescription) => {
            await onEditPrescription(blockId, weekId, session.id, category, prescription);
            setEditModalOpen(false);
          }}
          onClose={() => setEditModalOpen(false)}
        />
      )}
    </div>
  );
}
