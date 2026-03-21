import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { goal, weekNumber, totalWeeks, startDate, endDate, currentSessions, previousWeekSessions, instruction } = await req.json();

  const weekPosition =
    weekNumber === totalWeeks ? "final/taper week — reduce volume, keep intensity, prepare for race"
    : weekNumber === totalWeeks - 1 ? "peak week — highest intensity of the block"
    : weekNumber % 4 === 0 ? "deload week — reduce volume by ~30%, maintain movement quality"
    : weekNumber <= 2 ? "base building week — focus on consistency and aerobic foundation"
    : "build week — progressive overload from previous week";

  const previousContext = previousWeekSessions?.length > 0
    ? `\nPrevious week's sessions (use for progressive overload — build on this):\n${JSON.stringify(
        previousWeekSessions.map((s: any) => ({ day: s.day, category: s.category, prescription: s.prescription })),
        null, 2
      )}\n`
    : "";

  const instructionContext = instruction?.trim()
    ? `\nAthlete's note: "${instruction.trim()}"\nHonour this where reasonable without breaking the training structure.\n`
    : "";

  const prompt = `You are a fitness coach regenerating a single week of training.

Goal: ${goal}
Week ${weekNumber} of ${totalWeeks} (${startDate} → ${endDate})
Week type: ${weekPosition}
${previousContext}${instructionContext}
Current sessions being replaced:
${JSON.stringify(currentSessions.map((s: any) => ({ day: s.day, category: s.category })), null, 2)}

Generate exactly 7 sessions, one per day Monday through Sunday.
Category must be "Run", "Strength", "WOD", or "Rest".

Use these prescription shapes exactly:

Run: { "type": "easy"|"tempo"|"long"|"intervals", "distanceKm": number, "targetPace": "mm:ss/km", "guidance": string, "intervals": [...] }
Strength: { "focus": "upper"|"lower"|"full"|"pull"|"push"|"core", "goal": "strength"|"hypertrophy"|"power"|"maintenance", "durationMin": number, "guidance": string, "sections": { "warmup": [...], "main": [{ "name", "sets", "reps", "load", "notes" }], "accessory": [...], "finisher": [...], "cooldown": [...] } }
WOD: { "format": "for_time"|"amrap"|"emom"|"intervals"|"stations", "focus": "hyrox_conditioning"|"hiit"|"threshold"|"mixed_engine", "durationCapMin": number, "guidance": string, "sections": { "warmup": [...], "main": { "wodName", "structure", "rounds", "targetEffort", "rest", "stations": [{ "movement", "distance", "reps", "calories", "load", "notes" }] }, "cooldown": [...] } }
Rest: { "guidance": string, "recoveryType": "full_rest"|"walk"|"mobility"|"stretching" }

Return ONLY valid JSON, no markdown:
{
  "summary": "One sentence describing this week's focus",
  "sessions": [
    { "day": "Monday", "category": "Rest", "prescription": { "guidance": "...", "recoveryType": "full_rest" } },
    { "day": "Tuesday", "category": "Run", "prescription": { ... } }
  ]
}`;

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const json = JSON.parse(cleaned);
    return NextResponse.json(json);
  } catch (error) {
    console.error("Regenerate week error:", error);
    return NextResponse.json({ error: "Failed to regenerate week", detail: String(error) }, { status: 500 });
  }
}
