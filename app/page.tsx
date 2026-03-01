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
import { orderBy } from "firebase/firestore";


export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [activeBlock, setActiveBlock] = useState<any>(null);
  const [weeks, setWeeks] = useState<any[]>([]);

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

  const weeksData = weeksSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  setWeeks(weeksData);
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

  const handleCreateWeek = async () => {
    if (!user) return;

    const weeksCollection = collection(db, "users", user.uid, "trainingWeeks");

    await addDoc(weeksCollection, {
      startDate: new Date().toISOString().split("T")[0],
      mainFocus: goal || "General",
      status: "planned",
      createdAt: serverTimestamp(),
    });

    alert("Training week created");
  };

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

  while (currentStart <= endDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentStart.getDate() + 6);

    if (currentEnd > endDate) {
      currentEnd.setTime(endDate.getTime());
    }

    await addDoc(
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