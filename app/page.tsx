"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  doc, setDoc, getDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs, updateDoc, orderBy, writeBatch, limit, deleteDoc
} from "firebase/firestore";
import { signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import {
  TrainingBlock, TrainingWeek, Session, Category, Day, Actual, Prescription,
  SessionChange, CoachSessionChange, CoachSessionLog, IncidentType, HyroxBenchmarks,
} from "../lib/types";
import { computeBlockSummary, formatProgressContext, computeRacePredictions } from "../lib/analytics";
import { RaceTimePredictions } from "../lib/types";
import { getDaysToRace } from "../lib/race";
import BottomNav, { Zone } from "../components/BottomNav";
import NowZone from "../components/NowZone";
import BlockZone from "../components/BlockZone";
import CoachZone from "../components/CoachZone";
import ProgressZone from "../components/ProgressZone";
import RaceDayBriefing from "../components/RaceDayBriefing";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [activeBlock, setActiveBlock] = useState<TrainingBlock | null>(null);
  const [queuedBlock, setQueuedBlock] = useState<TrainingBlock | null>(null);
  const [completedBlocks, setCompletedBlocks] = useState<TrainingBlock[]>([]);
  const [weeks, setWeeks] = useState<TrainingWeek[]>([]);
  const [coachHistory, setCoachHistory] = useState<CoachSessionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [zone, setZone] = useState<Zone>("now");
  const [stravaAthleteInfo, setStravaAthleteInfo] = useState<string | null>(null);
  const [stravaAccessToken, setStravaAccessToken] = useState<string | null>(null);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [expandedBlockData, setExpandedBlockData] = useState<Map<string, TrainingWeek[]>>(new Map());
  const [expandingBlockId, setExpandingBlockId] = useState<string | null>(null);
  const [hyroxBenchmarks, setHyroxBenchmarks] = useState<HyroxBenchmarks | null>(null);
  const [showRaceBriefing, setShowRaceBriefing] = useState(false);

  const todayISO = new Date().toISOString().split("T")[0];
  const todayDate = new Date(todayISO);
  const todayDay = todayDate.toLocaleDateString("en-US", { weekday: "long" }) as Day;

  const progressContext = useMemo(
    () => formatProgressContext(completedBlocks, coachHistory),
    [completedBlocks, coachHistory]
  );

  const daysToRace = useMemo(() => getDaysToRace(eventDate), [eventDate]);

  const racePredictions = useMemo<RaceTimePredictions>(() => {
    if (!weeks.length || !goal) return {};
    return computeRacePredictions(weeks, goal, hyroxBenchmarks);
  }, [weeks, goal, hyroxBenchmarks]);

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
    const completed = allBlocks.filter(b => b.status === "completed").reverse();

    setQueuedBlock(queued);
    setCompletedBlocks(completed);

    if (!active) {
      setActiveBlock(null);
      setWeeks([]);
      return;
    }

    setActiveBlock(active);

    const weeksRef = collection(db, "users", uid, "trainingBlocks", active.id, "trainingWeeks");
    const weeksSnapshot = await getDocs(query(weeksRef, orderBy("startDate", "asc")));

    const weeksData: TrainingWeek[] = [];

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

      weeksData.push({ id: weekDoc.id, ...weekDoc.data(), sessions } as TrainingWeek);
    }

    setWeeks(weeksData);

    const historyQuery = query(
      collection(db, "users", uid, "coachSessions"),
      orderBy("appliedAt", "desc"),
      limit(10)
    );
    const historySnap = await getDocs(historyQuery);
    setCoachHistory(historySnap.docs.map(d => ({ id: d.id, ...d.data() } as CoachSessionLog)));
  }, []);

  const fetchCompletedBlockDetail = useCallback(async (uid: string, blockId: string): Promise<TrainingWeek[]> => {
    const weeksRef = collection(db, "users", uid, "trainingBlocks", blockId, "trainingWeeks");
    const weeksSnapshot = await getDocs(query(weeksRef, orderBy("startDate", "asc")));

    const weeksData: TrainingWeek[] = [];

    for (const weekDoc of weeksSnapshot.docs) {
      const sessionsRef = collection(db, "users", uid, "trainingBlocks", blockId, "trainingWeeks", weekDoc.id, "sessions");
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

      weeksData.push({ id: weekDoc.id, ...weekDoc.data(), sessions } as TrainingWeek);
    }

    return weeksData;
  }, []);

  const handleExpandCompletedBlock = useCallback(async (blockId: string) => {
    if (!user) return;

    // Toggle collapse if already expanded
    if (expandedBlockData.has(blockId)) {
      setExpandedBlockData(prev => {
        const next = new Map(prev);
        next.delete(blockId);
        return next;
      });
      return;
    }

    // Already loading
    if (expandingBlockId === blockId) return;

    setExpandingBlockId(blockId);
    try {
      const weeksData = await fetchCompletedBlockDetail(user.uid, blockId);
      setExpandedBlockData(prev => new Map(prev).set(blockId, weeksData));
    } finally {
      setExpandingBlockId(null);
    }
  }, [user, expandedBlockData, expandingBlockId, fetchCompletedBlockDetail]);

  // Strava OAuth callback + load existing connection
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("strava") === "connected") {
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
        const allowedEmail = process.env.NEXT_PUBLIC_ALLOWED_EMAIL;
        if (allowedEmail && currentUser.email !== allowedEmail) {
          await signOut(auth);
          setLoading(false);
          return;
        }

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
          setTelegramChatId(data.telegramChatId || "");
          setWhatsappPhone(data.whatsappPhone || "");
        }

        try {
          const hyroxSnap = await getDoc(doc(db, "users", currentUser.uid, "hyroxBenchmarks", "benchmarks"));
          if (hyroxSnap.exists()) setHyroxBenchmarks(hyroxSnap.data() as HyroxBenchmarks);
        } catch {
          // Firestore rules may not yet cover this path — non-fatal
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let generatedPlan: any = null;
    try {
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal || "Maintenance", eventDate, weeks: 6, progressContext, hyroxBenchmarks }),
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
    const nextMonday = new Date(week1End);
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
      name, primaryGoal, secondaryGoal: null,
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
        { startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0], createdAt: serverTimestamp() }
      );
      const weekId = weekRef.id;
      const weekPlan = generatedPlan.weeks?.[weekIndex];
      const current = new Date(start);
      while (current <= end) {
        const day = DAY_NAMES[current.getDay()] as Day;
        const sessionPlan = weekPlan?.sessions?.find((s: any) => s.day === day);
        await addDoc(
          collection(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions"),
          { day, category: sessionPlan?.category ?? null, completed: false, prescription: sessionPlan?.prescription ?? {}, actual: {}, aiGenerated: true, manuallyModified: false, createdAt: serverTimestamp() }
        );
        current.setDate(current.getDate() + 1);
      }
    }

    await fetchBlockData(user.uid);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { currentGoal: goal, eventDate }, { merge: true });
  };

  const handleSaveTelegramChatId = async (chatId: string) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { telegramChatId: chatId }, { merge: true });
    setTelegramChatId(chatId);
  };

  const handleSaveWhatsappPhone = async (phone: string) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid), { whatsappPhone: phone }, { merge: true });
    setWhatsappPhone(phone);
  };

  const handleSaveHyroxBenchmarks = async (benchmarks: HyroxBenchmarks) => {
    if (!user) return;
    await setDoc(doc(db, "users", user.uid, "hyroxBenchmarks", "benchmarks"), benchmarks);
    setHyroxBenchmarks(benchmarks);
  };

  const handleQueueBlock = async (nextGoal: string, numWeeks: number) => {
    if (!user || !activeBlock || queuedBlock) return;
    const activeEnd = new Date(activeBlock.endDate + "T12:00:00");
    const start = new Date(activeEnd);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + (numWeeks * 7) - 1);
    await addDoc(collection(db, "users", user.uid, "trainingBlocks"), {
      name: `${nextGoal} Block`, primaryGoal: nextGoal,
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      status: "queued", createdAt: serverTimestamp(),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let generatedPlan: any = null;
    try {
      const qStart = new Date(queuedBlock.startDate + "T12:00:00");
      const qEnd = new Date(queuedBlock.endDate + "T12:00:00");
      const qBlockWeeks = Math.round((qEnd.getTime() - qStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: queuedBlock.primaryGoal, eventDate, weeks: qBlockWeeks, progressContext, hyroxBenchmarks }),
      });
      if (!res.ok) throw new Error("API error");
      generatedPlan = await res.json();
    } catch {
      setCreating(false);
      return;
    }

    const blocksRef = collection(db, "users", user.uid, "trainingBlocks");
    const activeSnapshot = await getDocs(query(blocksRef, where("status", "==", "active")));
    for (const docSnap of activeSnapshot.docs) {
      const summary = computeBlockSummary(weeks, new Date().toISOString().split("T")[0]);
      await updateDoc(docSnap.ref, { status: "completed", endedAt: serverTimestamp(), summary });
    }

    await updateDoc(doc(db, "users", user.uid, "trainingBlocks", queuedBlock.id), { status: "active" });

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
        { startDate: weekStart.toISOString().split("T")[0], endDate: weekEnd.toISOString().split("T")[0], createdAt: serverTimestamp() }
      );
      const weekId = weekRef.id;
      const weekPlan = generatedPlan.weeks?.[weekIndex];
      const day = new Date(weekStart);
      while (day <= weekEnd) {
        const dayName = DAY_NAMES[day.getDay()] as Day;
        const sessionPlan = weekPlan?.sessions?.find((s: any) => s.day === dayName);
        await addDoc(
          collection(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions"),
          { day: dayName, category: sessionPlan?.category ?? null, completed: false, prescription: sessionPlan?.prescription ?? {}, actual: {}, aiGenerated: true, manuallyModified: false, createdAt: serverTimestamp() }
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
    await updateDoc(doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId), { completed: !currentValue });
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
        weekId: change.weekId, sessionId: change.sessionId, day: change.day,
        fromCategory: original?.category ?? null, fromPrescription: original?.prescription ?? {},
        toCategory: change.category, toPrescription: change.prescription,
      };
    });
    for (const change of changes) {
      const sessionRef = doc(db, "users", user.uid, "trainingBlocks", activeBlock.id, "trainingWeeks", change.weekId, "sessions", change.sessionId);
      batch.update(sessionRef, { category: change.category, prescription: change.prescription, manuallyModified: true });
    }
    const coachSessionRef = doc(collection(db, "users", user.uid, "coachSessions"));
    batch.set(coachSessionRef, {
      appliedAt: serverTimestamp(), firstMessage: meta.firstMessage, summary: meta.summary,
      changesCount: changes.length, changes: logChanges,
      ...(meta.incidentType && { incidentType: meta.incidentType }),
    });
    await batch.commit();
    setCoachHistory(prev => [{
      id: coachSessionRef.id,
      appliedAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
      firstMessage: meta.firstMessage, summary: meta.summary,
      changesCount: changes.length, changes: logChanges,
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
    await updateDoc(doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId), { actual });
    setWeeks(prev => prev.map(week =>
      week.id === weekId
        ? { ...week, sessions: week.sessions.map(s => s.id === sessionId ? { ...s, actual } : s) }
        : week
    ));
  };

  const updateSessionPrescription = async (blockId: string, weekId: string, sessionId: string, newCategory: Category, newPrescription: Prescription) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId), { category: newCategory, prescription: newPrescription, manuallyModified: true });
    setWeeks(prev => prev.map(week =>
      week.id === weekId
        ? { ...week, sessions: week.sessions.map(s => s.id === sessionId ? { ...s, category: newCategory, prescription: newPrescription, manuallyModified: true } : s) }
        : week
    ));
  };

  const updateSessionCategory = async (blockId: string, weekId: string, sessionId: string, newCategory: Category) => {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "trainingBlocks", blockId, "trainingWeeks", weekId, "sessions", sessionId), { category: newCategory });
    setWeeks(prev => prev.map(week =>
      week.id === weekId
        ? { ...week, sessions: week.sessions.map(s => s.id === sessionId ? { ...s, category: newCategory } : s) }
        : week
    ));
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950">
        <div className="flex flex-col items-center gap-6 animate-pulse">
          <div className="w-20 h-20 rounded-2xl bg-stone-900 flex items-center justify-center">
            <span className="font-display font-black text-4xl text-white tracking-tighter">C</span>
          </div>
        </div>
      </main>
    );
  }

  // ── Sign in ────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-950">
        <div className="flex flex-col items-center gap-8">
          <div className="w-16 h-16 rounded-2xl bg-stone-900 flex items-center justify-center">
            <span className="font-display font-black text-3xl text-white tracking-tighter">C</span>
          </div>
          <button
            onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
            className="bg-white text-stone-900 text-[11px] tracking-[0.15em] uppercase font-semibold px-8 py-3.5 rounded-xl hover:bg-stone-100 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  // ── Derived state for nav ──────────────────────────────────────────────────
  const todayDone = todaySession?.completed ?? false;
  const hasTodaySession = !!(todaySession?.category && todaySession.category !== "Rest");

  // ── App ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-[430px] mx-auto relative">

      {/* Race day briefing modal */}
      {showRaceBriefing && user && (
        <RaceDayBriefing
          eventDate={eventDate}
          goal={goal}
          progressContext={progressContext}
          uid={user.uid}
          whatsappPhone={whatsappPhone || undefined}
          telegramChatId={telegramChatId || undefined}
          onClose={() => setShowRaceBriefing(false)}
        />
      )}

      {/* NOW zone */}
      <div className={zone !== "now" ? "hidden" : ""}>
        <NowZone
          activeBlock={activeBlock}
          currentWeek={currentWeek}
          todaySession={todaySession}
          stravaToken={stravaAccessToken ?? undefined}
          daysToRace={daysToRace}
          eventDate={eventDate}
          racePredictions={racePredictions}
          onToggleSession={toggleSession}
          onLogActual={logActual}
          onGoToBlock={() => setZone("block")}
          onViewBriefing={() => setShowRaceBriefing(true)}
        />
      </div>

      {/* BLOCK zone */}
      <div className={zone !== "block" ? "hidden" : ""}>
        <BlockZone
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
          expandedBlockData={expandedBlockData}
          expandingBlockId={expandingBlockId}
          onExpandCompletedBlock={handleExpandCompletedBlock}
        />
      </div>

      {/* COACH zone — always mounted so conversation state persists */}
      <div className={zone !== "coach" ? "hidden" : ""}>
        <CoachZone
          activeBlock={activeBlock}
          weeks={weeks}
          todaySession={todaySession}
          eventDate={eventDate}
          coachHistory={coachHistory}
          progressContext={progressContext}
          goal={goal}
          userName={user.displayName ?? user.email ?? ""}
          telegramChatId={telegramChatId}
          whatsappPhone={whatsappPhone}
          hyroxBenchmarks={hyroxBenchmarks}
          onApplyChanges={applyChanges}
          onSaveTelegramChatId={handleSaveTelegramChatId}
          onSaveWhatsappPhone={handleSaveWhatsappPhone}
          onSaveHyroxBenchmarks={handleSaveHyroxBenchmarks}
        />
      </div>

      {/* PROGRESS zone */}
      <div className={zone !== "progress" ? "hidden" : ""}>
        <ProgressZone
          activeBlock={activeBlock}
          weeks={weeks}
          completedBlocks={completedBlocks}
          coachHistory={coachHistory}
          hyroxBenchmarks={hyroxBenchmarks}
          racePredictions={racePredictions}
        />
      </div>

      {/* Bottom navigation */}
      <BottomNav
        zone={zone}
        onChange={setZone}
        todayDone={todayDone}
        hasTodaySession={hasTodaySession}
      />
    </div>
  );
}
