"use client";

import { useEffect, useState, useCallback } from "react";
import {
  doc, setDoc, getDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs, updateDoc, orderBy
} from "firebase/firestore";
import { signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { TrainingBlock, TrainingWeek, Session, Category, Day, Actual } from "../lib/types";
import TodayWorkout from "../components/TodayWorkout";
import ActiveBlock from "../components/ActiveBlock";
import TrainingWeeks from "../components/TrainingWeeks";

const DAY_ORDER: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [activeBlock, setActiveBlock] = useState<TrainingBlock | null>(null);
  const [weeks, setWeeks] = useState<TrainingWeek[]>([]);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
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

      const sessions: Session[] = sessionsSnapshot.docs
        .map(s => ({ id: s.id, ...s.data() } as Session))
        .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

      const week: TrainingWeek = { id: weekDoc.id, ...weekDoc.data(), sessions } as TrainingWeek;
      weeksData.push(week);

      const start = new Date(week.startDate);
      const end = new Date(week.endDate);
      if (today >= start && today <= end) currentWeekId = week.id;
    }

    setWeeks(weeksData);
    if (currentWeekId) setExpandedWeek(currentWeekId);
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

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 42);
    const primaryGoal = goal || "Maintenance";
    const name = primaryGoal === "Maintenance" ? "Maintenance Block" : `${primaryGoal} Block`;

    const blockDocRef = await addDoc(blocksRef, {
      name,
      primaryGoal,
      secondaryGoal: null,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      status: "active",
      createdAt: serverTimestamp(),
    });

    const blockId = blockDocRef.id;
    let currentStart = new Date(startDate);

    for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentStart.getDate() + 6);
      if (currentEnd > endDate) currentEnd.setTime(endDate.getTime());

      const weekRef = await addDoc(
        collection(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks"),
        {
          startDate: currentStart.toISOString().split("T")[0],
          endDate: currentEnd.toISOString().split("T")[0],
          createdAt: serverTimestamp(),
        }
      );

      const weekId = weekRef.id;
      const weekPlan = generatedPlan.weeks?.[weekIndex];

      for (const day of DAY_ORDER) {
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
      }

      currentStart.setDate(currentStart.getDate() + 7);
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
    <main className="max-w-md mx-auto px-4 py-8 flex flex-col gap-6">

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{user.displayName}</h1>
        <button onClick={() => signOut(auth)} className="text-sm text-gray-400 hover:text-gray-700">
          Sign out
        </button>
      </div>

      {(goal || eventDate) && (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          {goal && <span className="font-medium">{goal}</span>}
          {goal && eventDate && <span className="text-gray-300">·</span>}
          {eventDate && <span>Race day: {eventDate}</span>}
        </div>
      )}

      <TodayWorkout session={todaySession} />

      {activeBlock && <ActiveBlock block={activeBlock} weeks={weeks} />}

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

      <div className="flex flex-col gap-3 border-t pt-6 mt-2">
        <h2 className="font-semibold text-gray-600">Profile</h2>
        <input
          type="text"
          placeholder="Current Goal (e.g. Marathon)"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          className="border p-2 rounded"
        />
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          className="border p-2 rounded"
        />
        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded">
          Save Profile
        </button>
        <button
          onClick={handleCreateBlock}
          disabled={creating}
          className="bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {creating ? "Generating plan..." : "Create Training Block"}
        </button>
      </div>

    </main>
  );
}
