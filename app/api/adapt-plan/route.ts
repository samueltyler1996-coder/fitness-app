import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { messages, currentChanges, weeks, coachHistory, insights } = await req.json();

  const today = new Date(new Date().toISOString().split("T")[0]);
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function getSessionDate(weekStartDate: string, day: string): Date {
    const start = new Date(weekStartDate);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (DAY_NAMES[d.getDay()] === day) return d;
    }
    return start;
  }

  const weeksContext = weeks
    .map((week: any) => ({
      weekId: week.id,
      startDate: week.startDate,
      endDate: week.endDate,
      sessions: week.sessions
        .filter((s: any) => !s.completed && getSessionDate(week.startDate, s.day) >= today)
        .map((s: any) => ({
          sessionId: s.id,
          day: s.day,
          category: s.category,
          prescription: s.prescription,
          manuallyModified: s.manuallyModified ?? false,
        })),
    }))
    .filter((week: any) => week.sessions.length > 0);

  const conversationHistory = messages
    .map((m: any) => {
      if (m.role === "user") return `Athlete: ${m.content}`;
      if (m.role === "coach") {
        let text = `Coach: ${m.content}`;
        if (m.changes?.length > 0) {
          const changeLines = m.changes.map((c: any) => {
            const rx = c.prescription && Object.keys(c.prescription).length > 0
              ? ` — ${JSON.stringify(c.prescription)}`
              : "";
            return `  - ${c.day}: ${c.category}${rx}`;
          }).join("\n");
          text += `\nProposed changes:\n${changeLines}`;
        }
        return text;
      }
      return "";
    })
    .join("\n\n");

  const historyContext = coachHistory?.length > 0
    ? `Coaching history (use for trend awareness — patterns of injury, illness, or fatigue are important signals):\n${coachHistory.map((s: any) => {
        const date = new Date(s.appliedAt.seconds * 1000).toISOString().split("T")[0];
        return `- ${date}: "${s.firstMessage}" → ${s.changesCount} session(s) changed`;
      }).join("\n")}\n\n`
    : "";

  const insightsContext = insights?.length > 0
    ? `Athlete adherence patterns (from recent training history — use these to inform your recommendations):\n${insights.map((s: any) => {
        const prefix = s.type === "warning" ? "⚠" : s.type === "positive" ? "✓" : "ℹ";
        return `- ${prefix} ${s.message}`;
      }).join("\n")}\n\n`
    : "";

  const prompt = `You are an adaptive running and fitness coach having a conversation with an athlete about adjusting their training plan.

${historyContext}${insightsContext}Here is the conversation so far:

${conversationHistory}

${currentChanges?.length > 0
    ? `Your current proposed changes are:\n${JSON.stringify(currentChanges, null, 2)}\n\nRefine these based on the athlete's latest message.`
    : "This is the start of the conversation. Propose changes based on the athlete's message."
  }

Training sessions available to modify (use exact weekId and sessionId):
${JSON.stringify(weeksContext, null, 2)}

Rules:
- Only modify sessions that have not been completed (completed: false)
- category must be exactly "Run", "Strength", "WOD", or "Rest"
- For Run: include type ("easy"|"tempo"|"long"|"intervals"), distanceKm, targetPace, guidance. For intervals also include intervals array.
- For Strength: include focus ("upper"|"lower"|"full"|"pull"|"push"|"core"), goal, durationMin, guidance, and sections with warmup/main/accessory arrays. Main exercises must have name, sets, reps, load.
- For WOD: include format ("for_time"|"amrap"|"emom"|"intervals"|"stations"), focus ("hyrox_conditioning"|"hiit"|"threshold"|"mixed_engine"), durationCapMin, guidance, and sections.main with stations array. Each station has movement, distance or reps or calories, and optionally load.
- For Rest: prescription is { "guidance": "...", "recoveryType": "full_rest" }
- For illness: reduce or cancel sessions this week only
- For injury: modify affected sessions across multiple weeks depending on severity
- Be proportionate — a sore ankle doesn't cancel upper body strength
- Keep the overall training intent where possible
- Sessions marked manuallyModified:true were hand-edited by the user — avoid changing them unless the athlete explicitly asks, and mention it in your summary if you do

IMPORTANT: Your entire response must be valid JSON and nothing else. Do not write any text before or after the JSON object. Start your response with { and end with }.

{
  "summary": "Your conversational response to the athlete (2-3 sentences max, direct coach voice). Put your full reply here inside this field.",
  "changes": [
    {
      "weekId": "exact weekId",
      "sessionId": "exact sessionId",
      "day": "Monday",
      "category": "Rest",
      "prescription": {}
    }
  ]
}`;

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    // If Gemini returned plain text instead of JSON, wrap it gracefully
    if (!cleaned.startsWith("{")) {
      return NextResponse.json({ summary: cleaned, changes: [] });
    }

    const json = JSON.parse(cleaned);
    return NextResponse.json(json);
  } catch (error) {
    console.error("Adapt plan error:", error);
    return NextResponse.json({ error: "Failed to adapt plan", detail: String(error) }, { status: 500 });
  }
}
