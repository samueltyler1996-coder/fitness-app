import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { messages, currentChanges, weeks } = await req.json();

  const weeksContext = weeks.map((week: any) => ({
    weekId: week.id,
    startDate: week.startDate,
    endDate: week.endDate,
    sessions: week.sessions.map((s: any) => ({
      sessionId: s.id,
      day: s.day,
      category: s.category,
      completed: s.completed,
      prescription: s.prescription,
    })),
  }));

  const conversationHistory = messages
    .map((m: any) => {
      if (m.role === "user") return `Athlete: ${m.content}`;
      if (m.role === "coach") {
        let text = `Coach: ${m.content}`;
        if (m.changes?.length > 0) {
          text += `\n(Proposed changes: ${m.changes.map((c: any) => `${c.day} → ${c.category}`).join(", ")})`;
        }
        return text;
      }
      return "";
    })
    .join("\n\n");

  const prompt = `You are an adaptive running and fitness coach having a conversation with an athlete about adjusting their training plan.

Here is the conversation so far:

${conversationHistory}

${currentChanges?.length > 0
    ? `Your current proposed changes are:\n${JSON.stringify(currentChanges, null, 2)}\n\nRefine these based on the athlete's latest message.`
    : "This is the start of the conversation. Propose changes based on the athlete's message."
  }

Training sessions available to modify (use exact weekId and sessionId):
${JSON.stringify(weeksContext, null, 2)}

Rules:
- Only modify sessions that have not been completed (completed: false)
- category must be exactly "Run", "Strength", or "Rest"
- For Run sessions, type must be exactly one of: "easy", "tempo", "long", "intervals". Put extra detail in guidance
- For Strength sessions include: focus (short, e.g. "lower", "upper", "core"), guidance
- For Rest sessions prescription is {}
- For illness: reduce or cancel sessions this week only
- For injury: modify affected sessions across multiple weeks depending on severity
- Be proportionate — a sore ankle doesn't cancel upper body strength
- Keep the overall training intent where possible

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
