import { useState } from "react";
import { TrainingWeek, AdaptResponse, SessionChange, Category, Prescription } from "../lib/types";

interface Props {
  weeks: TrainingWeek[];
  onApplyChanges: (changes: SessionChange[]) => Promise<void>;
}

type Message =
  | { role: "user"; content: string }
  | { role: "coach"; content: string; changes: SessionChange[] };

function prescriptionLabel(category: Category, prescription: Prescription): string {
  if (!category || category === "Rest") return "Rest";
  const typeLabel: Record<string, string> = { easy: "Easy", tempo: "Tempo", long: "Long", intervals: "Intervals" };
  if (category === "Run") {
    const parts = [
      typeLabel[prescription?.type ?? ""] ?? "Run",
      prescription?.distanceKm ? `${prescription.distanceKm}km` : null,
      prescription?.targetPace ?? null,
    ].filter(Boolean);
    return parts.join(" · ");
  }
  if (category === "Strength") {
    return prescription?.focus ? `${prescription.focus} strength` : "Strength";
  }
  return category;
}

function categoryBadge(category: Category) {
  return category === "Run"
    ? "bg-blue-100 text-blue-700"
    : category === "Strength"
    ? "bg-orange-100 text-orange-700"
    : "bg-gray-100 text-gray-500";
}

export default function CoachChat({ weeks, onApplyChanges }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentChanges, setCurrentChanges] = useState<SessionChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const relevantWeeks = weeks.slice(0, 3);
  const hasConversation = messages.length > 0;
  const lastCoachMessage = [...messages].reverse().find(m => m.role === "coach") as Message & { role: "coach" } | undefined;

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/adapt-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          currentChanges,
          weeks: relevantWeeks,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const data: AdaptResponse = await res.json();

      const coachMessage: Message = { role: "coach", content: data.summary, changes: data.changes };
      setMessages(prev => [...prev, coachMessage]);
      setCurrentChanges(data.changes);
    } catch {
      const errorMessage: Message = { role: "coach", content: "Sorry, something went wrong. Try again.", changes: [] };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (currentChanges.length === 0) return;
    setApplying(true);
    await onApplyChanges(currentChanges);
    setApplying(false);
    setMessages([]);
    setCurrentChanges([]);
    setInput("");
  };

  const handleCancel = () => {
    setMessages([]);
    setCurrentChanges([]);
    setInput("");
  };

  return (
    <div className="flex flex-col gap-3 border rounded-lg p-4">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold">Coach</p>
        {!hasConversation && <span className="text-xs text-gray-400">Tell me what's going on</span>}
      </div>

      {/* Conversation thread */}
      {hasConversation && (
        <div className="flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.role === "user" && (
                <div className="flex justify-end">
                  <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 max-w-[80%]">
                    {msg.content}
                  </div>
                </div>
              )}

              {msg.role === "coach" && (
                <div className="flex flex-col gap-2">
                  <div className="bg-gray-50 text-gray-700 text-sm rounded-lg px-3 py-2">
                    {msg.content}
                  </div>

                  {/* Show changes only for the latest coach message */}
                  {i === messages.length - 1 && msg.changes.length > 0 && (
                    <div className="flex flex-col gap-2 pl-1">
                      <p className="text-xs text-gray-400 uppercase tracking-wide">Proposed changes</p>

                      {relevantWeeks.map((week, weekIndex) => {
                        const weekChanges = msg.changes.filter(c => c.weekId === week.id);
                        if (weekChanges.length === 0) return null;
                        const globalIndex = weeks.findIndex(w => w.id === week.id);

                        return (
                          <div key={week.id} className="flex flex-col gap-1">
                            <p className="text-xs font-semibold text-gray-500">
                              Week {globalIndex + 1}
                              <span className="font-normal text-gray-400"> · {week.startDate} → {week.endDate}</span>
                            </p>

                            {weekChanges.map((change, j) => {
                              const original = weeks
                                .find(w => w.id === change.weekId)
                                ?.sessions.find(s => s.id === change.sessionId);

                              const fromLabel = original ? prescriptionLabel(original.category, original.prescription) : "—";
                              const toLabel = prescriptionLabel(change.category, change.prescription);

                              return (
                                <div key={j} className="py-1.5 border-b border-gray-100 last:border-0 flex flex-col gap-0.5">
                                  <span className="text-sm font-medium">{change.day}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-300 w-6 shrink-0">was</span>
                                    <span className="text-xs text-gray-400">{fromLabel}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-gray-300 w-6 shrink-0">now</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${categoryBadge(change.category)}`}>
                                      {toLabel}
                                    </span>
                                  </div>
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
            <p className="text-sm text-gray-400">Thinking...</p>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={hasConversation ? "Reply to refine..." : "e.g. I'm ill this week, I tweaked my ankle..."}
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>

      {/* Apply / Cancel */}
      {currentChanges.length > 0 && !loading && (
        <div className="flex gap-2">
          <button
            onClick={handleApply}
            disabled={applying}
            className="text-sm px-4 py-2 bg-gray-900 text-white rounded-lg disabled:opacity-50"
          >
            {applying ? "Applying..." : "Apply changes"}
          </button>
          <button
            onClick={handleCancel}
            className="text-sm px-4 py-2 border rounded-lg text-gray-500"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
