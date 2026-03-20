import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { prescription, category, userText } = await req.json();

  const prompt = `You are a fitness tracking assistant. A user completed a training session and described how it went in their own words.

Session prescription:
- Category: ${category}
${prescription.type ? `- Type: ${prescription.type}` : ""}
${prescription.distanceKm ? `- Planned distance: ${prescription.distanceKm}km` : ""}
${prescription.targetPace ? `- Planned pace: ${prescription.targetPace}` : ""}
${prescription.focus ? `- Focus: ${prescription.focus}` : ""}

User's description: "${userText}"

Extract what they actually did and return ONLY valid JSON, no markdown:

{
  "summary": "A single sentence written to the user confirming what you will log. Be specific with numbers if mentioned. Example: 'Got it — I'll log 5.8km at 5:45/km with a hard effort.'",
  "actual": {
    "distanceKm": number or null,
    "pace": string or null,
    "effort": "easy" or "moderate" or "hard" or null,
    "notes": string or null
  }
}`;

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
    const json = JSON.parse(cleaned);
    return NextResponse.json(json);
  } catch (error) {
    console.error("Parse actual error:", error);
    return NextResponse.json({ error: "Failed to parse session", detail: String(error) }, { status: 500 });
  }
}
