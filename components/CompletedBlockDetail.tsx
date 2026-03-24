"use client";

import { useState } from "react";
import { TrainingBlock, TrainingWeek, Session, StrengthPrescription, RunPrescription, WodPrescription } from "../lib/types";
import { computeStrengthLoadProgression } from "../lib/analytics";

interface Props {
  block: TrainingBlock;
  weeks: TrainingWeek[];
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const CATEGORY_BADGE: Record<string, string> = {
  Run: "bg-blue-500/10 text-blue-400",
  Strength: "bg-amber-500/10 text-amber-400",
  WOD: "bg-purple-500/10 text-purple-400",
  Rest: "bg-stone-800 text-stone-500",
};

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

function prescriptionSummary(session: Session): string {
  if (!session.category || session.category === "Rest") return "Rest";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = session.prescription as any;
  if (session.category === "Run") {
    const rp = p as RunPrescription;
    const label = RUN_TYPE_LABEL[rp?.type ?? ""] ?? "Run";
    const parts: string[] = [label];
    if (rp?.distanceKm != null) parts.push(`${rp.distanceKm}km`);
    if (rp?.targetPace) parts.push(`@ ${rp.targetPace}`);
    return parts.join(" ");
  }
  if (session.category === "Strength") {
    const sp = p as StrengthPrescription;
    const focus = sp?.focus ? sp.focus.charAt(0).toUpperCase() + sp.focus.slice(1) : "";
    const parts: string[] = [`${focus} Strength`.trim()];
    if (sp?.durationMin) parts.push(`${sp.durationMin}min`);
    return parts.join(" ");
  }
  if (session.category === "WOD") {
    const wp = p as WodPrescription;
    const name = wp?.sections?.main?.wodName;
    const format = WOD_FORMAT_LABEL[wp?.format ?? ""] ?? "WOD";
    const parts: string[] = [name ?? format];
    if (wp?.durationCapMin) parts.push(`${wp.durationCapMin}min cap`);
    return parts.join(" ");
  }
  return session.category;
}

function actualSummary(session: Session): string | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const a = session.actual as any;
  if (!a || Object.keys(a).length === 0) return null;
  if (session.category === "Run") {
    const parts: string[] = [];
    if (a.distanceKm) parts.push(`${a.distanceKm}km`);
    if (a.pace) parts.push(`@ ${a.pace}`);
    if (parts.length === 0) return "Logged";
    return parts.join(" ");
  }
  if (session.category === "Strength") {
    const exs = a.strengthExercises;
    if (exs && exs.length > 0) return `Logged (${exs.length} exercise${exs.length === 1 ? "" : "s"})`;
    return "Logged";
  }
  if (session.category === "WOD") {
    if (a.notes) return a.notes;
    return "Logged";
  }
  return null;
}

const TREND_SYMBOL: Record<string, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const TREND_CLASS: Record<string, string> = {
  up: "text-emerald-400",
  down: "text-red-400",
  flat: "text-stone-400",
};

export default function CompletedBlockDetail({ weeks }: Props) {
  const [collapsedWeeks, setCollapsedWeeks] = useState<Set<string>>(new Set());

  const toggleWeek = (weekId: string) => {
    setCollapsedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  };

  const strengthProgression = computeStrengthLoadProgression(weeks);

  return (
    <div className="px-4 py-4 flex flex-col gap-4">

      {/* Week list */}
      {weeks.map((week, wi) => {
        const isCollapsed = collapsedWeeks.has(week.id);
        const activeSessions = week.sessions.filter(s => s.category && s.category !== "Rest");

        return (
          <div key={week.id} className="flex flex-col gap-2">
            {/* Week header */}
            <button
              onClick={() => toggleWeek(week.id)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-stone-500">
                  Week {wi + 1}
                </span>
                <span className="text-[10px] text-stone-600">
                  {formatDateShort(week.startDate)} – {formatDateShort(week.endDate)}
                </span>
              </div>
              <span className="text-[10px] text-stone-500">{isCollapsed ? "▶" : "▼"}</span>
            </button>

            {!isCollapsed && (
              <div className="flex flex-col gap-1.5 pl-2 border-l border-stone-800">
                {activeSessions.length === 0 ? (
                  <p className="text-[11px] text-stone-600 italic">No sessions this week</p>
                ) : (
                  activeSessions.map(session => {
                    const actual = actualSummary(session);
                    const catBadge = session.category ? CATEGORY_BADGE[session.category] ?? "bg-stone-800 text-stone-400" : "bg-stone-800 text-stone-400";
                    return (
                      <div key={session.id} className="flex flex-col gap-0.5 py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-500 w-7 shrink-0">{session.day.slice(0, 3)}</span>
                          {session.category && (
                            <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded ${catBadge}`}>
                              {session.category}
                            </span>
                          )}
                          {session.completed && (
                            <span className="text-[10px] text-emerald-400">✓</span>
                          )}
                          <span className="text-[11px] text-stone-300 truncate">
                            {prescriptionSummary(session)}
                          </span>
                        </div>
                        {actual && (
                          <div className="pl-9">
                            <span className="text-[10px] text-emerald-500">{actual}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Strength load progression table */}
      {strengthProgression.length > 0 && (
        <div className="pt-4 border-t border-stone-800 flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-widest text-stone-500">Strength Progression</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-stone-500 uppercase tracking-wide pb-2 pr-3 font-medium">Exercise</th>
                  {weeks.map((_, wi) => (
                    <th key={wi} className="text-center text-stone-500 uppercase tracking-wide pb-2 px-1 font-medium w-8">
                      W{wi + 1}
                    </th>
                  ))}
                  <th className="text-center text-stone-500 uppercase tracking-wide pb-2 px-1 font-medium w-6"></th>
                </tr>
              </thead>
              <tbody>
                {strengthProgression.map(prog => (
                  <tr key={prog.exerciseName} className="border-t border-stone-800/60">
                    <td className="py-1.5 pr-3 text-stone-300 font-medium">{prog.exerciseName}</td>
                    {weeks.map((_, wi) => {
                      const entry = prog.entries.find(e => e.weekNumber === wi + 1);
                      return (
                        <td key={wi} className="py-1.5 px-1 text-center">
                          {entry?.logged && entry.load ? (
                            <span className="text-stone-300">{entry.load}</span>
                          ) : entry?.logged ? (
                            <span className="text-emerald-500/60">✓</span>
                          ) : (
                            <span className="text-stone-700">–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-1 text-center">
                      {prog.trend ? (
                        <span className={`font-bold ${TREND_CLASS[prog.trend]}`}>
                          {TREND_SYMBOL[prog.trend]}
                        </span>
                      ) : (
                        <span className="text-stone-700">–</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
