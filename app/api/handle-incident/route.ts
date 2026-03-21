import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const JS_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getSessionDate(weekStartDate: string, day: string): Date {
  const start = new Date(weekStartDate + "T12:00:00");
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    if (JS_DAY_NAMES[d.getDay()] === day) return d;
  }
  return start;
}

function findCurrentWeekIndex(weeks: any[], today: Date): number {
  const todayStr = today.toISOString().split("T")[0];
  return weeks.findIndex((w: any) => w.startDate <= todayStr && w.endDate >= todayStr);
}

function isFutureOrToday(weekStartDate: string, session: any, today: Date): boolean {
  if (session.completed) return false;
  return getSessionDate(weekStartDate, session.day) >= today;
}

// ─── Illness rules ────────────────────────────────────────────────────────────
// mild    → downgrade intense sessions; cancel strength/WOD
// moderate → cancel all remaining training this week
// severe  → cancel this week + reduce next week

function illnessChanges(weeks: any[], severity: string, today: Date): any[] {
  const changes: any[] = [];

  // "This week" = 7 days from today, not the calendar week boundary
  const windowEnd = new Date(today);
  windowEnd.setDate(today.getDate() + 6);

  for (const week of weeks) {
    for (const s of week.sessions) {
      if (s.completed || !s.category || s.category === "Rest") continue;
      const sessionDate = getSessionDate(week.startDate, s.day);
      if (sessionDate < today || sessionDate > windowEnd) continue;

      const p = s.prescription as any;

      if (severity === "mild") {
        if (s.category === "Run" && (p?.type === "intervals" || p?.type === "tempo")) {
          changes.push({
            weekId: week.id, sessionId: s.id, day: s.day,
            category: "Run",
            prescription: {
              type: "easy",
              distanceKm: Math.max(3, Math.round((p?.distanceKm ?? 5) * 0.6)),
              guidance: "Easy jog only — you're not well. Stop if breathing feels off.",
            },
          });
        } else if (s.category === "WOD" || s.category === "Strength") {
          changes.push({
            weekId: week.id, sessionId: s.id, day: s.day,
            category: "Rest",
            prescription: { recoveryType: "full_rest", guidance: "Rest today. Your immune system needs the energy more than your muscles do." },
          });
        }
        // Easy/long runs: leave in place — athlete can assess
      } else {
        // Moderate/severe: cancel all training in the 7-day window
        changes.push({
          weekId: week.id, sessionId: s.id, day: s.day,
          category: "Rest",
          prescription: { recoveryType: "full_rest", guidance: "Full rest. Beat the illness first — training can wait." },
        });
      }
    }
  }

  // Severe: carry reduced load into days 7–13 (the recovery week)
  if (severity === "severe") {
    const recoveryStart = new Date(today);
    recoveryStart.setDate(today.getDate() + 7);
    const recoveryEnd = new Date(today);
    recoveryEnd.setDate(today.getDate() + 13);

    for (const week of weeks) {
      for (const s of week.sessions) {
        if (s.completed || !s.category || s.category === "Rest") continue;
        const sessionDate = getSessionDate(week.startDate, s.day);
        if (sessionDate < recoveryStart || sessionDate > recoveryEnd) continue;

        const p = s.prescription as any;
        if (s.category === "Run" && (p?.type === "intervals" || p?.type === "tempo")) {
          changes.push({
            weekId: week.id, sessionId: s.id, day: s.day,
            category: "Run",
            prescription: {
              type: "easy",
              distanceKm: Math.max(3, Math.round((p?.distanceKm ?? 6) * 0.65)),
              guidance: "Post-illness return. Conversational pace only — no targets.",
            },
          });
        } else if (s.category === "WOD") {
          changes.push({
            weekId: week.id, sessionId: s.id, day: s.day,
            category: "Rest",
            prescription: { recoveryType: "mobility", guidance: "Light mobility as you return. No high-intensity until you're fully back." },
          });
        }
      }
    }
  }

  return changes;
}

// ─── Injury rules ─────────────────────────────────────────────────────────────
// mild    → downgrade affected modality this week only
// moderate → cancel affected modality for 2 weeks
// severe  → cancel affected modality for all remaining weeks

function injuryChanges(weeks: any[], severity: string, affectedModality: string, today: Date): any[] {
  const changes: any[] = [];
  const idx = findCurrentWeekIndex(weeks, today);
  if (idx === -1) return changes;

  const weeksToModify = severity === "mild" ? 1 : severity === "moderate" ? 2 : weeks.length;

  for (let i = 0; i < weeksToModify && idx + i < weeks.length; i++) {
    const week = weeks[idx + i];

    for (const s of week.sessions) {
      if (s.completed) continue;
      if (i === 0 && !isFutureOrToday(week.startDate, s, today)) continue;
      if (s.category !== affectedModality) continue;

      const p = s.prescription as any;

      if (affectedModality === "Run") {
        if (severity === "mild" && p?.type !== "easy") {
          // Downgrade to easy run
          changes.push({
            weekId: week.id, sessionId: s.id, day: s.day,
            category: "Run",
            prescription: {
              type: "easy",
              distanceKm: Math.max(3, Math.round((p?.distanceKm ?? 5) * 0.6)),
              guidance: "Easy run only due to injury. Zero pain tolerance — walk sections or stop if it flares.",
            },
          });
        } else {
          changes.push({
            weekId: week.id, sessionId: s.id, day: s.day,
            category: "Rest",
            prescription: {
              recoveryType: severity === "mild" ? "mobility" : "full_rest",
              guidance: severity === "mild"
                ? "No running. Gentle mobility for the affected area only."
                : "Full rest from running. Let the injury settle before returning.",
            },
          });
        }
      } else if (affectedModality === "Strength") {
        changes.push({
          weekId: week.id, sessionId: s.id, day: s.day,
          category: "Rest",
          prescription: {
            recoveryType: severity === "mild" ? "mobility" : "full_rest",
            guidance: severity === "mild"
              ? "Light mobility only — avoid loading the affected area."
              : "Rest from strength training. Let the injury settle.",
          },
        });
      } else if (affectedModality === "WOD") {
        changes.push({
          weekId: week.id, sessionId: s.id, day: s.day,
          category: "Rest",
          prescription: {
            recoveryType: "mobility",
            guidance: "No high-intensity work due to injury. Gentle mobility instead.",
          },
        });
      }
    }
  }

  return changes;
}

// ─── Fatigue rules ────────────────────────────────────────────────────────────
// mild    → no changes (just acknowledge)
// moderate → downgrade intense sessions this week
// severe  → deload: downgrade runs, cancel WOD, reduce strength load

function fatigueChanges(weeks: any[], severity: string, today: Date): any[] {
  const changes: any[] = [];
  if (severity === "mild") return changes; // Acknowledge only

  const idx = findCurrentWeekIndex(weeks, today);
  if (idx === -1) return changes;

  const thisWeek = weeks[idx];

  for (const s of thisWeek.sessions) {
    if (!isFutureOrToday(thisWeek.startDate, s, today)) continue;
    if (!s.category || s.category === "Rest") continue;
    const p = s.prescription as any;

    if (s.category === "Run") {
      if (p?.type === "intervals" || (p?.type === "tempo" && severity !== "mild")) {
        changes.push({
          weekId: thisWeek.id, sessionId: s.id, day: s.day,
          category: "Run",
          prescription: {
            type: "easy",
            distanceKm: Math.max(3, Math.round((p?.distanceKm ?? 5) * 0.7)),
            guidance: "Deload run — conversational pace only. This is active recovery, not training.",
          },
        });
      }
    } else if (s.category === "WOD" && severity === "severe") {
      changes.push({
        weekId: thisWeek.id, sessionId: s.id, day: s.day,
        category: "Rest",
        prescription: { recoveryType: "mobility", guidance: "Rest from intensity. Your body is overreaching — back off now." },
      });
    } else if (s.category === "Strength" && severity === "severe") {
      // Keep strength but flag as deload
      changes.push({
        weekId: thisWeek.id, sessionId: s.id, day: s.day,
        category: "Strength",
        prescription: {
          ...p,
          guidance: "FATIGUE DELOAD: Work at 70% of normal. Leave 3 reps in the tank on every set. Cut the session short if needed.",
        },
      });
    }
  }

  return changes;
}

// ─── Missed session options ───────────────────────────────────────────────────
// Returns three options: continue as planned / move to tomorrow / drop it

function missedSessionOptions(weeks: any[], affectedDay: string, today: Date): any[] | null {
  const idx = findCurrentWeekIndex(weeks, today);
  if (idx === -1) return null;

  const week = weeks[idx];
  const session = week.sessions.find((s: any) => s.day === affectedDay);
  // No session found, or it was a rest day — nothing to act on
  if (!session || !session.category || session.category === "Rest") return null;

  const options: any[] = [];

  // Option 1: Continue as planned (no changes)
  options.push({
    id: "continue",
    label: "Continue as planned",
    description: "Move on and pick up from the next scheduled session",
    changes: [],
  });

  // Option 2: Move to tomorrow if tomorrow is a rest day and in the future
  const dayIdx = DAY_ORDER.indexOf(affectedDay);
  if (dayIdx >= 0) {
    const tomorrowName = DAY_ORDER[(dayIdx + 1) % 7];
    const tomorrowSession = week.sessions.find(
      (s: any) => s.day === tomorrowName && (s.category === "Rest" || !s.category) && !s.completed
    );
    const tomorrowDate = tomorrowSession ? getSessionDate(week.startDate, tomorrowName) : null;

    if (tomorrowSession && tomorrowDate && tomorrowDate >= today) {
      options.push({
        id: "move",
        label: `Move to ${tomorrowName}`,
        description: `Swap tomorrow's rest for the missed ${session.category ?? "session"}`,
        changes: [
          {
            weekId: week.id, sessionId: tomorrowSession.id, day: tomorrowName,
            category: session.category, prescription: session.prescription,
          },
          {
            weekId: week.id, sessionId: session.id, day: affectedDay,
            category: "Rest",
            prescription: { recoveryType: "full_rest", guidance: `Session rescheduled to ${tomorrowName}.` },
          },
        ],
      });
    }
  }

  // Option 3: Drop it
  options.push({
    id: "drop",
    label: "Drop it",
    description: "Mark it as skipped and continue with the rest of the plan",
    changes: [
      {
        weekId: week.id, sessionId: session.id, day: affectedDay,
        category: "Rest",
        prescription: { recoveryType: "full_rest", guidance: "Session skipped." },
      },
    ],
  });

  return options;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { message, weeks, coachHistory, priorContext, insights } = await req.json();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const historyCtx = coachHistory?.length > 0
    ? `Recent coaching history:\n${coachHistory.slice(0, 5).map((s: any) => {
        const date = new Date(s.appliedAt.seconds * 1000).toISOString().split("T")[0];
        return `- ${date}: "${s.firstMessage}" → ${s.changesCount} session(s) changed`;
      }).join("\n")}\n\n`
    : "";

  const priorCtxStr = priorContext
    ? `Follow-up context — athlete previously stated: type="${priorContext.type}"${priorContext.severity ? `, severity="${priorContext.severity}"` : ""}${priorContext.affectedModality ? `, affected="${priorContext.affectedModality}"` : ""}${priorContext.affectedDay ? `, day="${priorContext.affectedDay}"` : ""}. Use this to fill any gaps.\n\n`
    : "";

  const insightsCtx = insights?.length > 0
    ? `Athlete adherence patterns (recent history — use for context when responding):\n${insights.map((s: any) => {
        const prefix = s.type === "warning" ? "⚠" : s.type === "positive" ? "✓" : "ℹ";
        return `- ${prefix} ${s.message}`;
      }).join("\n")}\n\n`
    : "";

  const prompt = `You are an adaptive fitness coach. Classify an athlete's message about a problem with their training.

${historyCtx}${insightsCtx}${priorCtxStr}Athlete message: "${message}"
Today: ${today.toISOString().split("T")[0]}

Respond with valid JSON only. No text before or after the JSON.

Classification types:
- "illness": sick, unwell, cold, flu, virus, not feeling well
- "injury": physical injury, pain, something hurts, tweaked/sprained/strained
- "missed_session": athlete missed or skipped a specific past session
- "scheduling_conflict": cannot make an upcoming session due to schedule
- "fatigue": severe cumulative tiredness, burnout, overtraining
- "general": anything else — return this to fall back to normal coaching

Severity inference:
- mild: "a bit", "slightly", "not too bad", "manageable", "mild"
- moderate: "fairly", "quite", "properly ill", "can't train"
- severe: "really bad", "can't function", "completely out", "bed rest"

ILLNESS — always ask severity before acting. Mild/moderate/severe lead to very different training changes (downgrade vs cancel week vs cancel two weeks). If the message gives no clear severity signal, set needsClarification: true and ask. Chips: ["Just a mild cold", "Properly ill, need rest", "Really bad, need full rest"]

INJURY — set needsClarification: true only if you genuinely cannot determine which body part or modality is affected. Otherwise infer and act. Default severity to "moderate" when unsure.

For all other types (fatigue, missed_session, scheduling_conflict): infer aggressively — do not over-ask. Default severity to "moderate" when unsure.

Affected modality for injuries (infer from body part):
- "Run": knee, ankle, foot, calf, shin, hamstring, IT band, hip
- "Strength": shoulder, elbow, wrist, back, neck (when lifting is the issue)
- "WOD": general or multiple joints affecting conditioning

{
  "type": "illness|injury|missed_session|scheduling_conflict|fatigue|general",
  "severity": null | "mild" | "moderate" | "severe",
  "affectedModality": null | "Run" | "Strength" | "WOD",
  "affectedDay": null | "Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday",
  "needsClarification": false,
  "coachResponse": "1-2 sentence direct coach voice. Acknowledge what they said. Tell them what you're doing (or ask your one question).",
  "clarificationChips": null | ["Short option 1", "Short option 2", "Short option 3"]
}`;

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    if (!cleaned.startsWith("{")) {
      return NextResponse.json({ incidentType: "general", summary: null, changes: [], options: null });
    }

    const c = JSON.parse(cleaned);
    const { type, severity, affectedModality, affectedDay, needsClarification, coachResponse, clarificationChips } = c;

    // Fall through to adapt-plan for general queries
    if (type === "general") {
      return NextResponse.json({ incidentType: "general", summary: null, changes: [], options: null });
    }

    // Ask for clarification if needed
    if (needsClarification) {
      return NextResponse.json({
        incidentType: type,
        severity: severity ?? null,
        affectedModality: affectedModality ?? null,
        summary: coachResponse,
        changes: [],
        followUpChips: clarificationChips ?? null,
        options: null,
        priorContext: { type, severity: severity ?? null, affectedModality: affectedModality ?? null, affectedDay: affectedDay ?? null },
      });
    }

    // Apply deterministic rules
    let changes: any[] = [];
    let options: any[] | null = null;

    switch (type) {
      case "illness":
        changes = illnessChanges(weeks, severity ?? "moderate", today);
        break;
      case "fatigue":
        changes = fatigueChanges(weeks, severity ?? "moderate", today);
        break;
      case "injury":
        if (affectedModality) changes = injuryChanges(weeks, severity ?? "moderate", affectedModality, today);
        break;
      case "missed_session":
      case "scheduling_conflict":
        if (affectedDay) options = missedSessionOptions(weeks, affectedDay, today);
        break;
    }

    // If missed/conflict but no actionable session found, the AI's ack is wrong — correct it
    let finalSummary = coachResponse;
    if ((type === "missed_session" || type === "scheduling_conflict") && affectedDay && options === null) {
      // Distinguish: future session vs rest/no session
      const wIdx = findCurrentWeekIndex(weeks, today);
      let isFutureSession = false;
      if (wIdx !== -1) {
        // Check current week — session exists but is in the future
        const curSession = weeks[wIdx].sessions.find((s: any) => s.day === affectedDay);
        if (curSession && curSession.category && curSession.category !== "Rest") {
          isFutureSession = getSessionDate(weeks[wIdx].startDate, affectedDay) > today;
        }
        // Check next week — day exists there (user said "next X")
        if (!isFutureSession && wIdx + 1 < weeks.length) {
          const nextSession = weeks[wIdx + 1].sessions.find((s: any) => s.day === affectedDay);
          if (nextSession && nextSession.category && nextSession.category !== "Rest") {
            isFutureSession = true;
          }
        }
      }
      finalSummary = isFutureSession
        ? `Your ${affectedDay} session hasn't happened yet — you can't have missed a future session. Did you mean a different day?`
        : `There's no training session on ${affectedDay} — it looks like that's a rest day. Nothing to adjust.`;
    }

    return NextResponse.json({
      incidentType: type,
      severity: severity ?? null,
      affectedModality: affectedModality ?? null,
      summary: finalSummary,
      changes,
      followUpChips: null,
      options,
      priorContext: null,
    });

  } catch (error) {
    console.error("Handle incident error:", error);
    return NextResponse.json({ error: "Failed to handle incident", detail: String(error) }, { status: 500 });
  }
}
