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
} from "firebase/firestore";import { db } from "../lib/firebase";
import { useEffect, useState } from "react";
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../lib/firebase";


export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState("");
  const [eventDate, setEventDate] = useState("");

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
  } 
   else {
    setUser(null);
  }
});


    return () => unsubscribe();
  }, []);

  const handleCreateWeek = async () => {
    if (!user) return;

    const blocksRef = collection(db, "users", user.uid, "trainingBlocks");

    // 1️⃣ Find active block
    const activeQuery = query(blocksRef, where("status", "==", "active"));
    const activeSnapshot = await getDocs(activeQuery);

    if (activeSnapshot.empty) {
      alert("No active training block found. Create a block first.");
      return;
    }

    const activeBlockDoc = activeSnapshot.docs[0];
    const blockId = activeBlockDoc.id;

    // 2️⃣ Create week under active block
    const weeksRef = collection(
      db,
      "users",
      user.uid,
      "trainingBlocks",
      blockId,
      "trainingWeeks"
    );

    await addDoc(weeksRef, {
      startDate: new Date().toISOString().split("T")[0],
      status: "planned",
      createdAt: serverTimestamp(),
    });

    alert("Training week created under active block");
  };

  const handleCreateBlock = async () => {
    if (!user) return;

    const blocksRef = collection(db, "users", user.uid, "trainingBlocks");

    // 1️⃣ Find active block
    const activeQuery = query(blocksRef, where("status", "==", "active"));
    const activeSnapshot = await getDocs(activeQuery);

    // 2️⃣ If an active block exists, mark it completed
    for (const docSnap of activeSnapshot.docs) {
      await updateDoc(docSnap.ref, {
        status: "completed",
        endedAt: serverTimestamp(),
      });
    }

    // 3️⃣ Create new block
    const primaryGoal = goal || "Maintenance";
    const name =
      primaryGoal === "Maintenance"
        ? "Maintenance Block"
        : `${primaryGoal} Block`;

    await addDoc(blocksRef, {
      name,
      primaryGoal,
      secondaryGoal: null,
      startDate: new Date().toISOString().split("T")[0],
      targetDate: eventDate || null,
      status: "active",
      createdAt: serverTimestamp(),
    });

    alert("New training block created");
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

      <button
       onClick={handleCreateWeek}
       className="bg-green-600 text-white px-4 py-2 rounded mt-4"
      >
        Create Training Week
      </button>

    </div>
  </main>
);
}