"use client";
import { useState, useRef, useEffect } from "react";
import {
  TrainingWeek, AdaptResponse, IncidentResponse, SessionChange,
  Category, Prescription, CoachSessionLog, MissedSessionOption,
  IncidentType, IncidentPriorContext,
} from "../lib/types";
import { computeInsights } from "../lib/analytics";

interface Props {
  weeks: TrainingWeek[];
  coachHistory: CoachSessionLog[];
  progressContext: string;
  goal?: string;
  onApplyChanges: (changes: SessionChange[], meta: { firstMessage: string; summary: string; incidentType?: IncidentType }) => Promise<void>;
}

type Message =
  | { role: "user"; content: string }
  | {
      role: "coach";
      content: string;
      changes: SessionChange[];
      chips?: string[];
      options?: MissedSessionOption[];
      incidentType?: IncidentType;
    };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function prescriptionLabel(category: Category, prescription: Prescription): string {
  if (!category || category === "Rest") return "Rest";
  const p = prescription as any;
  const runType: Record<string, string> = { easy: "Easy", tempo: "Tempo", long: "Long", intervals: "Intervals" };
  if (category === "Run") {
    return [runType[p?.type ?? ""] ?? "Run", p?.distanceKm ? `${p.distanceKm}km` : null, p?.targetPace ?? null]
      .filter(Boolean).join(" · ");
  }
  if (category === "Strength") return p?.focus ? `${p.focus} strength` : "Strength";
  if (category === "WOD") return p?.sections?.main?.wodName ?? p?.format ?? "WOD";
  return category;
}

function categoryChar(category: Category): string {
  return category === "Run" ? "R" : category === "Strength" ? "S" : category === "WOD" ? "W" : "";
}

// Detect messages that are likely incidents (illness/injury/missed/fatigue)
// Use \w* after stems to catch all conjugations: tweak→tweaked, strain→strained, etc.
function looksLikeIncident(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(ill|sick|illness|cold|flu|virus|unwell|not well|not feeling|feeling rough|under the weather|poorly)\b/.test(t) ||
    /\b(injur\w*|hurt(?:s|ing)?|pain\w*|sore?\b|tweak\w*|strain\w*|sprain\w*|ach\w*|pull(ed|ing)?\b|torn?\b)\b/.test(t) ||
    /\b(miss(ed)?|skip(ped)?|couldn't|didn't (train|go|run|make it))\b/.test(t) ||
    /\b(tired|exhaust\w*|fatigue\w*|burnout|burnt.?out|worn out|overdone|overtrain\w*)\b/.test(t) ||
    /\b(something came up|can't train|can't run|can't make|scheduling)\b/.test(t)
  );
}

const INCIDENT_SHORTCUTS: { label: string; text: string }[] = [
  { label: "Adjust for fatigue", text: "I'm feeling fatigued this week — can you adjust the load?" },
  { label: "Dealing with an injury", text: "I have an injury I need to work around" },
  { label: "Missed a session", text: "I missed a session" },
];

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const JS_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function sessionCalendarDate(weekStartDate: string, day: string): Date {
  const start = new Date(weekStartDate + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (JS_DAYS[d.getDay()] === day) return d;
  }
  return start;
}

function missableSessionDays(weeks: TrainingWeek[]): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const currentWeek = weeks.find(w => w.startDate <= todayStr && w.endDate >= todayStr);
  if (!currentWeek) return [];
  return currentWeek.sessions
    .filter(s => {
      if (!s.category || s.category === "Rest" || s.completed) return false;
      const d = sessionCalendarDate(currentWeek.startDate, s.day);
      d.setHours(0, 0, 0, 0);
      return d <= today;
    })
    .map(s => s.day);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CoachChat({ weeks, coachHistory, progressContext, goal, onApplyChanges }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentChanges, setCurrentChanges] = useState<SessionChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [incidentContext, setIncidentContext] = useState<IncidentPriorContext | null>(null);
  const [resolvedOptionIndices, setResolvedOptionIndices] = useState<Set<number>>(new Set());
  const [showDayPicker, setShowDayPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasConversation = messages.length > 0;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // ── API calls ───────────────────────────────────────────────────────────────

  const callAdaptPlan = async (messageHistory: Message[]) => {
    const insights = computeInsights(weeks, 4);
    const res = await fetch("/api/adapt-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: messageHistory,
        currentChanges,
        weeks: weeks.slice(0, 3),
        coachHistory,
        insights,
        progressContext,
        goal: goal ?? "",
      }),
    });
    if (!res.ok) throw new Error("API error");
    const data: AdaptResponse = await res.json();
    const msg: Message = { role: "coach", content: data.summary, changes: data.changes };
    setMessages(prev => [...prev, msg]);
    setCurrentChanges(data.changes);
  };

  const callHandleIncident = async (text: string, messageHistory: Message[]) => {
    const insights = computeInsights(weeks, 4);
    const res = await fetch("/api/handle-incident", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, weeks, coachHistory, priorContext: incidentContext, insights, progressContext }),
    });
    if (!res.ok) throw new Error("API error");
    const data: IncidentResponse = await res.json();

    // General classification → fall through to adapt-plan
    if (data.incidentType === "general") {
      await callAdaptPlan(messageHistory);
      return;
    }

    const msg: Message = {
      role: "coach",
      content: data.summary ?? "",
      changes: data.changes ?? [],
      chips: data.followUpChips ?? undefined,
      options: data.options ?? undefined,
      incidentType: data.incidentType,
    };
    setMessages(prev => [...prev, msg]);
    if ((data.changes ?? []).length > 0) setCurrentChanges(data.changes);
    setIncidentContext(data.priorContext ?? null);
  };

  // ── Send handler ────────────────────────────────────────────────────────────

  const handleSend = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      if (incidentContext !== null || looksLikeIncident(text)) {
        await callHandleIncident(text, updatedMessages);
      } else {
        await callAdaptPlan(updatedMessages);
      }
    } catch {
      setMessages(prev => [...prev, { role: "coach", content: "Something went wrong. Try again.", changes: [] }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Option select (missed session) ──────────────────────────────────────────

  const handleOptionSelect = (option: MissedSessionOption, messageIndex: number) => {
    // Lock this message's options so they can't be re-clicked
    setResolvedOptionIndices(prev => new Set([...prev, messageIndex]));

    const userMsg: Message = { role: "user", content: option.label };
    const coachMsg: Message = {
      role: "coach",
      content: option.changes.length === 0
        ? "Got it — continuing as planned. No changes made."
        : option.id === "drop"
        ? "Session dropped. Plan updated — carry on from the next one."
        : `Done. Session moved to ${option.changes[0]?.day ?? "tomorrow"}.`,
      changes: option.changes,
    };
    setMessages(prev => [...prev, userMsg, coachMsg]);
    setCurrentChanges(option.changes);
    setIncidentContext(null);
  };

  // ── Apply / reset ───────────────────────────────────────────────────────────

  const handleApply = async () => {
    if (currentChanges.length === 0) return;
    setApplying(true);
    const firstMsg = messages.find(m => m.role === "user")?.content ?? "";
    const lastCoach = [...messages].reverse().find(m => m.role === "coach") as (Message & { role: "coach" }) | undefined;
    // Derive incident type from last coach message that had one (excludes "general")
    const lastIncidentMsg = [...messages].reverse().find(
      m => m.role === "coach" && (m as any).incidentType && (m as any).incidentType !== "general"
    ) as (Message & { role: "coach"; incidentType?: IncidentType }) | undefined;
    await onApplyChanges(currentChanges, {
      firstMessage: firstMsg,
      summary: lastCoach?.content ?? "",
      incidentType: lastIncidentMsg?.incidentType,
    });
    setApplying(false);
    reset();
  };

  const reset = () => {
    setMessages([]);
    setCurrentChanges([]);
    setInput("");
    setIncidentContext(null);
    setResolvedOptionIndices(new Set());
    setShowDayPicker(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const manuallyModifiedIds = new Set(weeks.flatMap(w => w.sessions).filter(s => s.manuallyModified).map(s => s.id));
  const overwriteCount = currentChanges.filter(c => manuallyModifiedIds.has(c.sessionId)).length;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-stone-100 px-4 py-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">Coach</p>
        {hasConversation && (
          <button
            onClick={reset}
            className="text-[10px] tracking-[0.1em] uppercase text-stone-300 hover:text-stone-500 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Empty state: prompt + shortcuts */}
      {!hasConversation && (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] font-medium text-stone-700 mb-0.5">What's going on?</p>
          <p className="text-[12px] text-stone-400 mb-1">Common situations:</p>
          <div className="flex flex-col gap-1.5">
            {INCIDENT_SHORTCUTS.map(({ label, text }) => (
              <button
                key={label}
                onClick={() => {
                  if (label === "Missed a session") {
                    setShowDayPicker(v => !v);
                  } else {
                    handleSend(text);
                  }
                }}
                className="text-left text-[13px] text-stone-600 border border-stone-200 rounded-lg px-4 py-3 hover:border-stone-400 hover:text-stone-900 hover:bg-stone-50 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
          {showDayPicker && (() => {
            const eligible = missableSessionDays(weeks);
            return (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-stone-400">Which day?</p>
                {eligible.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {eligible.map(day => (
                      <button
                        key={day}
                        onClick={() => { setShowDayPicker(false); handleSend(`I missed my ${day} session — what should I do?`); }}
                        className="text-[11px] text-stone-500 border border-stone-200 rounded-full px-3 py-1.5 hover:border-stone-400 hover:text-stone-700 transition-colors"
                      >
                        {DAY_SHORT[DAY_NAMES.indexOf(day)]}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400">No sessions to reschedule yet this week.</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Conversation thread */}
      {hasConversation && (
        <div ref={scrollRef} className="flex flex-col gap-3 max-h-96 overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i}>

              {/* User bubble */}
              {msg.role === "user" && (
                <div className="flex justify-end">
                  <div className="bg-stone-900 text-white text-sm rounded-2xl rounded-tr-sm px-3 py-2 max-w-[80%]">
                    {msg.content}
                  </div>
                </div>
              )}

              {/* Coach message */}
              {msg.role === "coach" && (
                <div className="flex flex-col gap-2.5">
                  {msg.content && (
                    <p className="text-sm text-stone-600 leading-relaxed">{msg.content}</p>
                  )}

                  {/* Follow-up chips */}
                  {msg.chips && msg.chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {msg.chips.map(chip => (
                        <button
                          key={chip}
                          onClick={() => handleSend(chip)}
                          disabled={loading}
                          className="text-[11px] text-stone-500 border border-stone-200 rounded-full px-3 py-1.5 hover:border-stone-400 hover:text-stone-700 disabled:opacity-40 transition-colors"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Missed session options */}
                  {msg.options && msg.options.length > 0 && !resolvedOptionIndices.has(i) && (
                    <div className="flex flex-col gap-1.5">
                      {msg.options.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => handleOptionSelect(opt, i)}
                          className="text-left border border-stone-200 rounded-xl px-3 py-2.5 hover:border-stone-400 hover:bg-stone-50 transition-all"
                        >
                          <p className="text-sm font-medium text-stone-900">{opt.label}</p>
                          <p className="text-[11px] text-stone-400 mt-0.5">{opt.description}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Proposed changes — only on last coach message */}
                  {i === messages.length - 1 && msg.changes.length > 0 && (
                    <div className="flex flex-col gap-3 pt-1">
                      <p className="text-[9px] tracking-[0.2em] uppercase text-stone-400">Proposed changes</p>
                      {weeks.map((week, wi) => {
                        const weekChanges = msg.changes.filter(c => c.weekId === week.id);
                        if (weekChanges.length === 0) return null;
                        const globalIdx = weeks.findIndex(w => w.id === week.id);
                        return (
                          <div key={week.id} className="flex flex-col gap-0.5">
                            <p className="text-[10px] font-semibold text-stone-500 mb-1">
                              Week {globalIdx + 1}
                              <span className="font-normal text-stone-300"> · {week.startDate}</span>
                            </p>
                            {weekChanges.map((change, j) => {
                              const original = week.sessions.find(s => s.id === change.sessionId);
                              const fromLabel = original ? prescriptionLabel(original.category, original.prescription) : "—";
                              const toLabel = prescriptionLabel(change.category, change.prescription);
                              const unchanged = fromLabel === toLabel;
                              return (
                                <div key={j} className="py-1.5 flex flex-col gap-0.5 border-b border-stone-50 last:border-0">
                                  <span className="text-[12px] font-medium text-stone-700">{change.day}</span>
                                  {!unchanged ? (
                                    <div className="flex items-center gap-1.5 text-[11px]">
                                      <span className="text-stone-300 w-5 shrink-0">was</span>
                                      <span className="text-stone-400">{fromLabel}</span>
                                      <span className="text-stone-200">→</span>
                                      <span className="flex items-center gap-1">
                                        {categoryChar(change.category) && (
                                          <span className="text-[9px] font-semibold text-stone-500 w-3 shrink-0">{categoryChar(change.category)}</span>
                                        )}
                                        <span className="text-stone-700">{toLabel}</span>
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-stone-300">unchanged</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <p className="text-[11px] text-stone-400 tracking-wide">Thinking…</p>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder={hasConversation ? "Reply…" : "Tell me what's happening…"}
          className="flex-1 bg-stone-50 border border-stone-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-stone-400 transition-colors placeholder:text-stone-300"
        />
        <button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="shrink-0 bg-stone-900 hover:bg-stone-700 text-white text-[11px] tracking-[0.1em] uppercase px-4 py-2.5 rounded-xl disabled:opacity-30 transition-colors"
        >
          {loading ? "…" : "Send"}
        </button>
      </div>

      {/* Apply / Cancel */}
      {hasConversation && !loading && (
        <div className="flex flex-col gap-2">
          {overwriteCount > 0 && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              ⚠ {overwriteCount} session{overwriteCount > 1 ? "s" : ""} {overwriteCount > 1 ? "were" : "was"} manually edited — applying will overwrite {overwriteCount > 1 ? "those" : "that"}.
            </p>
          )}
          <div className="flex gap-2">
            {currentChanges.length > 0 && (
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex-1 bg-stone-900 hover:bg-stone-800 text-white text-[11px] tracking-[0.1em] uppercase py-3 rounded-xl disabled:opacity-40 transition-colors"
              >
                {applying ? "Applying…" : overwriteCount > 0 ? "Apply anyway" : "Apply changes"}
              </button>
            )}
            <button
              onClick={reset}
              className={`text-[11px] tracking-[0.1em] uppercase py-3 rounded-xl border border-stone-200 text-stone-400 hover:text-stone-700 hover:border-stone-400 transition-colors ${currentChanges.length > 0 ? "px-4" : "flex-1"}`}
            >
              {currentChanges.length > 0 ? "Cancel" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
