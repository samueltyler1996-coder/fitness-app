"use client";

import { useEffect, useState } from "react";
import {
  doc, setDoc, getDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs, updateDoc, orderBy
} from "firebase/firestore";
import { signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { TrainingBlock, TrainingWeek, Session, Category, Day } from "../lib/types";
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

  // Derived: today's session comes from weeks state — never stored separately
  const todayISO = new Date().toISOString().split("T")[0];
  const todayDate = new Date(todayISO);
  const todayDay = todayDate.toLocaleDateString("en-US", { weekday: "long" }) as Day;

  const currentWeek = weeks.find(week => {
    const start = new Date(week.startDate);
    const end = new Date(week.endDate);
    return todayDate >= start && todayDate <= end;
  }) ?? null;

  const todaySession = currentWeek?.sessions.find(s => s.day === todayDay) ?? null;

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

        const blocksRef = collection(db, "users", currentUser.uid, "trainingBlocks");
        const activeQuery = query(blocksRef, where("status", "==", "active"));
        const activeSnapshot = await getDocs(activeQuery);

        if (!activeSnapshot.empty) {
          const blockDoc = activeSnapshot.docs[0];
          setActiveBlock({ id: blockDoc.id, ...blockDoc.data() } as TrainingBlock);

          const weeksRef = collection(db, "users", currentUser.uid, "trainingBlocks", blockDoc.id, "trainingWeeks");
          const weeksQuery = query(weeksRef, orderBy("startDate", "asc"));
          const weeksSnapshot = await getDocs(weeksQuery);

          const weeksData: TrainingWeek[] = [];
          let currentWeekId: string | null = null;
          const today = new Date(new Date().toISOString().split("T")[0]);

          for (const weekDoc of weeksSnapshot.docs) {
            const sessionsRef = collection(db, "users", currentUser.uid, "trainingBlocks", blockDoc.id, "trainingWeeks", weekDoc.id, "sessions");
            const sessionsSnapshot = await getDocs(sessionsRef);

            const sessions: Session[] = sessionsSnapshot.docs
              .map(s => ({ id: s.id, ...s.data() } as Session))
              .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

            const week: TrainingWeek = { id: weekDoc.id, ...weekDoc.data(), sessions } as TrainingWeek;
            weeksData.push(week);

            const start = new Date(week.startDate);
            const end = new Date(week.endDate);
            if (today >= start && today <= end) {
              currentWeekId = week.id;
            }
          }

          setWeeks(weeksData);
          if (currentWeekId) setExpandedWeek(currentWeekId);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateBlock = async () => {
    if (!user) return;

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
    let weekNumber = 1;

    while (currentStart <= endDate) {
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
      const days: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

      for (const day of days) {
        await addDoc(
          collection(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions"),
          {
            day,
            category: null,
            completed: false,
            prescription: {},
            actual: {},
            aiGenerated: true,
            manuallyModified: false,
            createdAt: serverTimestamp(),
          }
        );
      }

      if (weekNumber === 1) {
        const sessionsRef = collection(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions");
        const sessionsSnapshot = await getDocs(sessionsRef);
        const sessions = sessionsSnapshot.docs.sort((a, b) => {
          return DAY_ORDER.indexOf(a.data().day) - DAY_ORDER.indexOf(b.data().day);
        });

        const prescriptions = [
          { category: "Rest", prescription: {} },
          { category: "Run", prescription: { type: "easy", distanceKm: 5, targetPace: "5:30/km", guidance: "Comfortable aerobic effort" } },
          { category: "Strength", prescription: { focus: "lower", guidance: "Posterior chain emphasis" } },
          { category: "Run", prescription: { type: "tempo", distanceKm: 6, targetPace: "4:50/km", guidance: "Controlled threshold effort" } },
          { category: "Rest", prescription: {} },
          { category: "Run", prescription: { type: "easy", distanceKm: 8, targetPace: "5:30/km" } },
          { category: "Run", prescription: { type: "long", distanceKm: 14, targetPace: "5:45/km", guidance: "Steady aerobic long run" } },
        ];

        for (let i = 0; i < sessions.length; i++) {
          await updateDoc(sessions[i].ref, {
            category: prescriptions[i].category,
            prescription: prescriptions[i].prescription,
          });
        }
      }

      weekNumber++;
      currentStart.setDate(currentStart.getDate() + 7);
    }

    alert("Training block created.");
    window.location.reload();
  };

  const handleSave = async () => {
    if (!user) return;
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, { currentGoal: goal, eventDate }, { merge: true });
    alert("Profile saved.");
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
        <button
          onClick={() => signOut(auth)}
          className="text-sm text-gray-400 hover:text-gray-700"
        >
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
        <button onClick={handleCreateBlock} className="bg-purple-600 text-white px-4 py-2 rounded">
          Create Training Block
        </button>
      </div>

    </main>
  );
}
