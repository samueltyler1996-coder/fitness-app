"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  doc, setDoc, getDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs, updateDoc, orderBy, writeBatch, limit
} from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import {
  TrainingBlock, TrainingWeek, Session, Category, Day, Actual,
  Prescription, SessionChange, CoachSessionChange, CoachSessionLog
} from "../../lib/types";
import SessionRow from "../../components/SessionRow";
import SessionDetail from "../../components/SessionDetail";
import RegenerateWeekModal from "../../components/RegenerateWeekModal";

type WeekView =
  | { type: "day"; weekId: string; sessionId: string }
  | { type: "week"; weekId: string }
  | null;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ABBR = ["M", "T", "W", "T", "F", "S", "S"];
const ORDERED_DAYS: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

// Uncompleted = light pastel. Completed = solid dark. Rest = stone.
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

export default function Plan() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [activeBlock, setActiveBlock] = useState<TrainingBlock | null>(null);
  const [weeks, setWeeks] = useState<TrainingWeek[]>([]);
  const [coachHistory, setCoachHistory] = useState<CoachSessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [weekView, setWeekView] = useState<WeekView>(null);
  const [regenerateWeekId, setRegenerateWeekId] = useState<string | null>(null);

  const todayISO = new Date().toISOString().split("T")[0];
  const todayDate = new Date(todayISO);
  const todayDay = todayDate.toLocaleDateString("en-US", { weekday: "long" }) as Day;

  const currentWeek = weeks.find(w => {
    const s = new Date(w.startDate + "T00:00:00");
    const e = new Date(w.endDate + "T00:00:00");
    return todayDate >= s && todayDate <= e;
  }) ?? null;

  const fetchBlockData = useCallback(async (uid: string) => {
    const blocksRef = collection(db, "users", uid, "trainingBlocks");
    const activeQuery = query(blocksRef, where("status", "==", "active"));
    const activeSnapshot = await getDocs(activeQuery);

    if (activeSnapshot.empty) {
      setActiveBlock(null);
      setWeeks([]);
      return;
    }

    const blockDoc = activeSnapshot.docs[0];
    setActiveBlock({ id: blockDoc.id, ...blockDoc.data() } as TrainingBlock);

    const weeksRef = collection(db, "users", uid, "trainingBlocks", blockDoc.id, "trainingWeeks");
    const weeksSnapshot = await getDocs(query(weeksRef, orderBy("startDate", "asc")));

    const weeksData: TrainingWeek[] = [];
    for (const weekDoc of weeksSnapshot.docs) {
      const sessionsSnapshot = await getDocs(
        collection(db, "users", uid, "trainingBlocks", blockDoc.id, "trainingWeeks", weekDoc.id, "sessions")
      );
      const weekStartDate = (weekDoc.data() as TrainingWeek).startDate;
      const getOffset = (day: string) => {
        const start = new Date(weekStartDate + "T12:00:00");
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          if (DAY_NAMES[d.getDay()] === day) return i;
        }
        return 0;
      };
      const sessions: Session[] = sessionsSnapshot.docs
        .map(s => ({ id: s.id, ...s.data() } as Session))
        .sort((a, b) => getOffset(a.day) - getOffset(b.day));
      weeksData.push({ id: weekDoc.id, ...weekDoc.data(), sessions } as TrainingWeek);
    }
    setWeeks(weeksData);

    const historySnap = await getDocs(query(
      collection(db, "users", uid, "coachSessions"),
      orderBy("appliedAt", "desc"),
      limit(10)
    ));
    setCoachHistory(historySnap.docs.map(d => ({ id: d.id, ...d.data() } as CoachSessionLog)));
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userSnap = await getDoc(doc(db, "users", currentUser.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          setGoal(data.currentGoal || "");
          setEventDate(data.eventDate || "");
        }
        setUser(currentUser);
        await fetchBlockData(currentUser.uid);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
  }, [fetchBlockData]);

  const handleSave = async () => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { currentGoal: goal, eventDate }, { merge: true });
  };

  const handleCreateBlock = async () => {
    if (!user) return;
    setCreating(true);
    let generatedPlan: any = null;
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal || "Maintenance", eventDate, weeks: 6 }),
      });
      if (!res.ok) throw new Error();
      generatedPlan = await res.json();
    } catch {
      setCreating(false);
      return;
    }

    const blocksRef = collection(db, "users", user.uid, "trainingBlocks");
    for (const d of (await getDocs(query(blocksRef, where("status", "==", "active")))).docs) {
      await updateDoc(d.ref, { status: "completed", endedAt: serverTimestamp() });
    }

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const daysUntilSunday = today.getDay() === 0 ? 0 : 7 - today.getDay();
    const week1End = new Date(today);
    week1End.setDate(today.getDate() + daysUntilSunday);

    const weekRanges: { start: Date; end: Date }[] = [{ start: new Date(today), end: new Date(week1End) }];
    let nextMonday = new Date(week1End);
    nextMonday.setDate(week1End.getDate() + 1);
    for (let i = 1; i < 6; i++) {
      const weekStart = new Date(nextMonday);
      const weekEnd = new Date(nextMonday);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekRanges.push({ start: weekStart, end: weekEnd });
      nextMonday.setDate(nextMonday.getDate() + 7);
    }

    const blockEndDate = weekRanges[weekRanges.length - 1].end;
    const primaryGoal = goal || "Maintenance";
    const blockDocRef = await addDoc(blocksRef, {
      name: primaryGoal === "Maintenance" ? "Maintenance Block" : `${primaryGoal} Block`,
      primaryGoal,
      secondaryGoal: null,
      startDate: today.toISOString().split("T")[0],
      endDate: blockEndDate.toISOString().split("T")[0],
      status: "active",
      createdAt: serverTimestamp(),
    });

    for (let wi = 0; wi < weekRanges.length; wi++) {
      const { start, end } = weekRanges[wi];
      const weekRef = await addDoc(
        collection(db, "users", user.uid, "trainingBlocks", blockDocRef.id, "trainingWeeks"),
        { startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0], createdAt: serverTimestamp() }
      );
      const weekPlan = generatedPlan.weeks?.[wi];
      const current = new Date(start);
      while (current <= end) {
        const day = DAY_NAMES[current.getDay()] as Day;
        const sessionPlan = weekPlan?.sessions?.find((s: any) => s.day === day);
        await addDoc(
          collection(db, "users", user.uid, "trainingBlocks", blockDocRef.id, "trainingWeeks", weekRef.id, "sessions"),
          { day, category: sessionPlan?.category ?? null, completed: false, prescription: sessionPlan?.prescription ?? {}, actual: {}, aiGenerated: true, manuallyModified: false, createdAt: serverTimestamp() }
        );
        current.setDate(current.getDate() + 1);
      }
    }

    await fetchBlockData(user.uid);
    setCreating(false);
  };

  const toggleSession = async (blockId: string, weekId: string, sessionId: string, current: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId), { completed: !current });
    setWeeks(prev => prev.map(w => w.id === weekId
      ? { ...w, sessions: w.sessions.map(s => s.id === sessionId ? { ...s, completed: !current } : s) }
      : w
    ));
  };

  const updateSessionCategory = async (blockId: string, weekId: string, sessionId: string, newCategory: Category) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId), { category: newCategory });
    setWeeks(prev => prev.map(w => w.id === weekId
      ? { ...w, sessions: w.sessions.map(s => s.id === sessionId ? { ...s, category: newCategory } : s) }
      : w
    ));
  };

  const updateSessionPrescription = async (blockId: string, weekId: string, sessionId: string, newCategory: Category, newPrescription: Prescription) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId), { category: newCategory, prescription: newPrescription, manuallyModified: true });
    setWeeks(prev => prev.map(w => w.id === weekId
      ? { ...w, sessions: w.sessions.map(s => s.id === sessionId ? { ...s, category: newCategory, prescription: newPrescription, manuallyModified: true } : s) }
      : w
    ));
  };

  const logActual = async (blockId: string, weekId: string, sessionId: string, actual: Actual) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId), { actual });
    setWeeks(prev => prev.map(w => w.id === weekId
      ? { ...w, sessions: w.sessions.map(s => s.id === sessionId ? { ...s, actual } : s) }
      : w
    ));
  };

  const applyChanges = async (changes: SessionChange[], meta: { firstMessage: string; summary: string }) => {
    if (!user || !activeBlock) return;
    const batch = writeBatch(db);
    const logChanges: CoachSessionChange[] = changes.map(change => {
      const original = weeks.flatMap(w => w.sessions).find(s => s.id === change.sessionId);
      return { weekId: change.weekId, sessionId: change.sessionId, day: change.day, fromCategory: original?.category ?? null, fromPrescription: original?.prescription ?? {}, toCategory: change.category, toPrescription: change.prescription };
    });
    for (const change of changes) {
      batch.update(doc(db, "users", user.uid, "trainingBlocks", activeBlock.id, "trainingWeeks", change.weekId, "sessions", change.sessionId), { category: change.category, prescription: change.prescription, manuallyModified: true });
    }
    const coachRef = doc(collection(db, "users", user.uid, "coachSessions"));
    batch.set(coachRef, { appliedAt: serverTimestamp(), firstMessage: meta.firstMessage, summary: meta.summary, changesCount: changes.length, changes: logChanges });
    await batch.commit();
    setCoachHistory(prev => [{ id: coachRef.id, appliedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }, firstMessage: meta.firstMessage, summary: meta.summary, changesCount: changes.length, changes: logChanges }, ...prev].slice(0, 10));
    setWeeks(prev => prev.map(week => {
      const weekChanges = changes.filter(c => c.weekId === week.id);
      if (!weekChanges.length) return week;
      return { ...week, sessions: week.sessions.map(s => { const c = weekChanges.find(x => x.sessionId === s.id); return c ? { ...s, category: c.category, prescription: c.prescription, manuallyModified: true } : s; }) };
    }));
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-stone-400 text-sm">Loading...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Link href="/" className="text-sm text-stone-500">← Sign in on home</Link>
      </main>
    );
  }

  const trainingSessions = weeks.flatMap(w => w.sessions).filter(s => s.category && s.category !== "Rest");
  const done = trainingSessions.filter(s => s.completed).length;
  const total = trainingSessions.length;
  const daysToRace = daysUntil(eventDate);
  const currentWeekIndex = weeks.findIndex(w => w.id === currentWeek?.id);

  return (
    <main className="max-w-md mx-auto px-5 py-8 flex flex-col gap-6">

      {/* Nav */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">{user.displayName}</p>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-[10px] tracking-[0.15em] uppercase text-stone-400 hover:text-stone-700 transition-colors">Today</Link>
          <span className="text-[10px] tracking-[0.15em] uppercase text-stone-900 font-semibold">Plan</span>
        </div>
      </div>

      {activeBlock ? (
        <>
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

                    {/* W1 label — click to toggle full week management view */}
                    <button
                      onClick={() => setWeekView(prev =>
                        prev?.type === "week" && prev.weekId === week.id ? null : { type: "week", weekId: week.id }
                      )}
                      className={`text-[10px] w-8 shrink-0 text-left transition-colors hover:text-stone-700 ${isCurrentWeek ? "font-bold text-stone-900" : "text-stone-400"}`}
                    >
                      W{wi + 1}
                    </button>

                    {/* Day squares — click to inspect that session */}
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

                  {/* Session detail — single day inspect */}
                  {isDayView && selectedSession && activeBlock && (
                    <div className="mt-1 mb-2 ml-10">
                      <SessionDetail
                        session={selectedSession}
                        blockId={activeBlock.id}
                        weekId={week.id}
                        isToday={isCurrentWeek && selectedSession.day === todayDay}
                        onToggle={toggleSession}
                        onLogActual={logActual}
                        onEditPrescription={updateSessionPrescription}
                      />
                    </div>
                  )}

                  {/* Full week — management view */}
                  {isWeekView && activeBlock && (
                    <div className="mt-1 mb-2 pl-2 border-l-2 border-stone-100 ml-10">
                      {week.sessions.map(session => (
                        <SessionRow
                          key={session.id}
                          session={session}
                          blockId={activeBlock.id}
                          weekId={week.id}
                          isToday={isCurrentWeek && session.day === todayDay}
                          onToggle={toggleSession}
                          onCategoryChange={updateSessionCategory}
                          onLogActual={logActual}
                          onEditPrescription={updateSessionPrescription}
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
                      onApply={applyChanges}
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
                  onChange={e => setGoal(e.target.value)}
                  className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors placeholder:text-stone-300"
                />
              </div>
              <div>
                <label className="text-[10px] tracking-[0.15em] uppercase text-stone-400 block mb-2">Race Date</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors text-stone-700"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              className="self-start text-[11px] tracking-[0.1em] uppercase text-stone-600 hover:text-stone-900 border border-stone-200 hover:border-stone-400 rounded-lg px-4 py-2 transition-colors"
            >
              Save
            </button>

            <div className="pt-4 border-t border-stone-100 flex flex-col gap-3">
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Generating a new block will replace your current active block and all its sessions.
              </p>
              <button
                onClick={handleCreateBlock}
                disabled={creating}
                className="w-full bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold py-4 rounded-xl disabled:opacity-40 transition-colors tracking-wide"
              >
                {creating ? "Generating plan…" : "Generate New Training Block"}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* No active block */
        <div className="flex flex-col gap-5 pt-4">
          <p className="text-sm text-stone-500">No active training block. Create one to get started.</p>
          <div className="flex flex-col gap-5">
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase text-stone-400 block mb-2">Goal</label>
              <input
                type="text"
                placeholder="e.g. Marathon, Hyrox, General Fitness"
                value={goal}
                onChange={e => setGoal(e.target.value)}
                className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors placeholder:text-stone-300"
              />
            </div>
            <div>
              <label className="text-[10px] tracking-[0.15em] uppercase text-stone-400 block mb-2">Race Date</label>
              <input
                type="date"
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors text-stone-700"
              />
            </div>
          </div>
          <button
            onClick={handleCreateBlock}
            disabled={creating}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold py-4 rounded-xl disabled:opacity-40 transition-colors tracking-wide"
          >
            {creating ? "Generating plan…" : "Generate Training Block"}
          </button>
        </div>
      )}

    </main>
  );
}
