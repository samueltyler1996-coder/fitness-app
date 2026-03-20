import { useState } from "react";
import { Session, Category, Actual } from "../lib/types";

interface Props {
  session: Session;
  blockId: string;
  weekId: string;
  isToday?: boolean;
  onToggle: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onCategoryChange: (blockId: string, weekId: string, sessionId: string, category: Category) => void;
  onLogActual: (blockId: string, weekId: string, sessionId: string, actual: Actual) => void;
}

const RUN_TYPE_LABEL: Record<string, string> = {
  easy: "Easy Run",
  tempo: "Tempo Run",
  long: "Long Run",
  intervals: "Intervals",
};

export default function SessionRow({ session, blockId, weekId, isToday, onToggle, onCategoryChange, onLogActual }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [logText, setLogText] = useState("");
  const [parsed, setParsed] = useState<{ summary: string; actual: Actual } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const isRun = session.category === "Run";
  const isStrength = session.category === "Strength";
  const isRest = session.category === "Rest";
  const runLabel = RUN_TYPE_LABEL[session.prescription?.type ?? ""] ?? "Run";
  const hasActual = session.actual && Object.keys(session.actual).length > 0;

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
    <div className={`border-b transition-colors ${isToday ? "bg-blue-50 -mx-4 px-4" : ""}`}>

      {/* Collapsed header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex justify-between items-center py-3 cursor-pointer hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <span className={`font-semibold text-sm ${isToday ? "text-blue-700" : ""}`}>
            {session.day}
          </span>
          {isToday && (
            <span className="text-xs bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded-full">Today</span>
          )}
          {session.completed && !isRest && (
            <span className="text-xs text-green-600">✓</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isRun && runLabel && (
            <span className="text-xs text-gray-500 truncate max-w-[140px]">{runLabel}</span>
          )}
          {isStrength && session.prescription?.focus && (
            <span className="text-xs text-gray-500 capitalize truncate max-w-[140px]">{session.prescription.focus} strength</span>
          )}
          {isRest && <span className="text-xs text-gray-400">Rest</span>}
          <span className="text-gray-300 text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="pb-4 flex flex-col gap-4">

          {/* Prescription */}
          {isRun && (
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Distance</p>
                  <p className="font-medium">{session.prescription?.distanceKm} km</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Pace</p>
                  <p className="font-medium">{session.prescription?.targetPace}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Type</p>
                  <p className="font-medium capitalize">{session.prescription?.type}</p>
                </div>
              </div>
              {session.prescription?.guidance && (
                <p className="text-sm text-gray-500 italic">{session.prescription.guidance}</p>
              )}
            </div>
          )}

          {isStrength && (
            <div className="flex flex-col gap-1 text-sm">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Focus</p>
                <p className="font-medium capitalize">{session.prescription?.focus}</p>
              </div>
              {session.prescription?.guidance && (
                <p className="text-sm text-gray-500 italic">{session.prescription.guidance}</p>
              )}
            </div>
          )}

          {isRest && (
            <p className="text-sm text-gray-400">Recovery day. No training scheduled.</p>
          )}

          {/* Already logged actuals */}
          {hasActual && (
            <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm">
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Logged</p>
              {session.actual.distanceKm && <p>{session.actual.distanceKm} km</p>}
              {session.actual.pace && <p>{session.actual.pace}</p>}
              {session.actual.effort && <p className="capitalize">{session.actual.effort} effort</p>}
              {session.actual.notes && <p className="text-gray-500 italic">{session.actual.notes}</p>}
            </div>
          )}

          {/* Complete button */}
          {!isRest && (
            <button
              onClick={() => onToggle(blockId, weekId, session.id, session.completed)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors w-fit ${
                session.completed
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-900 text-white hover:bg-gray-700"
              }`}
            >
              {session.completed ? "Completed ✓" : "Mark complete"}
            </button>
          )}

          {/* Log actuals — only for non-rest sessions */}
          {!isRest && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">How did it go?</p>

              {!parsed ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={logText}
                    onChange={(e) => setLogText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleParse()}
                    placeholder={isRun ? "e.g. Did 6km at 5:40, felt strong" : "e.g. Good session, focused on form"}
                    className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button
                    onClick={handleParse}
                    disabled={parsing || !logText.trim()}
                    className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50"
                  >
                    {parsing ? "..." : "Parse"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="bg-gray-50 border rounded-lg px-3 py-2 text-sm text-gray-700">
                    {parsed.summary}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleConfirm}
                      disabled={saving}
                      className="text-sm px-3 py-1.5 bg-gray-900 text-white rounded-lg"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setParsed(null)}
                      className="text-sm px-3 py-1.5 border rounded-lg text-gray-500"
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
            className="border rounded px-2 py-1.5 text-xs text-gray-500 w-fit"
          >
            <option value="">—</option>
            <option value="Run">Run</option>
            <option value="Strength">Strength</option>
            <option value="Rest">Rest</option>
          </select>

        </div>
      )}
    </div>
  );
}
