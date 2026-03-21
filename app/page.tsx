"use client";

import { useEffect, useState, useCallback } from "react";
import {
  doc, setDoc, getDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs, updateDoc, orderBy, writeBatch, limit
} from "firebase/firestore";
import { signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { TrainingBlock, TrainingWeek, Session, Category, Day, Actual, SessionChange, CoachSessionChange, CoachSessionLog } from "../lib/types";
import TodayWorkout from "../components/TodayWorkout";
import ActiveBlock from "../components/ActiveBlock";
import TrainingWeeks from "../components/TrainingWeeks";
import CoachChat from "../components/CoachChat";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [activeBlock, setActiveBlock] = useState<TrainingBlock | null>(null);
  const [weeks, setWeeks] = useState<TrainingWeek[]>([]);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [coachHistory, setCoachHistory] = useState<CoachSessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const todayISO = new Date().toISOString().split("T")[0];
  const todayDate = new Date(todayISO);
  const todayDay = todayDate.toLocaleDateString("en-US", { weekday: "long" }) as Day;

  const currentWeek = weeks.find(week => {
    const start = new Date(week.startDate);
    const end = new Date(week.endDate);
    return todayDate >= start && todayDate <= end;
  }) ?? null;

  const todaySession = currentWeek?.sessions.find(s => s.day === todayDay) ?? null;

  const fetchBlockData = useCallback(async (uid: string) => {
    const blocksRef = collection(db, "users", uid, "trainingBlocks");
    const activeQuery = query(blocksRef, where("status", "==", "active"));
    const activeSnapshot = await getDocs(activeQuery);

    if (activeSnapshot.empty) {
      setActiveBlock(null);
      setWeeks([]);
      setExpandedWeek(null);
      return;
    }

    const blockDoc = activeSnapshot.docs[0];
    setActiveBlock({ id: blockDoc.id, ...blockDoc.data() } as TrainingBlock);

    const weeksRef = collection(db, "users", uid, "trainingBlocks", blockDoc.id, "trainingWeeks");
    const weeksQuery = query(weeksRef, orderBy("startDate", "asc"));
    const weeksSnapshot = await getDocs(weeksQuery);

    const weeksData: TrainingWeek[] = [];
    let currentWeekId: string | null = null;
    const today = new Date(new Date().toISOString().split("T")[0]);

    for (const weekDoc of weeksSnapshot.docs) {
      const sessionsRef = collection(db, "users", uid, "trainingBlocks", blockDoc.id, "trainingWeeks", weekDoc.id, "sessions");
      const sessionsSnapshot = await getDocs(sessionsRef);

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

      const week: TrainingWeek = { id: weekDoc.id, ...weekDoc.data(), sessions } as TrainingWeek;
      weeksData.push(week);

      const start = new Date(week.startDate);
      const end = new Date(week.endDate);
      if (today >= start && today <= end) currentWeekId = week.id;
    }

    setWeeks(weeksData);
    if (currentWeekId) setExpandedWeek(currentWeekId);

    const historyQuery = query(
      collection(db, "users", uid, "coachSessions"),
      orderBy("appliedAt", "desc"),
      limit(10)
    );
    const historySnap = await getDocs(historyQuery);
    setCoachHistory(historySnap.docs.map(d => ({ id: d.id, ...d.data() } as CoachSessionLog)));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            createdAt: serverTimestamp(),
            currentGoal: null,
            eventDate: null,
          });
        } else {
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

    return () => unsubscribe();
  }, [fetchBlockData]);

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
      if (!res.ok) throw new Error("API error");
      generatedPlan = await res.json();
    } catch {
      setCreating(false);
      return;
    }

    const blocksRef = collection(db, "users", user.uid, "trainingBlocks");
    const activeQuery = query(blocksRef, where("status", "==", "active"));
    const activeSnapshot = await getDocs(activeQuery);
    for (const docSnap of activeSnapshot.docs) {
      await updateDoc(docSnap.ref, { status: "completed", endedAt: serverTimestamp() });
    }

    // Week 1: today → coming Sunday. Week 2+: Monday → Sunday.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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
    const name = primaryGoal === "Maintenance" ? "Maintenance Block" : `${primaryGoal} Block`;

    const blockDocRef = await addDoc(blocksRef, {
      name,
      primaryGoal,
      secondaryGoal: null,
      startDate: today.toISOString().split("T")[0],
      endDate: blockEndDate.toISOString().split("T")[0],
      status: "active",
      createdAt: serverTimestamp(),
    });

    const blockId = blockDocRef.id;

    for (let weekIndex = 0; weekIndex < weekRanges.length; weekIndex++) {
      const { start, end } = weekRanges[weekIndex];

      const weekRef = await addDoc(
        collection(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks"),
        {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
          createdAt: serverTimestamp(),
        }
      );

      const weekId = weekRef.id;
      const weekPlan = generatedPlan.weeks?.[weekIndex];
      const current = new Date(start);

      while (current <= end) {
        const day = DAY_NAMES[current.getDay()] as Day;
        const sessionPlan = weekPlan?.sessions?.find((s: any) => s.day === day);
        await addDoc(
          collection(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions"),
          {
            day,
            category: sessionPlan?.category ?? null,
            completed: false,
            prescription: sessionPlan?.prescription ?? {},
            actual: {},
            aiGenerated: true,
            manuallyModified: false,
            createdAt: serverTimestamp(),
          }
        );
        current.setDate(current.getDate() + 1);
      }
    }

    await fetchBlockData(user.uid);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, { currentGoal: goal, eventDate }, { merge: true });
  };

  const toggleSession = async (blockId: string, weekId: string, sessionId: string, currentValue: boolean) => {
    if (!user) return;
    const sessionRef = doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId);
    await updateDoc(sessionRef, { completed: !currentValue });
    setWeeks(prev => prev.map(week =>
      week.id === weekId
        ? { ...week, sessions: week.sessions.map(s => s.id === sessionId ? { ...s, completed: !currentValue } : s) }
        : week
    ));
  };

  const applyChanges = async (changes: SessionChange[], meta: { firstMessage: string; summary: string }) => {
    if (!user || !activeBlock) return;

    const batch = writeBatch(db);

    const logChanges: CoachSessionChange[] = changes.map(change => {
      const original = weeks.flatMap(w => w.sessions).find(s => s.id === change.sessionId);
      return {
        weekId: change.weekId,
        sessionId: change.sessionId,
        day: change.day,
        fromCategory: original?.category ?? null,
        fromPrescription: original?.prescription ?? {},
        toCategory: change.category,
        toPrescription: change.prescription,
      };
    });

    for (const change of changes) {
      const sessionRef = doc(db, "users", user.uid, "trainingBlocks", activeBlock.id, "trainingWeeks", change.weekId, "sessions", change.sessionId);
      batch.update(sessionRef, { category: change.category, prescription: change.prescription, manuallyModified: true });
    }

    const coachSessionRef = doc(collection(db, "users", user.uid, "coachSessions"));
    batch.set(coachSessionRef, {
      appliedAt: serverTimestamp(),
      firstMessage: meta.firstMessage,
      summary: meta.summary,
      changesCount: changes.length,
      changes: logChanges,
    });

    await batch.commit();

    setCoachHistory(prev => [{
      id: coachSessionRef.id,
      appliedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      firstMessage: meta.firstMessage,
      summary: meta.summary,
      changesCount: changes.length,
      changes: logChanges,
    }, ...prev].slice(0, 10));

    setWeeks(prev => prev.map(week => {
      const weekChanges = changes.filter(c => c.weekId === week.id);
      if (weekChanges.length === 0) return week;
      return {
        ...week,
        sessions: week.sessions.map(s => {
          const change = weekChanges.find(c => c.sessionId === s.id);
          return change ? { ...s, category: change.category, prescription: change.prescription, manuallyModified: true } : s;
        }),
      };
    }));
  };

  const logActual = async (blockId: string, weekId: string, sessionId: string, actual: Actual) => {
    if (!user) return;
    const sessionRef = doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId);
    await updateDoc(sessionRef, { actual });
    setWeeks(prev => prev.map(week =>
      week.id === weekId
        ? { ...week, sessions: week.sessions.map(s => s.id === sessionId ? { ...s, actual } : s) }
        : week
    ));
  };

  const updateSessionCategory = async (blockId: string, weekId: string, sessionId: string, newCategory: Category) => {
    if (!user) return;
    const sessionRef = doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId);
    await updateDoc(sessionRef, { category: newCategory });
    setWeeks(prev => prev.map(week =>
      week.id === weekId
        ? { ...week, sessions: week.sessions.map(s => s.id === sessionId ? { ...s, category: newCategory } : s) }
        : week
    ));
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400 text-sm">Loading...</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <button
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
          className="bg-black text-white px-6 py-3 rounded-lg"
        >
          Sign in with Google
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-5 py-8 flex flex-col gap-5">

      <div className="flex justify-between items-center">
        <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">{user.displayName}</p>
        <button onClick={() => signOut(auth)} className="text-[10px] tracking-[0.15em] uppercase text-stone-400 hover:text-stone-700 transition-colors">
          Sign out
        </button>
      </div>

      <TodayWorkout session={todaySession} />

      {activeBlock && <ActiveBlock block={activeBlock} weeks={weeks} goal={goal} eventDate={eventDate} />}

      {weeks.length > 0 && (
        <CoachChat weeks={weeks} coachHistory={coachHistory} onApplyChanges={applyChanges} />
      )}

      {weeks.length > 0 && activeBlock && (
        <TrainingWeeks
          weeks={weeks}
          blockId={activeBlock.id}
          expandedWeek={expandedWeek}
          currentWeekId={currentWeek?.id ?? null}
          todayDay={todayDay}
          onToggleExpand={(id) => setExpandedWeek(expandedWeek === id ? null : id)}
          onToggleSession={toggleSession}
          onCategoryChange={updateSessionCategory}
          onLogActual={logActual}
        />
      )}

      <div className="pt-8 pb-4">
        <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-5">Training Setup</p>

        <div className="flex flex-col gap-5 mb-6">
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-stone-400 block mb-2">Goal</label>
            <input
              type="text"
              placeholder="e.g. Marathon, 10K, General Fitness"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors placeholder:text-stone-300"
            />
          </div>
          <div>
            <label className="text-[10px] tracking-[0.15em] uppercase text-stone-400 block mb-2">Race Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full border-0 border-b border-stone-200 pb-2 text-sm bg-transparent focus:outline-none focus:border-stone-800 transition-colors text-stone-700"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleSave}
            className="self-start text-[11px] tracking-[0.1em] uppercase text-stone-400 hover:text-stone-700 transition-colors"
          >
            Save profile
          </button>
          <button
            onClick={handleCreateBlock}
            disabled={creating}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold py-4 rounded-xl disabled:opacity-40 transition-colors tracking-wide"
          >
            {creating ? "Generating plan…" : "Generate New Training Block"}
          </button>
          <p className="text-[10px] text-stone-300 text-center">Replaces your current active block</p>
        </div>
      </div>

    </main>
  );
}
