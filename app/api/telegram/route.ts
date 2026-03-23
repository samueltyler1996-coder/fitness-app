import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../lib/firebase-admin";
import { formatProgressContext } from "../../../lib/analytics";
import { TrainingBlock, TrainingWeek, Session, SessionChange, CoachSessionChange, CoachSessionLog } from "../../../lib/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ConversationMessage {
  role: "user" | "coach";
  content: string;
  changes?: SessionChange[];
}

// ── Send a Telegram message ───────────────────────────────────────────────────

async function sendMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) console.error("Telegram send error:", await res.text());
}

// ── Incoming update ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await req.json();
  const message = body?.message;

  if (!message?.text) return NextResponse.json({ status: "ok" });

  const chatId: number = message.chat.id;
  const text: string = message.text.trim();

  // Look up user by Telegram chat ID
  const chatIdStr = String(chatId);
  const usersSnap = await adminDb.collection("users").where("telegramChatId", "==", chatIdStr).limit(1).get();

  if (usersSnap.empty) {
    await sendMessage(chatId,
      `Your Telegram ID is ${chatId}.\n\nOpen the app → Coach tab → Connect Telegram, and enter this number to link your account.`
    );
    return NextResponse.json({ status: "ok" });
  }

  const userDoc = usersSnap.docs[0];
  const uid = userDoc.id;
  const userData = userDoc.data();

  // ── YES / NO flow for pending changes ─────────────────────────────────────

  const pending = userData.pendingTelegramChanges ?? null;
  if (pending) {
    const reply = text.toLowerCase().trim();
    if (reply === "yes" || reply === "y") {
      await applyPendingChanges(uid, pending);
      await adminDb.doc(`users/${uid}`).update({ pendingTelegramChanges: FieldValue.delete() });
      await sendMessage(chatId, `✓ Done! ${pending.summary}`);
      return NextResponse.json({ status: "ok" });
    }
    if (reply === "no" || reply === "n") {
      await adminDb.doc(`users/${uid}`).update({ pendingTelegramChanges: FieldValue.delete() });
      await sendMessage(chatId, "Got it — no changes made.");
      return NextResponse.json({ status: "ok" });
    }
    // Not YES/NO — fall through to coaching flow, pending will be replaced or cleared
  }

  // ── Coaching flow ─────────────────────────────────────────────────────────

  const blocksSnap = await adminDb.collection(`users/${uid}/trainingBlocks`).where("status", "==", "active").limit(1).get();
  if (blocksSnap.empty) {
    await sendMessage(chatId, "You don't have an active training block. Create one in the app first.");
    return NextResponse.json({ status: "ok" });
  }
  const activeBlock = { id: blocksSnap.docs[0].id, ...blocksSnap.docs[0].data() } as TrainingBlock;

  const weeksSnap = await adminDb.collection(`users/${uid}/trainingBlocks/${activeBlock.id}/trainingWeeks`).orderBy("startDate", "asc").get();
  const weeks: TrainingWeek[] = await Promise.all(weeksSnap.docs.map(async (weekDoc) => {
    const sessionsSnap = await adminDb.collection(`users/${uid}/trainingBlocks/${activeBlock.id}/trainingWeeks/${weekDoc.id}/sessions`).get();
    const weekData = weekDoc.data() as Omit<TrainingWeek, "id" | "sessions">;
    const sessions: Session[] = sessionsSnap.docs
      .map(s => ({ id: s.id, ...s.data() } as Session))
      .sort((a, b) => getDayOffset(weekData.startDate, a.day) - getDayOffset(weekData.startDate, b.day));
    return { id: weekDoc.id, ...weekData, sessions };
  }));

  const historySnap = await adminDb.collection(`users/${uid}/coachSessions`).orderBy("appliedAt", "desc").limit(10).get();
  const coachHistory = historySnap.docs.map(d => ({ id: d.id, ...d.data() } as CoachSessionLog));

  const completedSnap = await adminDb.collection(`users/${uid}/trainingBlocks`).where("status", "==", "completed").get();
  const completedBlocks = completedSnap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingBlock));
  const progressContext = formatProgressContext(completedBlocks, coachHistory);

  const conversation: ConversationMessage[] = userData.telegramConversation ?? [];
  const updatedConversation: ConversationMessage[] = [...conversation, { role: "user", content: text }];

  const aiResponse = await callAdaptPlan(updatedConversation, weeks, coachHistory, progressContext);

  const finalConversation: ConversationMessage[] = [
    ...updatedConversation,
    { role: "coach" as const, content: aiResponse.summary, changes: aiResponse.changes },
  ].slice(-20);

  if (aiResponse.changes.length > 0) {
    const changesList = formatChanges(aiResponse.changes, weeks);
    await adminDb.doc(`users/${uid}`).update({
      telegramConversation: finalConversation,
      pendingTelegramChanges: {
        changes: aiResponse.changes,
        firstMessage: text,
        summary: aiResponse.summary,
        blockId: activeBlock.id,
      },
    });
    await sendMessage(chatId, `${aiResponse.summary}\n\n${changesList}\n\nReply YES to apply or NO to cancel.`);
  } else {
    // No changes — clear any pending and continue conversationally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = { telegramConversation: finalConversation };
    if (pending) update.pendingTelegramChanges = FieldValue.delete();
    await adminDb.doc(`users/${uid}`).update(update);
    await sendMessage(chatId, aiResponse.summary);
  }

  return NextResponse.json({ status: "ok" });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function describeSession(category: string | null, prescription: Record<string, unknown> | null): string {
  if (!category || category === "Rest") return "Rest";
  if (category === "Run") {
    const type = (prescription?.type as string) ?? "run";
    const km = prescription?.distanceKm ? ` ${prescription.distanceKm}km` : "";
    return `${type} run${km}`;
  }
  if (category === "Strength") {
    const focus = prescription?.focus as string;
    return focus ? `${focus} strength` : "Strength";
  }
  return category;
}

function formatChanges(changes: SessionChange[], weeks: TrainingWeek[]): string {
  return changes.map(change => {
    const original = weeks.flatMap(w => w.sessions).find(s => s.id === change.sessionId);
    const from = describeSession(original?.category ?? null, original?.prescription as Record<string, unknown> ?? null);
    const to = describeSession(change.category, change.prescription as Record<string, unknown>);
    return `• ${change.day}: ${from} → ${to}`;
  }).join("\n");
}

function getDayOffset(weekStartDate: string, day: string): number {
  const start = new Date(weekStartDate + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (DAY_NAMES[d.getDay()] === day) return i;
  }
  return 0;
}

function getSessionDate(weekStartDate: string, day: string): Date {
  const start = new Date(weekStartDate + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (DAY_NAMES[d.getDay()] === day) return d;
  }
  return start;
}

async function applyPendingChanges(uid: string, pending: {
  changes: SessionChange[];
  firstMessage: string;
  summary: string;
  blockId: string;
}) {
  const batch = adminDb.batch();

  const logChanges: CoachSessionChange[] = await Promise.all(pending.changes.map(async (change) => {
    const ref = adminDb.doc(`users/${uid}/trainingBlocks/${pending.blockId}/trainingWeeks/${change.weekId}/sessions/${change.sessionId}`);
    const snap = await ref.get();
    const original = snap.data() as Session | undefined;
    return {
      weekId: change.weekId, sessionId: change.sessionId, day: change.day,
      fromCategory: original?.category ?? null,
      fromPrescription: original?.prescription ?? {},
      toCategory: change.category,
      toPrescription: change.prescription,
    };
  }));

  for (const change of pending.changes) {
    const ref = adminDb.doc(`users/${uid}/trainingBlocks/${pending.blockId}/trainingWeeks/${change.weekId}/sessions/${change.sessionId}`);
    batch.update(ref, { category: change.category, prescription: change.prescription, manuallyModified: true });
  }

  const coachRef = adminDb.collection(`users/${uid}/coachSessions`).doc();
  batch.set(coachRef, {
    appliedAt: FieldValue.serverTimestamp(),
    firstMessage: pending.firstMessage,
    summary: pending.summary,
    changesCount: pending.changes.length,
    changes: logChanges,
  });

  await batch.commit();
}

async function callAdaptPlan(
  conversation: ConversationMessage[],
  weeks: TrainingWeek[],
  coachHistory: CoachSessionLog[],
  progressContext: string,
): Promise<{ summary: string; changes: SessionChange[] }> {
  const today = new Date(new Date().toISOString().split("T")[0]);

  const weeksContext = weeks
    .map((week) => ({
      weekId: week.id,
      startDate: week.startDate,
      endDate: week.endDate,
      sessions: week.sessions
        .filter((s) => !s.completed && getSessionDate(week.startDate, s.day) >= today)
        .map((s) => ({
          sessionId: s.id, day: s.day, category: s.category,
          prescription: s.prescription, manuallyModified: s.manuallyModified ?? false,
        })),
    }))
    .filter((w) => w.sessions.length > 0);

  const conversationHistory = conversation.map((m) => {
    if (m.role === "user") return `Athlete: ${m.content}`;
    let t = `Coach: ${m.content}`;
    if (m.changes?.length) t += `\nProposed:\n${m.changes.map((c) => `  - ${c.day}: ${c.category}`).join("\n")}`;
    return t;
  }).join("\n\n");

  const historyContext = coachHistory.length > 0
    ? `Coaching history:\n${coachHistory.map((s) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const date = new Date((s.appliedAt as any).seconds * 1000).toISOString().split("T")[0];
        return `- ${date}: "${s.firstMessage}" → ${s.changesCount} changed`;
      }).join("\n")}\n\n`
    : "";

  const progressCtx = progressContext ? `${progressContext}\n\n` : "";

  const prompt = `You are an adaptive running and fitness coach. This conversation is via Telegram — keep replies concise (2 sentences max).

${progressCtx}${historyContext}Conversation:
${conversationHistory}

Training sessions available to modify:
${JSON.stringify(weeksContext, null, 2)}

Rules:
- IMPORTANT: Only propose changes if the athlete explicitly asks to modify, skip, swap, or adjust a session. For conversational messages (check-ins, logging a completed run, general chat, questions), return an empty changes array and just reply conversationally.
- Only modify uncompleted future sessions
- category: "Run" | "Strength" | "WOD" | "Rest" exactly
- For Run: type, distanceKm, targetPace, guidance
- For Strength: focus, goal, durationMin, guidance, sections (warmup/main/accessory arrays with exercises)
- For WOD: format, focus, durationCapMin, guidance, sections.main with stations array
- For Rest: { guidance, recoveryType: "full_rest" }
- Avoid changing manuallyModified:true sessions unless explicitly asked
- Keep summary to 2 sentences

IMPORTANT: Respond with valid JSON only.

{
  "summary": "2-sentence coach reply",
  "changes": [{ "weekId": "...", "sessionId": "...", "day": "...", "category": "...", "prescription": {} }]
}`;

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!cleaned.startsWith("{")) return { summary: cleaned, changes: [] };
    const json = JSON.parse(cleaned);
    // Strip any code blocks Gemini may have embedded in the summary
    const summary = (json.summary ?? "").replace(/```[\s\S]*?```/g, "").trim();
    return { summary, changes: json.changes ?? [] };
  } catch (err) {
    console.error("Telegram AI error:", err);
    return { summary: "Sorry, I ran into an issue. Try again in a moment.", changes: [] };
  }
}
