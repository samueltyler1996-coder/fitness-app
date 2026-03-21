"use client";

import { useState } from "react";
import { TrainingBlock, TrainingWeek, Session, Category, Day, Actual, Prescription, SessionChange } from "../lib/types";
import { computeInsights } from "../lib/analytics";
import SessionRow from "./SessionRow";
import SessionDetail from "./SessionDetail";
import RegenerateWeekModal from "./RegenerateWeekModal";
import InsightCard from "./InsightCard";

type WeekView =
  | { type: "day"; weekId: string; sessionId: string }
  | { type: "week"; weekId: string }
  | null;

const DAY_ABBR = ["M", "T", "W", "T", "F", "S", "S"];
const ORDERED_DAYS: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function sessionDotColor(session: Session | undefined): string {
  if (!session?.category || session.category === "Rest") {
    return session?.completed ? "bg-stone-300" : "bg-stone-100";
  }
  const pending: Record<string, string> = { Run: "bg-blue-200", Strength: "bg-amber-200", WOD: "bg-violet-200" };
  const done: Record<string, string> = { Run: "bg-blue-600", Strength: "bg-amber-500", WOD: "bg-violet-600" };
  return session.completed
    ? (done[session.category] ?? "bg-stone-400")
    : (pending[session.category] ?? "bg-stone-100");
}

interface Props {
  activeBlock: TrainingBlock | null;
  weeks: TrainingWeek[];
  currentWeek: TrainingWeek | null;
  todayDay: Day;
  goal: string;
  eventDate: string;
  creating: boolean;
  onGoalChange: (v: string) => void;
  onEventDateChange: (v: string) => void;
  onSave: () => Promise<void>;
  onCreateBlock: () => Promise<void>;
  onToggleSession: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onLogActual: (blockId: string, weekId: string, sessionId: string, actual: Actual) => void;
  onCategoryChange: (blockId: string, weekId: string, sessionId: string, newCategory: Category) => void;
  onEditPrescription: (blockId: string, weekId: string, sessionId: string, newCategory: Category, newPrescription: Prescription) => Promise<void>;
  onApplyChanges: (changes: SessionChange[], meta: { firstMessage: string; summary: string }) => Promise<void>;
}

export default function PlanView({
  activeBlock, weeks, currentWeek, todayDay, goal, eventDate, creating,
  onGoalChange, onEventDateChange, onSave, onCreateBlock,
  onToggleSession, onLogActual, onCategoryChange, onEditPrescription, onApplyChanges,
}: Props) {
  const [weekView, setWeekView] = useState<WeekView>(null);
  const [regenerateWeekId, setRegenerateWeekId] = useState<string | null>(null);

  const trainingSessions = weeks.flatMap(w => w.sessions).filter(s => s.category && s.category !== "Rest");
  const done = trainingSessions.filter(s => s.completed).length;
  const total = trainingSessions.length;
  const daysToRace = daysUntil(eventDate);
  const currentWeekIndex = weeks.findIndex(w => w.id === currentWeek?.id);
  const insights = computeInsights(weeks, 4);

  if (!activeBlock) {
    return (
      <div className="flex flex-col gap-5 pt-4">
        <p className="text-sm text-stone-500">No active training block. Create one to get started.</p>
        <div className="flex flex-col gap-5">
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-stone-400 block mb-2">Goal</label>
            <input
              type="text"
              placeholder="e.g. Marathon, Hyrox, General Fitness"
              value={goal}
              onChange={e => onGoalChange(e.target.value)}
              className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors placeholder:text-stone-300"
            />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-stone-400 block mb-2">Race Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={e => onEventDateChange(e.target.value)}
              className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors text-stone-700"
            />
          </div>
        </div>
        <button
          onClick={onCreateBlock}
          disabled={creating}
          className="w-full bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold py-4 rounded-xl disabled:opacity-40 transition-colors tracking-wide"
        >
          {creating ? "Generating plan…" : "Generate Training Block"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Block header */}
      <div className="py-4 border-t border-stone-100">
        <div className="flex items-start justify-between mb-3">
          <div>
            {goal && <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-1">{goal}</p>}
            <h1 className="text-xl font-black tracking-tight">{activeBlock.name}</h1>
          </div>
          {daysToRace !== null && daysToRace > 0 && (
            <div className="text-right">
              <p className="text-3xl font-black tabular-nums leading-none">{daysToRace}</p>
              <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400 mt-0.5">days</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-[11px] text-stone-400 mb-2">
          {currentWeekIndex >= 0
            ? <span>Week <span className="font-bold text-stone-900">{currentWeekIndex + 1}</span> of {weeks.length}</span>
            : <span>—</span>
          }
          <span>{done} of {total} sessions done</span>
        </div>
        {total > 0 && (
          <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-stone-700 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Insight signals — planning context */}
      {insights.length > 0 && (
        <div className="flex flex-col gap-2 -mt-2">
          <p className="text-[9px] tracking-[0.15em] uppercase text-stone-400">Based on recent weeks</p>
          {insights.map((signal, i) => (
            <InsightCard key={i} signal={signal} />
          ))}
        </div>
      )}

      {/* Week overview grid */}
      <div className="flex flex-col gap-1">
        {/* Legend */}
        <div className="flex items-center gap-4 mb-3">
          {[["Run", "bg-blue-200"], ["Strength", "bg-amber-200"], ["WOD", "bg-violet-200"], ["Rest", "bg-stone-100 border border-stone-200"]].map(([label, color]) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
              <span className="text-[9px] uppercase tracking-wide text-stone-400">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-auto">
            <div className="w-2.5 h-2.5 rounded-sm bg-blue-600 flex items-center justify-center">
              <span className="text-[6px] text-white font-bold">✓</span>
            </div>
            <span className="text-[9px] uppercase tracking-wide text-stone-400">Done</span>
          </div>
        </div>

        {/* Day header */}
        <div className="flex items-center gap-2 mb-1 pl-10">
          {DAY_ABBR.map((d, i) => (
            <div key={i} className="flex-1 text-center text-[9px] uppercase tracking-wide text-stone-300">{d}</div>
          ))}
        </div>

        {weeks.map((week, wi) => {
          const isCurrentWeek = week.id === currentWeek?.id;
          const isDayView = weekView?.type === "day" && weekView.weekId === week.id;
          const isWeekView = weekView?.type === "week" && weekView.weekId === week.id;
          const selectedSession = weekView?.type === "day" && weekView.weekId === week.id
            ? week.sessions.find(s => s.id === weekView.sessionId)
            : null;
          const regenerateOpen = regenerateWeekId === week.id;

          return (
            <div key={week.id}>
              <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${isCurrentWeek ? "bg-stone-50" : "hover:bg-stone-50 transition-colors"}`}>

                <button
                  onClick={() => setWeekView(prev =>
                    prev?.type === "week" && prev.weekId === week.id ? null : { type: "week", weekId: week.id }
                  )}
                  className={`text-[10px] w-8 shrink-0 text-left transition-colors hover:text-stone-700 ${isCurrentWeek ? "font-bold text-stone-900" : "text-stone-400"}`}
                >
                  W{wi + 1}
                </button>

                {ORDERED_DAYS.map(day => {
                  const session = week.sessions.find(s => s.day === day);
                  const isToday = isCurrentWeek && day === todayDay;
                  const isSelected = isDayView && session?.id === weekView?.sessionId;
                  return (
                    <div
                      key={day}
                      onClick={() => {
                        if (!session?.id) return;
                        setWeekView(prev =>
                          prev?.type === "day" && prev.sessionId === session.id
                            ? null
                            : { type: "day", weekId: week.id, sessionId: session.id }
                        );
                      }}
                      className={`relative flex-1 h-7 rounded-sm cursor-pointer transition-all ${sessionDotColor(session)} ${isToday ? "ring-2 ring-stone-800 ring-offset-1" : ""} ${isSelected ? "ring-2 ring-stone-500 ring-offset-1" : ""}`}
                    >
                      {session?.completed && (
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white/70 font-bold leading-none">✓</span>
                      )}
                    </div>
                  );
                })}

                <div className="flex items-center gap-1.5 ml-1 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); setRegenerateWeekId(week.id); }}
                    className="text-stone-300 hover:text-stone-600 text-[12px] leading-none transition-colors"
                    title="Regenerate week"
                  >↺</button>
                  <button
                    onClick={() => setWeekView(prev =>
                      prev?.type === "week" && prev.weekId === week.id ? null : { type: "week", weekId: week.id }
                    )}
                    className="text-stone-200 hover:text-stone-500 text-[10px] transition-colors"
                  >{isWeekView ? "▲" : "▼"}</button>
                </div>
              </div>

              {isDayView && selectedSession && (
                <div className="mt-1 mb-2 ml-10">
                  <SessionDetail
                    session={selectedSession}
                    blockId={activeBlock.id}
                    weekId={week.id}
                    isToday={isCurrentWeek && selectedSession.day === todayDay}
                    onToggle={onToggleSession}
                    onLogActual={onLogActual}
                    onEditPrescription={onEditPrescription}
                  />
                </div>
              )}

              {isWeekView && (
                <div className="mt-1 mb-2 pl-2 border-l-2 border-stone-100 ml-10">
                  {week.sessions.map(session => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      blockId={activeBlock.id}
                      weekId={week.id}
                      isToday={isCurrentWeek && session.day === todayDay}
                      onToggle={onToggleSession}
                      onCategoryChange={onCategoryChange}
                      onLogActual={onLogActual}
                      onEditPrescription={onEditPrescription}
                    />
                  ))}
                </div>
              )}

              {regenerateOpen && (
                <RegenerateWeekModal
                  week={week}
                  weekIndex={wi}
                  totalWeeks={weeks.length}
                  previousWeek={wi > 0 ? weeks[wi - 1] : null}
                  blockGoal={goal || activeBlock.primaryGoal}
                  onApply={onApplyChanges}
                  onClose={() => setRegenerateWeekId(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Block settings */}
      <div className="pt-6 border-t border-stone-100 flex flex-col gap-5">
        <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">Block settings</p>

        <div className="flex flex-col gap-5">
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-stone-400 block mb-2">Goal</label>
            <input
              type="text"
              placeholder="e.g. Marathon, Hyrox, General Fitness"
              value={goal}
              onChange={e => onGoalChange(e.target.value)}
              className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors placeholder:text-stone-300"
            />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-stone-400 block mb-2">Race Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={e => onEventDateChange(e.target.value)}
              className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors text-stone-700"
            />
          </div>
        </div>

        <button
          onClick={onSave}
          className="self-start text-[11px] tracking-[0.1em] uppercase text-stone-600 hover:text-stone-900 border border-stone-200 hover:border-stone-400 rounded-lg px-4 py-2 transition-colors"
        >
          Save
        </button>

        <div className="pt-4 border-t border-stone-100 flex flex-col gap-3">
          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Generating a new block will replace your current active block and all its sessions.
          </p>
          <button
            onClick={onCreateBlock}
            disabled={creating}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold py-4 rounded-xl disabled:opacity-40 transition-colors tracking-wide"
          >
            {creating ? "Generating plan…" : "Generate New Training Block"}
          </button>
        </div>
      </div>

    </div>
  );
}
