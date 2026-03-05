"use client";

import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc
} from "firebase/firestore"; import { db } from "../lib/firebase";
import { useEffect, useState } from "react";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../lib/firebase";
import { orderBy } from "firebase/firestore";


export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [activeBlock, setActiveBlock] = useState<any>(null);
  const [weeks, setWeeks] = useState<any[]>([]);
  const [todaySession, setTodaySession] = useState<any>(null);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

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
          console.log("User document created");
        }

        if (userSnap.exists()) {
          const data = userSnap.data();
          setGoal(data.currentGoal || "");
          setEventDate(data.eventDate || "");
        }
        setUser(currentUser);
        // 🔹 Fetch active block
        const blocksRef = collection(db, "users", currentUser.uid, "trainingBlocks");
        const activeQuery = query(blocksRef, where("status", "==", "active"));
        const activeSnapshot = await getDocs(activeQuery);

        if (!activeSnapshot.empty) {
          const blockDoc = activeSnapshot.docs[0];
          setActiveBlock({ id: blockDoc.id, ...blockDoc.data() });

          const weeksRef = collection(
            db,
            "users",
            currentUser.uid,
            "trainingBlocks",
            blockDoc.id,
            "trainingWeeks"
          );


          const weeksQuery = query(
            weeksRef,
            orderBy("startDate", "asc")
          );

          const weeksSnapshot = await getDocs(weeksQuery);

          const weeksData = [];

          for (const weekDoc of weeksSnapshot.docs) {
            const weekId = weekDoc.id;

            const sessionsRef = collection(
              db,
              "users",
              currentUser.uid,
              "trainingBlocks",
              blockDoc.id,
              "trainingWeeks",
              weekId,
              "sessions"
            );

            const sessionsSnapshot = await getDocs(sessionsRef);

            const sessions = sessionsSnapshot.docs.map(sessionDoc => ({
              id: sessionDoc.id,
              ...sessionDoc.data(),
            }));

            weeksData.push({
              id: weekId,
              ...weekDoc.data(),
              sessions,
            });
          }
          setWeeks(weeksData);

          const today = new Date().toLocaleDateString("en-US", {
            weekday: "long",
          });

          for (const week of weeksData) {
            const session = week.sessions?.find(
              (s: any) => s.day === today
            );

            if (session) {
              setTodaySession(session);
              break;
            }
          }
          console.log("Active Block:", blockDoc.data());
          console.log("Weeks:", weeksData);
        }
      }
      else {
        setUser(null);
      }
    });


    return () => unsubscribe();
  }, []);


  const handleCreateBlock = async () => {
    if (!user) return;

    const blocksRef = collection(db, "users", user.uid, "trainingBlocks");

    // 1️⃣ Find existing active block
    const activeQuery = query(blocksRef, where("status", "==", "active"));
    const activeSnapshot = await getDocs(activeQuery);

    // 2️⃣ Mark existing active blocks as completed
    for (const docSnap of activeSnapshot.docs) {
      await updateDoc(docSnap.ref, {
        status: "completed",
        endedAt: serverTimestamp(),
      });
    }

    // 3️⃣ Hardcode 6-week duration
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 42); // 6 weeks

    const primaryGoal = goal || "Maintenance";
    const name =
      primaryGoal === "Maintenance"
        ? "Maintenance Block"
        : `${primaryGoal} Block`;

    // 4️⃣ Create the block
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

    // 5️⃣ Generate weeks inside this block
    let currentStart = new Date(startDate);
    let weekNumber = 1;

    while (currentStart <= endDate) {
      const currentEnd = new Date(currentStart);
      currentEnd.setDate(currentStart.getDate() + 6);

      if (currentEnd > endDate) {
        currentEnd.setTime(endDate.getTime());
      }

      const weekRef = await addDoc(
        collection(
          db,
          "users",
          user.uid,
          "trainingBlocks",
          blockId,
          "trainingWeeks"
        ),
        {
          startDate: currentStart.toISOString().split("T")[0],
          endDate: currentEnd.toISOString().split("T")[0],
          createdAt: serverTimestamp(),
        }
      );

      const weekId = weekRef.id;

      // 🔹 Generate 7 placeholder sessions
      const days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ];

      for (let i = 0; i < 7; i++) {
        await addDoc(
          collection(
            db,
            "users",
            user.uid,
            "trainingBlocks",
            blockId,
            "trainingWeeks",
            weekId,
            "sessions"
          ),
          {
            day: days[i],
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
        const sessionsRef = collection(
          db,
          "users",
          user.uid,
          "trainingBlocks",
          blockId,
          "trainingWeeks",
          weekId,
          "sessions"
        );

        const sessionsSnapshot = await getDocs(sessionsRef);

        const sessions = sessionsSnapshot.docs;

        const prescriptions = [
          { category: "Rest", prescription: {} },
          {
            category: "Run",
            prescription: {
              type: "easy",
              distanceKm: 5,
              targetPace: "5:30/km",
              guidance: "Comfortable aerobic effort"
            }
          },
          {
            category: "Strength",
            prescription: {
              focus: "lower",
              guidance: "Posterior chain emphasis"
            }
          },
          {
            category: "Run",
            prescription: {
              type: "tempo",
              distanceKm: 6,
              targetPace: "4:50/km",
              guidance: "Controlled threshold effort"
            }
          },
          { category: "Rest", prescription: {} },
          {
            category: "Run",
            prescription: {
              type: "easy",
              distanceKm: 8,
              targetPace: "5:30/km"
            }
          },
          {
            category: "Run",
            prescription: {
              type: "long",
              distanceKm: 14,
              targetPace: "5:45/km",
              guidance: "Steady aerobic long run"
            }
          }
        ];

        for (let i = 0; i < sessions.length; i++) {
          await updateDoc(sessions[i].ref, {
            category: prescriptions[i].category,
            prescription: prescriptions[i].prescription
          });
        }
      }

      weekNumber++;
      currentStart.setDate(currentStart.getDate() + 7);
    }

    alert("6-week block with weeks generated successfully");
  };


  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);

    await setDoc(
      userRef,
      {
        currentGoal: goal,
        eventDate: eventDate,
      },
      { merge: true }
    );

    alert("Profile saved");
  };



  const toggleSession = async (
    blockId: string,
    weekId: string,
    sessionId: string,
    currentValue: boolean
  ) => {
    if (!user) return;

    const sessionRef = doc(
      db,
      "users",
      user.uid,
      "trainingBlocks",
      blockId,
      "trainingWeeks",
      weekId,
      "sessions",
      sessionId
    );

    await updateDoc(sessionRef, {
      completed: !currentValue,
    });

    // Optimistically update UI state
    setWeeks((prevWeeks) =>
      prevWeeks.map((week) =>
        week.id === weekId
          ? {
            ...week,
            sessions: week.sessions.map((session: any) =>
              session.id === sessionId
                ? { ...session, completed: !currentValue }
                : session
            ),
          }
          : week
      )
    );
  };

  const updateSessionCategory = async (
    blockId: string,
    weekId: string,
    sessionId: string,
    newCategory: string
  ) => {
    if (!user) return;

    const sessionRef = doc(
      db,
      "users",
      user.uid,
      "trainingBlocks",
      blockId,
      "trainingWeeks",
      weekId,
      "sessions",
      sessionId
    );

    await updateDoc(sessionRef, {
      category: newCategory,
    });

    // Optimistically update local state
    setWeeks((prevWeeks) =>
      prevWeeks.map((week) =>
        week.id === weekId
          ? {
            ...week,
            sessions: week.sessions.map((session: any) =>
              session.id === sessionId
                ? { ...session, category: newCategory }
                : session
            ),
          }
          : week
      )
    );
  };



  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <button
          onClick={handleLogin}
          className="bg-black text-white px-6 py-3 rounded-lg"
        >
          Sign in with Google
        </button>
      </main>
    );
  }



  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold">Welcome, {user.displayName}</h1>
      <p>{user.email}</p>

      {activeBlock && (
        <div className="mt-6 p-4 border rounded w-full max-w-md">
          <h2 className="text-lg font-semibold">Active Block</h2>
          <p><strong>Name:</strong> {activeBlock.name}</p>
          <p><strong>Start:</strong> {activeBlock.startDate}</p>
          <p><strong>End:</strong> {activeBlock.endDate}</p>
        </div>
      )}

      {todaySession && (
        <div className="mt-6 p-4 border rounded w-full max-w-md bg-gray-50">
          <h2 className="text-lg font-semibold mb-2">Today's Workout</h2>

          <div className="text-sm">
            <div className="font-medium">{todaySession.day}</div>

            {todaySession.category === "Run" && (
              <>
                <div>Type: {todaySession.prescription?.type}</div>
                <div>Distance: {todaySession.prescription?.distanceKm} km</div>
                <div>Pace: {todaySession.prescription?.targetPace}</div>
                <div>{todaySession.prescription?.guidance}</div>
              </>
            )}

            {todaySession.category === "Strength" && (
              <>
                <div>Focus: {todaySession.prescription?.focus}</div>
                <div>{todaySession.prescription?.guidance}</div>
              </>
            )}

            {todaySession.category === "Rest" && (
              <div>Rest day</div>
            )}
          </div>
        </div>
      )}

      {weeks.length > 0 && (
        <div className="mt-6 w-full max-w-md">
          <h2 className="text-lg font-semibold mb-2">Training Weeks</h2>

          <div className="flex flex-col gap-2">
            {weeks.map((week, index) => (
              <div key={week.id} className="p-4 border rounded">
                <div
                  onClick={() =>
                    setExpandedWeek(expandedWeek === week.id ? null : week.id)
                  }
                  className="flex justify-between mb-2 cursor-pointer"
                >
                  <span className="font-semibold">Week {index + 1}</span>
                  <span>
                    {week.startDate} → {week.endDate}
                  </span>
                </div>

                {expandedWeek === week.id && (
                  <div className="ml-4 flex flex-col gap-1">
                    {week.sessions?.map((session: any) => (
                      <div
                        key={session.id}
                        onClick={() =>
                          toggleSession(
                            activeBlock.id,
                            week.id,
                            session.id,
                            session.completed
                          )
                        }
                        className="border-b py-2 cursor-pointer hover:bg-gray-50"
                      >
                        <div className="flex flex-col w-full">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{session.day}</span>

                            <div className="flex items-center gap-3">
                              <select
                                value={session.category || ""}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  updateSessionCategory(
                                    activeBlock.id,
                                    week.id,
                                    session.id,
                                    e.target.value
                                  )
                                }
                                className="border rounded px-2 py-1 text-xs"
                              >
                                <option value="">Select</option>
                                <option value="Run">Run</option>
                                <option value="Strength">Strength</option>
                                <option value="Rest">Rest</option>
                              </select>

                              <span>{session.completed ? "✅" : "⬜"}</span>
                            </div>
                          </div>

                          {session.prescription &&
                            Object.keys(session.prescription).length > 0 && (
                              <div className="text-xs text-gray-600 mt-1">
                                {session.category === "Run" && (
                                  <>
                                    <div>Type: {session.prescription.type}</div>
                                    <div>Distance: {session.prescription.distanceKm} km</div>
                                    <div>Pace: {session.prescription.targetPace}</div>
                                    {session.prescription.guidance && (
                                      <div>{session.prescription.guidance}</div>
                                    )}
                                  </>
                                )}

                                {session.category === "Strength" && (
                                  <>
                                    <div>Focus: {session.prescription.focus}</div>
                                    {session.prescription.guidance && (
                                      <div>{session.prescription.guidance}</div>
                                    )}
                                  </>
                                )}

                                {session.category === "Rest" && <div>Rest day</div>}
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      )}

      <div className="flex flex-col gap-3 mt-6">
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

        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Save Profile
        </button>

        <button
          onClick={handleCreateBlock}
          className="bg-purple-600 text-white px-4 py-2 rounded mt-4"
        >
          Create Training Block
        </button>


      </div>
    </main>
  );
}