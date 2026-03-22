import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { goal, eventDate, weeks, progressContext } = await req.json();

  const progressCtx = progressContext ? `\nAthlete history from previous blocks:\n${progressContext}\n\nUse this to calibrate volume, intensity, and session complexity. For example: if run adherence has been low, don't overload with runs; if strength is consistently missed, keep it simple; if pace is improving, you can push tempo targets slightly harder.\n` : "";

  const prompt = `You are an expert running and strength coach specialising in Hyrox, hybrid fitness, and endurance events. Generate a ${weeks}-week training plan for an athlete with the following profile:

- Primary goal: ${goal}
- Event/race date: ${eventDate || "not specified"}
- Block duration: ${weeks} weeks
${progressCtx}

Return ONLY a valid JSON object matching the exact structure below. No markdown, no code fences, no explanation.

Each week has exactly 7 sessions (Monday through Sunday). Category must be "Run", "Strength", "WOD", or "Rest".

PRESCRIPTION SHAPES — use the shape that matches the session category:

--- Run ---
{
  "type": "easy" | "tempo" | "long" | "intervals",
  "distanceKm": 8,
  "targetPace": "5:30/km",
  "guidance": "Comfortable aerobic effort, conversational pace",
  "intervals": [  // ONLY include for type="intervals"
    { "reps": 6, "distanceM": 400, "targetPace": "4:00/km", "restSec": 90, "notes": "Hard effort" }
  ]
}

--- Strength ---
{
  "focus": "lower",  // "upper" | "lower" | "full" | "pull" | "push" | "core"
  "goal": "strength",  // "strength" | "hypertrophy" | "power" | "maintenance"
  "durationMin": 55,
  "guidance": "Heavy lower body day focused on squat pattern",
  "sections": {
    "warmup": [
      { "name": "Glute bridges", "sets": 2, "reps": "15", "notes": "Activate glutes" },
      { "name": "Leg swings", "sets": 1, "reps": "10 each", "notes": "Hip mobility" }
    ],
    "main": [
      { "name": "Back Squat", "type": "strength", "sets": 4, "reps": "5", "load": "80% 1RM", "restSec": 180, "tempo": "3-1-1-0", "notes": "Control the descent" },
      { "name": "Romanian Deadlift", "type": "strength", "sets": 3, "reps": "8", "load": "70% 1RM", "restSec": 120 }
    ],
    "accessory": [
      { "name": "Bulgarian Split Squat", "type": "accessory", "sets": 3, "reps": "10 each", "load": "moderate", "restSec": 90 },
      { "name": "Nordic Curl", "type": "accessory", "sets": 3, "reps": "5", "notes": "Eccentric focus" }
    ],
    "finisher": [
      { "name": "Core circuit", "type": "finisher", "rounds": 3, "items": ["15 GHD sit-ups", "20 Russian twists", "30s plank"] }
    ],
    "cooldown": [
      { "name": "Hip flexor stretch", "notes": "2 min each side" },
      { "name": "Pigeon pose", "notes": "2 min each side" }
    ]
  }
}

--- WOD (Hyrox/HIIT/conditioning) ---
{
  "format": "for_time",  // "for_time" | "amrap" | "emom" | "intervals" | "stations"
  "focus": "hyrox_conditioning",  // "hyrox_conditioning" | "hiit" | "threshold" | "mixed_engine"
  "durationCapMin": 40,
  "guidance": "Hyrox simulation — maintain consistent pace across all stations",
  "sections": {
    "warmup": [
      { "name": "Row 500m easy", "duration": "5 min" },
      { "name": "Dynamic mobility", "duration": "3 min", "notes": "Hip circles, shoulder rolls, leg swings" }
    ],
    "main": {
      "wodName": "Hyrox Half Sim",
      "structure": "4 rounds: 1km Run + Station",
      "rounds": 4,
      "targetEffort": "85% threshold",
      "rest": "None — continuous",
      "stations": [
        { "movement": "1km Run", "notes": "Race pace effort" },
        { "movement": "Ski Erg", "distance": "500m", "notes": "Controlled pull" },
        { "movement": "Sled Push", "distance": "50m", "load": "80kg" },
        { "movement": "Burpee Broad Jumps", "distance": "20m" }
      ]
    },
    "cooldown": [
      { "name": "Easy walk", "duration": "5 min" },
      { "name": "Full body stretch", "duration": "5 min" }
    ]
  }
}

--- Rest ---
{
  "guidance": "Full rest day — sleep, nutrition, and recovery are training too",
  "recoveryType": "full_rest"  // "full_rest" | "walk" | "mobility" | "stretching"
}

OUTPUT STRUCTURE:
{
  "weeks": [
    {
      "weekNumber": 1,
      "sessions": [
        { "day": "Monday", "category": "Rest", "prescription": { "guidance": "...", "recoveryType": "full_rest" } },
        { "day": "Tuesday", "category": "Run", "prescription": { ... } },
        { "day": "Wednesday", "category": "Strength", "prescription": { ... } },
        { "day": "Thursday", "category": "Run", "prescription": { ... } },
        { "day": "Friday", "category": "WOD", "prescription": { ... } },
        { "day": "Saturday", "category": "Run", "prescription": { ... } },
        { "day": "Sunday", "category": "Rest", "prescription": { "guidance": "...", "recoveryType": "full_rest" } }
      ]
    }
  ]
}

PLANNING RULES:
- Every week must have exactly 7 sessions, one per day Monday through Sunday
- category must be exactly "Run", "Strength", "WOD", or "Rest" — no other values
- Typical week: 2–3 runs, 1–2 strength, 1 WOD, 1–2 rest
- Strength sections: warmup and main are required; accessory, finisher, cooldown are optional but include them if appropriate
- Strength main exercises must have real movement names, sets, reps, load guidance — not generic placeholders
- WOD stations must have real movements relevant to the goal (Hyrox/hybrid = ski erg, sled push, wall balls, rowing, burpees, sandbag lunges, farmer carries)
- Run intervals array is only included when type is "intervals"
- Build volume progressively across the ${weeks} weeks
- Include a deload in week 4 if ${weeks} >= 6
- Include a taper in the final week if an event date is provided
- All load values should be descriptive (e.g. "heavy", "moderate", "60–70% 1RM", "bodyweight") — not absolute kg unless clear from context`;

  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    const json = JSON.parse(cleaned);
    return NextResponse.json(json);
  } catch (error) {
    console.error("Gemini error:", error);
    return NextResponse.json({ error: "Failed to generate plan", detail: String(error) }, { status: 500 });
  }
}
