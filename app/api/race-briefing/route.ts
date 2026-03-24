import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";
import { TrainingBlock, TrainingWeek, Session } from "../../../lib/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getDayOffset(weekStartDate: string, day: string): number {
  const start = new Date(weekStartDate + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (DAY_NAMES[d.getDay()] === day) return i;
  }
  return 0;
}

export async function POST(req: NextRequest) {
  const { uid, eventDate, goal, progressContext } = await req.json();

  if (!uid || !eventDate) {
    return NextResponse.json({ error: "Missing uid or eventDate" }, { status: 400 });
  }

  // Check if eventDate is in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const race = new Date(eventDate + "T00:00:00");
  if (race < today) {
    return NextResponse.json({ error: "Event date is in the past" }, { status: 400 });
  }

  // Deduplication check: if briefing already sent for this eventDate within 24h, return alreadySent
  const userDoc = await adminDb.doc(`users/${uid}`).get();
  const userData = userDoc.data() ?? {};
  const existing = userData.raceBriefingSent;
  if (existing && existing.eventDate === eventDate) {
    const sentAt = existing.sentAt?.toMillis ? existing.sentAt.toMillis() : 0;
    if (Date.now() - sentAt < 24 * 60 * 60 * 1000) {
      return NextResponse.json({ alreadySent: true });
    }
  }

  // Fetch active block
  const blocksSnap = await adminDb
    .collection(`users/${uid}/trainingBlocks`)
    .where("status", "==", "active")
    .limit(1)
    .get();

  let recentWeeksSummary = "";

  if (!blocksSnap.empty) {
    const activeBlock = { id: blocksSnap.docs[0].id, ...blocksSnap.docs[0].data() } as TrainingBlock;

    // Last 3 weeks of sessions
    const weeksSnap = await adminDb
      .collection(`users/${uid}/trainingBlocks/${activeBlock.id}/trainingWeeks`)
      .orderBy("startDate", "desc")
      .limit(3)
      .get();

    const recentWeeks: TrainingWeek[] = await Promise.all(
      weeksSnap.docs.map(async (weekDoc) => {
        const sessionsSnap = await adminDb
          .collection(`users/${uid}/trainingBlocks/${activeBlock.id}/trainingWeeks/${weekDoc.id}/sessions`)
          .get();
        const weekData = weekDoc.data() as Omit<TrainingWeek, "id" | "sessions">;
        const sessions: Session[] = sessionsSnap.docs
          .map(s => ({ id: s.id, ...s.data() } as Session))
          .sort((a, b) => getDayOffset(weekData.startDate, a.day) - getDayOffset(weekData.startDate, b.day));
        return { id: weekDoc.id, ...weekData, sessions };
      })
    );

    recentWeeksSummary = recentWeeks
      .map(w => {
        const done = w.sessions.filter(s => s.completed).length;
        const total = w.sessions.filter(s => s.category && s.category !== "Rest").length;
        return `Week of ${w.startDate}: ${done}/${total} sessions completed`;
      })
      .join("\n");
  }

  // Coach history
  const historySnap = await adminDb
    .collection(`users/${uid}/coachSessions`)
    .orderBy("appliedAt", "desc")
    .limit(5)
    .get();
  const coachHistoryStr = historySnap.docs
    .map(d => {
      const data = d.data();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const date = new Date((data.appliedAt as any).seconds * 1000).toISOString().split("T")[0];
      return `- ${date}: "${data.firstMessage}"`;
    })
    .join("\n");

  const prompt = `You are an experienced running coach preparing an athlete for their race tomorrow (${eventDate}).

Goal: ${goal || "Race completion"}
${progressContext ? `\nAthlete history:\n${progressContext}\n` : ""}${recentWeeksSummary ? `\nRecent training:\n${recentWeeksSummary}\n` : ""}${coachHistoryStr ? `\nCoach session notes:\n${coachHistoryStr}\n` : ""}
Generate a race morning briefing. Return ONLY valid JSON with these exact fields:

{
  "wakeUpTimeline": "Step-by-step morning timeline from wake-up to race start (2-4 steps)",
  "nutrition": "Race morning nutrition guidance (1-2 sentences)",
  "warmup": "Pre-race warmup routine (2-3 sentences)",
  "targetSplits": "Target pacing/splits strategy (2-3 sentences)",
  "mentalCues": "2-3 short mental cues or mantras for the race",
  "briefingText": "WhatsApp-friendly combined message under 400 chars, no markdown"
}`;

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let briefingData: {
      wakeUpTimeline: string;
      nutrition: string;
      warmup: string;
      targetSplits: string;
      mentalCues: string;
      briefingText: string;
    };

    if (!cleaned.startsWith("{")) {
      briefingData = {
        wakeUpTimeline: "Wake up 3h before race. Eat breakfast 2.5h out. Arrive at start 45 min early.",
        nutrition: "Light, familiar breakfast. Sip water until 30 min before race.",
        warmup: "10 min easy jog. Dynamic stretches. 2-3 strides at race pace.",
        targetSplits: "Start conservatively. Run your own race. Push the final km.",
        mentalCues: "Trust the training. One km at a time. You are ready.",
        briefingText: `Race day! Trust your training. Start easy, run your own race, and push in the final stretch. You've put in the work — now go show it. Good luck!`,
      };
    } else {
      briefingData = JSON.parse(cleaned);
    }

    // Mark briefing as sent
    await adminDb.doc(`users/${uid}`).update({
      raceBriefingSent: {
        eventDate,
        sentAt: FieldValue.serverTimestamp(),
      },
    });

    return NextResponse.json({
      briefing: {
        briefingText: briefingData.briefingText,
        wakeUpTimeline: briefingData.wakeUpTimeline,
        nutrition: briefingData.nutrition,
        warmup: briefingData.warmup,
        targetSplits: briefingData.targetSplits,
        mentalCues: briefingData.mentalCues,
      },
    });
  } catch (err) {
    console.error("Race briefing error:", err);
    return NextResponse.json({ error: "Failed to generate briefing" }, { status: 500 });
  }
}
