"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  doc, setDoc, getDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs, updateDoc, orderBy, writeBatch, limit, deleteDoc
} from "firebase/firestore";
import { signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { TrainingBlock, TrainingWeek, Session, Category, Day, Actual, Prescription, SessionChange, CoachSessionChange, CoachSessionLog, IncidentType } from "../lib/types";
import { computeBlockSummary, formatProgressContext } from "../lib/analytics";
import TodayView from "../components/TodayView";
import PlanView from "../components/PlanView";
import ReviewView from "../components/ReviewView";
import ProgressView from "../components/ProgressView";
import CoachChat from "../components/CoachChat";
import TrainingWeeks from "../components/TrainingWeeks";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [activeBlock, setActiveBlock] = useState<TrainingBlock | null>(null);
  const [queuedBlock, setQueuedBlock] = useState<TrainingBlock | null>(null);
  const [completedBlocks, setCompletedBlocks] = useState<TrainingBlock[]>([]);
  const [weeks, setWeeks] = useState<TrainingWeek[]>([]);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [coachHistory, setCoachHistory] = useState<CoachSessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"today" | "plan" | "review" | "progress">("today");
  const [stravaAthleteInfo, setStravaAthleteInfo] = useState<string | null>(null);
  const [stravaAccessToken, setStravaAccessToken] = useState<string | null>(null);

  const todayISO = new Date().toISOString().split("T")[0];
  const todayDate = new Date(todayISO);
  const todayDay = todayDate.toLocaleDateString("en-US", { weekday: "long" }) as Day;

  const progressContext = useMemo(
    () => formatProgressContext(completedBlocks, coachHistory),
    [completedBlocks, coachHistory]
  );

  const currentWeek = weeks.find(week => {
    const start = new Date(week.startDate);
    const end = new Date(week.endDate);
    return todayDate >= start && todayDate <= end;
  }) ?? null;

  const todaySession = currentWeek?.sessions.find(s => s.day === todayDay) ?? null;

  const fetchBlockData = useCallback(async (uid: string) => {
    const blocksRef = collection(db, "users", uid, "trainingBlocks");
    const allBlocksSnapshot = await getDocs(query(blocksRef, orderBy("startDate", "asc")));
    const allBlocks = allBlocksSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as TrainingBlock));

    const active = allBlocks.find(b => b.status === "active") ?? null;
    const queued = allBlocks.find(b => b.status === "queued") ?? null;
    // Most-recent completed block first
    const completed = allBlocks.filter(b => b.status === "completed").reverse();

    setQueuedBlock(queued);
    setCompletedBlocks(completed);

    if (!active) {
      setActiveBlock(null);
      setWeeks([]);
      setExpandedWeek(null);
      return;
    }

    setActiveBlock(active);

    const weeksRef = collection(db, "users", uid, "trainingBlocks", active.id, "trainingWeeks");
    const weeksQuery = query(weeksRef, orderBy("startDate", "asc"));
    const weeksSnapshot = await getDocs(weeksQuery);

    const weeksData: TrainingWeek[] = [];
    let currentWeekId: string | null = null;
    const today = new Date(new Date().toISOString().split("T")[0]);

    for (const weekDoc of weeksSnapshot.docs) {
      const sessionsRef = collection(db, "users", uid, "trainingBlocks", active.id, "trainingWeeks", weekDoc.id, "sessions");
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

  // Handle Strava OAuth callback params and load existing Strava connection
  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(window.location.search);
    const stravaParam = params.get("strava");

    if (stravaParam === "connected") {
      const at = params.get("at") ?? "";
      const stravaRef = doc(db, "users", user.uid, "integrations", "strava");
      setDoc(stravaRef, {
        athleteId: Number(params.get("aid")),
        athleteName: params.get("an") ?? "",
        accessToken: at,
        refreshToken: params.get("rt") ?? "",
        expiresAt: Number(params.get("ea")),
        scope: "activity:read_all",
        connectedAt: serverTimestamp(),
      }).then(() => {
        setStravaAthleteInfo(params.get("an"));
        setStravaAccessToken(at);
        window.history.replaceState({}, "", window.location.pathname);
      });
    } else {
      const stravaRef = doc(db, "users", user.uid, "integrations", "strava");
      getDoc(stravaRef).then(snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        setStravaAthleteInfo(data.athleteName ?? null);
        const nowSecs = Math.floor(Date.now() / 1000);
        if (data.expiresAt > nowSecs + 60) setStravaAccessToken(data.accessToken ?? null);
      });
    }
  }, [user]);

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
        body: JSON.stringify({ goal: goal || "Maintenance", eventDate, weeks: 6, progressContext }),
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
      // Compute snapshot summary from current weeks state before marking completed
      const completedAt = new Date().toISOString().split("T")[0];
      const summary = computeBlockSummary(weeks, completedAt);
      await updateDoc(docSnap.ref, { status: "completed", endedAt: serverTimestamp(), summary });
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

  const handleQueueBlock = async (nextGoal: string, numWeeks: number) => {
    if (!user || !activeBlock || queuedBlock) return;

    // Start the day after the active block ends
    const activeEnd = new Date(activeBlock.endDate + "T12:00:00");
    const start = new Date(activeEnd);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + (numWeeks * 7) - 1);

    const blocksRef = collection(db, "users", user.uid, "trainingBlocks");
    await addDoc(blocksRef, {
      name: `${nextGoal} Block`,
      primaryGoal: nextGoal,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      status: "queued",
      createdAt: serverTimestamp(),
    });

    await fetchBlockData(user.uid);
  };

  const handleRemoveQueuedBlock = async () => {
    if (!user || !queuedBlock) return;
    await deleteDoc(doc(db, "users", user.uid, "trainingBlocks", queuedBlock.id));
    await fetchBlockData(user.uid);
  };

  const handleActivateQueuedBlock = async () => {
    if (!user || !queuedBlock) return;
    setCreating(true);

    // Generate sessions using the queued block's goal
    let generatedPlan: any = null;
    try {
      // Derive week count from queued block's date range for the API call
      const qBlockStart = new Date(queuedBlock.startDate + "T12:00:00");
      const qBlockEnd = new Date(queuedBlock.endDate + "T12:00:00");
      const qBlockWeeks = Math.round((qBlockEnd.getTime() - qBlockStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: queuedBlock.primaryGoal, eventDate, weeks: qBlockWeeks, progressContext }),
      });
      if (!res.ok) throw new Error("API error");
      generatedPlan = await res.json();
    } catch {
      setCreating(false);
      return;
    }

    // Complete the current active block with a summary snapshot
    const blocksRef = collection(db, "users", user.uid, "trainingBlocks");
    const activeSnapshot = await getDocs(query(blocksRef, where("status", "==", "active")));
    for (const docSnap of activeSnapshot.docs) {
      const completedAt = new Date().toISOString().split("T")[0];
      const summary = computeBlockSummary(weeks, completedAt);
      await updateDoc(docSnap.ref, { status: "completed", endedAt: serverTimestamp(), summary });
    }

    // Promote queued → active
    const queuedRef = doc(db, "users", user.uid, "trainingBlocks", queuedBlock.id);
    await updateDoc(queuedRef, { status: "active" });

    // Derive week count from queued block's stored date range
    const blockId = queuedBlock.id;
    const qStart = new Date(queuedBlock.startDate + "T12:00:00");
    const qEnd = new Date(queuedBlock.endDate + "T12:00:00");
    const numWeeks = Math.round((qEnd.getTime() - qStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const current = new Date(qStart);

    for (let weekIndex = 0; weekIndex < numWeeks; weekIndex++) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekRef = await addDoc(
        collection(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks"),
        {
          startDate: weekStart.toISOString().split("T")[0],
          endDate: weekEnd.toISOString().split("T")[0],
          createdAt: serverTimestamp(),
        }
      );

      const weekId = weekRef.id;
      const weekPlan = generatedPlan.weeks?.[weekIndex];
      const day = new Date(weekStart);

      while (day <= weekEnd) {
        const dayName = DAY_NAMES[day.getDay()] as Day;
        const sessionPlan = weekPlan?.sessions?.find((s: any) => s.day === dayName);
        await addDoc(
          collection(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions"),
          {
            day: dayName,
            category: sessionPlan?.category ?? null,
            completed: false,
            prescription: sessionPlan?.prescription ?? {},
            actual: {},
            aiGenerated: true,
            manuallyModified: false,
            createdAt: serverTimestamp(),
          }
        );
        day.setDate(day.getDate() + 1);
      }

      current.setDate(current.getDate() + 7);
    }

    await fetchBlockData(user.uid);
    setCreating(false);
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

  const applyChanges = async (changes: SessionChange[], meta: { firstMessage: string; summary: string; incidentType?: IncidentType }) => {
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
      ...(meta.incidentType && { incidentType: meta.incidentType }),
    });

    await batch.commit();

    setCoachHistory(prev => [{
      id: coachSessionRef.id,
      appliedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      firstMessage: meta.firstMessage,
      summary: meta.summary,
      changesCount: changes.length,
      changes: logChanges,
      ...(meta.incidentType && { incidentType: meta.incidentType }),
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

  const updateSessionPrescription = async (blockId: string, weekId: string, sessionId: string, newCategory: Category, newPrescription: Prescription) => {
    if (!user) return;
    const sessionRef = doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId);
    await updateDoc(sessionRef, { category: newCategory, prescription: newPrescription, manuallyModified: true });
    setWeeks(prev => prev.map(week =>
      week.id === weekId
        ? { ...week, sessions: week.sessions.map(s => s.id === sessionId ? { ...s, category: newCategory, prescription: newPrescription, manuallyModified: true } : s) }
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView("today")}
            className={`text-[10px] tracking-[0.15em] uppercase transition-colors ${view === "today" ? "text-stone-900 font-semibold" : "text-stone-400 hover:text-stone-700"}`}
          >
            Today
          </button>
          <button
            onClick={() => setView("plan")}
            className={`text-[10px] tracking-[0.15em] uppercase transition-colors ${view === "plan" ? "text-stone-900 font-semibold" : "text-stone-400 hover:text-stone-700"}`}
          >
            Plan
          </button>
          <button
            onClick={() => setView("review")}
            className={`text-[10px] tracking-[0.15em] uppercase transition-colors ${view === "review" ? "text-stone-900 font-semibold" : "text-stone-400 hover:text-stone-700"}`}
          >
            Review
          </button>
          <button
            onClick={() => setView("progress")}
            className={`text-[10px] tracking-[0.15em] uppercase transition-colors ${view === "progress" ? "text-stone-900 font-semibold" : "text-stone-400 hover:text-stone-700"}`}
          >
            Progress
          </button>
          <button onClick={() => signOut(auth)} className="text-[10px] tracking-[0.15em] uppercase text-stone-400 hover:text-stone-700 transition-colors">
            Sign out
          </button>
        </div>
      </div>

      {/* Today: TodayWorkout + ActiveBlock */}
      {view === "today" && (
        <TodayView
          activeBlock={activeBlock}
          weeks={weeks}
          currentWeek={currentWeek}
          todaySession={todaySession}
          todayDay={todayDay}
          goal={goal}
          eventDate={eventDate}
          stravaToken={stravaAccessToken ?? undefined}
          onToggleSession={toggleSession}
          onLogActual={logActual}
        />
      )}

      {/* Plan view */}
      {view === "plan" && (
        <PlanView
          uid={user.uid}
          activeBlock={activeBlock}
          queuedBlock={queuedBlock}
          completedBlocks={completedBlocks}
          weeks={weeks}
          currentWeek={currentWeek}
          todayDay={todayDay}
          goal={goal}
          eventDate={eventDate}
          creating={creating}
          stravaAthleteInfo={stravaAthleteInfo}
          stravaToken={stravaAccessToken ?? undefined}
          onGoalChange={setGoal}
          onEventDateChange={setEventDate}
          onSave={handleSave}
          onCreateBlock={handleCreateBlock}
          onToggleSession={toggleSession}
          onLogActual={logActual}
          onCategoryChange={updateSessionCategory}
          onEditPrescription={updateSessionPrescription}
          onApplyChanges={applyChanges}
          onQueueBlock={handleQueueBlock}
          onRemoveQueuedBlock={handleRemoveQueuedBlock}
          onActivateQueuedBlock={handleActivateQueuedBlock}
        />
      )}

      {/* Review */}
      {view === "review" && (
        <ReviewView activeBlock={activeBlock} weeks={weeks} />
      )}

      {/* Progress */}
      {view === "progress" && (
        <ProgressView completedBlocks={completedBlocks} coachHistory={coachHistory} />
      )}

      {/* Coach — always mounted so conversation survives view switches, only on Today */}
      {weeks.length > 0 && (
        <div className={view === "today" ? "" : "hidden"}>
          <CoachChat weeks={weeks} coachHistory={coachHistory} progressContext={progressContext} onApplyChanges={applyChanges} />
        </div>
      )}

      {/* Today: TrainingWeeks + manage link */}
      {view === "today" && weeks.length > 0 && activeBlock && (
        <>
          <TrainingWeeks
            weeks={weeks}
            blockId={activeBlock.id}
            blockGoal={goal || activeBlock.primaryGoal}
            expandedWeek={expandedWeek}
            currentWeekId={currentWeek?.id ?? null}
            todayDay={todayDay}
            onToggleExpand={(id) => setExpandedWeek(expandedWeek === id ? null : id)}
            onToggleSession={toggleSession}
            onCategoryChange={updateSessionCategory}
            onLogActual={logActual}
            onEditPrescription={updateSessionPrescription}
            onApplyChanges={applyChanges}
          />
          <div className="pb-2">
            <button
              onClick={() => setView("plan")}
              className="text-[10px] tracking-[0.15em] uppercase text-stone-300 hover:text-stone-500 transition-colors"
            >
              Manage training block →
            </button>
          </div>
        </>
      )}

    </main>
  );
}
