"use client";

import { useState } from "react";
import { TrainingBlock, TrainingWeek, Session, SessionChange, CoachSessionLog, IncidentType } from "../lib/types";
import CoachChat from "./CoachChat";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";

interface Props {
  activeBlock: TrainingBlock | null;
  weeks: TrainingWeek[];
  todaySession: Session | null;
  eventDate: string;
  coachHistory: CoachSessionLog[];
  progressContext: string;
  userName: string;
  telegramChatId: string;
  onApplyChanges: (changes: SessionChange[], meta: { firstMessage: string; summary: string; incidentType?: IncidentType }) => Promise<void>;
  onSaveTelegramChatId: (chatId: string) => Promise<void>;
}

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  return d > 0 ? d : null;
}

function sessionLabel(session: Session | null): string {
  if (!session || !session.category) return "Rest day";
  if (session.category === "Rest") return "Rest day";
  const p = session.prescription as Record<string, string | number | undefined>;
  if (session.category === "Run") {
    const runType: Record<string, string> = { easy: "Easy Run", tempo: "Tempo Run", long: "Long Run", intervals: "Intervals" };
    return [runType[String(p?.type ?? "")] ?? "Run", p?.distanceKm ? `${p.distanceKm} km` : null].filter(Boolean).join(" · ");
  }
  if (session.category === "Strength") {
    return p?.focus ? `${p.focus} strength` : "Strength";
  }
  return session.category;
}

export default function CoachZone({
  activeBlock, weeks, todaySession, eventDate, coachHistory, progressContext, userName,
  telegramChatId, onApplyChanges, onSaveTelegramChatId,
}: Props) {
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [showPhoneForm, setShowPhoneForm] = useState(false);
  const daysToRace = daysUntil(eventDate);
  const label = sessionLabel(todaySession);
  const isDone = todaySession?.completed ?? false;
  const currentWeekIndex = weeks.findIndex(w => {
    const today = new Date().toISOString().split("T")[0];
    return w.startDate <= today && w.endDate >= today;
  });

  return (
    <div className="min-h-screen bg-[#f8f6f3] flex flex-col pb-16">

      {/* Top context strip */}
      <div className="px-5 pt-10 pb-4 border-b border-stone-200/80">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-0.5">
              {activeBlock ? activeBlock.primaryGoal : "No block active"}
            </p>
            <p className="text-[15px] font-semibold text-stone-800 leading-snug truncate">
              {activeBlock ? activeBlock.name : "Set up a block to start training"}
            </p>
            {activeBlock && currentWeekIndex >= 0 && (
              <p className="text-[11px] text-stone-400 mt-0.5">
                Week {currentWeekIndex + 1} of {weeks.length}
              </p>
            )}
          </div>
          {daysToRace !== null && (
            <div className="text-right shrink-0">
              <p className="font-display font-black text-stone-900 leading-none" style={{ fontSize: "32px" }}>
                {daysToRace}
              </p>
              <p className="text-[9px] tracking-[0.2em] uppercase text-stone-400 mt-0.5">days</p>
            </div>
          )}
        </div>

        {/* Today status chip */}
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            !todaySession?.category || todaySession.category === "Rest"
              ? "bg-stone-300"
              : isDone
              ? "bg-emerald-500"
              : "bg-stone-400"
          }`} />
          <p className="text-[11px] text-stone-500">
            Today: {label}{isDone && todaySession?.category && todaySession.category !== "Rest" ? " · done ✓" : ""}
          </p>
        </div>
      </div>

      {/* Coach chat */}
      <div className="flex-1 px-5 pt-4">
        {weeks.length > 0 ? (
          <CoachChat
            weeks={weeks}
            coachHistory={coachHistory}
            progressContext={progressContext}
            onApplyChanges={onApplyChanges}
          />
        ) : (
          <div className="pt-8 flex flex-col gap-3">
            <p className="text-sm text-stone-500 leading-relaxed">
              Create a training block to unlock adaptive coaching. Once you have a plan, your coach can help you adjust sessions, handle setbacks, and keep you on track.
            </p>
          </div>
        )}
      </div>

      {/* Telegram connect */}
      <div className="px-5 pt-2 pb-1 border-t border-stone-200/60">
        {telegramChatId ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <p className="text-[10px] tracking-[0.12em] uppercase text-stone-400">
                Telegram connected
              </p>
            </div>
            <button
              onClick={async () => { await onSaveTelegramChatId(""); }}
              className="text-[10px] tracking-[0.12em] uppercase text-stone-300 hover:text-stone-500 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : showPhoneForm ? (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] text-stone-400 leading-relaxed">
              Message your bot on Telegram first — it will reply with your chat ID.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Chat ID (e.g. 123456789)"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value.replace(/[^0-9]/g, ""))}
                className="flex-1 text-[11px] bg-transparent border-b border-stone-300 pb-0.5 text-stone-700 placeholder:text-stone-300 outline-none"
              />
              <button
                onClick={async () => {
                  if (!phoneInput) return;
                  setSavingPhone(true);
                  await onSaveTelegramChatId(phoneInput);
                  setPhoneInput("");
                  setShowPhoneForm(false);
                  setSavingPhone(false);
                }}
                disabled={savingPhone || !phoneInput}
                className="text-[10px] tracking-[0.12em] uppercase text-stone-700 disabled:text-stone-300 transition-colors"
              >
                {savingPhone ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => { setShowPhoneForm(false); setPhoneInput(""); }}
                className="text-[10px] tracking-[0.12em] uppercase text-stone-300 hover:text-stone-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowPhoneForm(true)}
            className="text-[10px] tracking-[0.12em] uppercase text-stone-300 hover:text-stone-500 transition-colors"
          >
            + Connect Telegram
          </button>
        )}
      </div>

      {/* Sign out — tucked at bottom */}
      <div className="px-5 pt-1 pb-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[0.15em] uppercase text-stone-300">{userName}</p>
          <button
            onClick={() => signOut(auth)}
            className="text-[10px] tracking-[0.12em] uppercase text-stone-300 hover:text-stone-500 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
