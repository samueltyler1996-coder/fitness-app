"use client";
import { useState } from "react";
import { TrainingWeek, SessionChange, Category, Prescription } from "../lib/types";

interface Props {
  week: TrainingWeek;
  weekIndex: number;
  totalWeeks: number;
  previousWeek: TrainingWeek | null;
  blockGoal: string;
  onApply: (changes: SessionChange[], meta: { firstMessage: string; summary: string }) => Promise<void>;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  Run: "bg-blue-100 text-blue-700",
  Strength: "bg-amber-100 text-amber-700",
  WOD: "bg-violet-100 text-violet-700",
  Rest: "bg-stone-100 text-stone-400",
};

function prescriptionSummary(category: Category, p: any): string {
  if (!category) return "—";
  if (category === "Rest") {
    const type = p?.recoveryType?.replace("_", " ");
    return type && type !== "full rest" ? `Rest · ${type}` : "Rest";
  }
  if (category === "Run") {
    const parts = [p?.type, p?.distanceKm ? `${p.distanceKm}km` : null, p?.targetPace].filter(Boolean);
    return parts.join(" · ") || "Run";
  }
  if (category === "Strength") return p?.focus ? `${p.focus} strength` : "Strength";
  if (category === "WOD") return p?.sections?.main?.wodName ?? p?.format ?? "WOD";
  return category ?? "—";
}

type State = "idle" | "generating" | "preview";

export default function RegenerateWeekModal({ week, weekIndex, totalWeeks, previousWeek, blockGoal, onApply, onClose }: Props) {
  const [state, setState] = useState<State>("idle");
  const [instruction, setInstruction] = useState("");
  const [proposed, setProposed] = useState<{ summary: string; sessions: { day: string; category: Category; prescription: Prescription }[] } | null>(null);
  const [applying, setApplying] = useState(false);

  const weekNumber = weekIndex + 1;

  const handleGenerate = async () => {
    setState("generating");
    try {
      const res = await fetch("/api/regenerate-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: blockGoal,
          weekNumber,
          totalWeeks,
          startDate: week.startDate,
          endDate: week.endDate,
          currentSessions: week.sessions,
          previousWeekSessions: previousWeek?.sessions ?? [],
          instruction: instruction.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setProposed(data);
      setState("preview");
    } catch {
      setState("idle");
    }
  };

  const handleApply = async () => {
    if (!proposed) return;
    setApplying(true);

    const changes: SessionChange[] = proposed.sessions
      .map(p => {
        const existing = week.sessions.find(s => s.day === p.day);
        if (!existing || existing.completed) return null;
        return {
          weekId: week.id,
          sessionId: existing.id,
          day: p.day,
          category: p.category,
          prescription: p.prescription,
        };
      })
      .filter(Boolean) as SessionChange[];

    const meta = {
      firstMessage: instruction.trim() ? `Regenerate week ${weekNumber}: "${instruction.trim()}"` : `Regenerate week ${weekNumber}`,
      summary: proposed.summary,
    };

    await onApply(changes, meta);
    setApplying(false);
    onClose();
  };

  const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const sortedProposed = proposed?.sessions
    ? [...proposed.sessions].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
    : [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col max-w-md w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 shrink-0">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">Week {weekNumber} of {totalWeeks}</p>
            <p className="font-bold text-stone-900">Regenerate week</p>
          </div>
          <button onClick={onClose} className="text-stone-300 hover:text-stone-700 text-2xl leading-none">×</button>
        </div>

        <div className="overflow-y-auto px-5 py-5 flex flex-col gap-5">

          {/* Idle — instruction form */}
          {state === "idle" && (
            <>
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-1">
                  {week.startDate} → {week.endDate}
                </p>
                <p className="text-sm text-stone-500">
                  The AI will generate a new week based on your goal and block context.
                </p>
              </div>

              <div>
                <label className="text-[10px] tracking-[0.15em] uppercase text-stone-400 block mb-2">
                  Anything to keep in mind?
                </label>
                <input
                  type="text"
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGenerate()}
                  placeholder="Optional — leave blank to regenerate from context"
                  className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors placeholder:text-stone-300"
                />
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {["Make this a deload", "Keep my long run", "More running", "Less intensity, I'm tired"].map(hint => (
                    <button
                      key={hint}
                      onClick={() => setInstruction(hint)}
                      className="text-[10px] text-stone-400 border border-stone-200 rounded-full px-2.5 py-1 hover:border-stone-400 hover:text-stone-600 transition-colors"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Generating */}
          {state === "generating" && (
            <div className="py-8 flex flex-col items-center gap-3">
              <p className="text-sm text-stone-400">Regenerating week {weekNumber}…</p>
              <p className="text-[11px] text-stone-300">Building sessions around your goal</p>
            </div>
          )}

          {/* Preview */}
          {state === "preview" && proposed && (
            <>
              {proposed.summary && (
                <p className="text-sm text-stone-600 leading-relaxed">{proposed.summary}</p>
              )}

              {/* Manually modified warning */}
              {(() => {
                const modifiedDays = sortedProposed
                  .filter(p => {
                    const existing = week.sessions.find(s => s.day === p.day);
                    return existing?.manuallyModified && !existing.completed;
                  })
                  .map(p => p.day);
                return modifiedDays.length > 0 ? (
                  <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    ⚠ {modifiedDays.join(", ")} {modifiedDays.length > 1 ? "were" : "was"} manually edited — applying will overwrite {modifiedDays.length > 1 ? "those" : "that"} edit.
                  </p>
                ) : null;
              })()}

              <div className="flex flex-col gap-0.5">
                {sortedProposed.map(proposed => {
                  const existing = week.sessions.find(s => s.day === proposed.day);
                  const isCompleted = existing?.completed;
                  const fromLabel = existing ? prescriptionSummary(existing.category, existing.prescription as any) : "—";
                  const toLabel = prescriptionSummary(proposed.category, proposed.prescription as any);
                  const unchanged = fromLabel === toLabel;

                  return (
                    <div key={proposed.day} className={`py-2.5 border-b border-stone-100 last:border-0 ${isCompleted ? "opacity-40" : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-stone-700">{proposed.day}</span>
                        <div className="flex items-center gap-1.5">
                          {isCompleted && <span className="text-[9px] text-stone-300 uppercase tracking-wide">completed — skipped</span>}
                          {existing?.manuallyModified && !isCompleted && (
                            <span className="text-[9px] text-amber-500 tracking-wide">edited</span>
                          )}
                        </div>
                      </div>
                      {!isCompleted && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-stone-300 w-6 shrink-0">was</span>
                          <span className="text-stone-400">{fromLabel}</span>
                          {!unchanged && (
                            <>
                              <span className="text-stone-200">→</span>
                              <span className={`px-2 py-0.5 rounded-full ${CATEGORY_COLORS[proposed.category ?? "Rest"]}`}>
                                {toLabel}
                              </span>
                            </>
                          )}
                          {unchanged && <span className="text-stone-200 text-[10px]">unchanged</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="h-2" />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-100 flex gap-3 shrink-0">
          {state === "idle" && (
            <>
              <button
                onClick={handleGenerate}
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white text-[11px] tracking-[0.1em] uppercase py-3 rounded-xl transition-colors"
              >
                Regenerate
              </button>
              <button
                onClick={onClose}
                className="px-5 text-[11px] tracking-[0.1em] uppercase text-stone-400 hover:text-stone-700 border border-stone-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {state === "generating" && (
            <button disabled className="flex-1 bg-stone-100 text-stone-300 text-[11px] tracking-[0.1em] uppercase py-3 rounded-xl">
              Generating…
            </button>
          )}

          {state === "preview" && (
            <>
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white text-[11px] tracking-[0.1em] uppercase py-3 rounded-xl disabled:opacity-40 transition-colors"
              >
                {applying ? "Applying…" : "Apply"}
              </button>
              <button
                onClick={() => { setState("idle"); setProposed(null); }}
                className="px-5 text-[11px] tracking-[0.1em] uppercase text-stone-400 hover:text-stone-700 border border-stone-200 rounded-xl transition-colors"
              >
                Start over
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
