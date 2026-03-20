import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { goal, eventDate, weeks } = await req.json();

  const prompt = `You are an expert running and fitness coach. Generate a ${weeks}-week training plan for an athlete with the following profile:

- Primary goal: ${goal}
- Event/race date: ${eventDate || "not specified"}
- Block duration: ${weeks} weeks

Return ONLY a valid JSON object with this exact structure, no markdown, no explanation:

{
  "weeks": [
    {
      "weekNumber": 1,
      "sessions": [
        {
          "day": "Monday",
          "category": "Rest",
          "prescription": {}
        },
        {
          "day": "Tuesday",
          "category": "Run",
          "prescription": {
            "type": "easy",
            "distanceKm": 6,
            "targetPace": "5:30/km",
            "guidance": "Comfortable aerobic effort, conversational pace"
          }
        }
      ]
    }
  ]
}

Rules:
- Every week must have exactly 7 sessions, one per day Monday through Sunday
- category must be exactly "Run", "Strength", or "Rest"
- For Run sessions include: type (must be exactly "easy", "tempo", "long", or "intervals" — no other values), distanceKm (number), targetPace (string), guidance (string)
- For Strength sessions include: focus (string), guidance (string)
- For Rest sessions prescription is {}
- Build volume progressively across the ${weeks} weeks
- Include a taper in the final week if an event date is provided
- Typical week structure: 3-4 runs, 1-2 strength, 2 rest days`;

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Strip markdown code blocks if Gemini wraps the response
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    const json = JSON.parse(cleaned);
    return NextResponse.json(json);
  } catch (error) {
    console.error("Gemini error:", error);
    return NextResponse.json({ error: "Failed to generate plan", detail: String(error) }, { status: 500 });
  }
}
