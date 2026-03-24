import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "../../../lib/firebase-admin";
import {
  Session, SessionChange, RunPrescription, StrengthPrescription, WodPrescription,
} from "../../../lib/types";

const TAPER_FACTOR = 0.65; // reduce to 65% = 35% reduction

export async function POST(req: NextRequest) {
  const { uid, blockId, weekId } = await req.json();

  if (!uid || !blockId || !weekId) {
    return NextResponse.json({ error: "Missing uid, blockId, or weekId" }, { status: 400 });
  }

  const sessionsSnap = await adminDb
    .collection(`users/${uid}/trainingBlocks/${blockId}/trainingWeeks/${weekId}/sessions`)
    .get();

  const sessions: Session[] = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Session));

  const changes: SessionChange[] = [];

  for (const session of sessions) {
    // Skip manually modified sessions
    if (session.manuallyModified) continue;
    // Skip completed sessions
    if (session.completed) continue;

    const { category, prescription } = session;

    if (!category || category === "Rest") continue;

    if (category === "Run") {
      const runP = prescription as RunPrescription;
      const newDistanceKm = runP.distanceKm != null
        ? Math.round(runP.distanceKm * TAPER_FACTOR * 10) / 10
        : undefined;
      changes.push({
        weekId,
        sessionId: session.id,
        day: session.day,
        category: "Run",
        prescription: {
          ...runP,
          ...(newDistanceKm !== undefined ? { distanceKm: newDistanceKm } : {}),
          guidance: "Taper week — maintain intensity, reduce volume",
        },
      });
    } else if (category === "Strength") {
      const strengthP = prescription as StrengthPrescription;
      const newDurationMin = strengthP.durationMin != null
        ? Math.round(strengthP.durationMin * TAPER_FACTOR)
        : undefined;
      changes.push({
        weekId,
        sessionId: session.id,
        day: session.day,
        category: "Strength",
        prescription: {
          ...strengthP,
          ...(newDurationMin !== undefined ? { durationMin: newDurationMin } : {}),
          goal: "maintenance",
          guidance: "Taper week — activation only",
        },
      });
    } else if (category === "WOD") {
      const wodP = prescription as WodPrescription;
      const newDurationCapMin = wodP.durationCapMin != null
        ? Math.round(wodP.durationCapMin * TAPER_FACTOR)
        : undefined;
      changes.push({
        weekId,
        sessionId: session.id,
        day: session.day,
        category: "WOD",
        prescription: {
          ...wodP,
          ...(newDurationCapMin !== undefined ? { durationCapMin: newDurationCapMin } : {}),
          guidance: "Taper week — keep intensity, reduce cap",
        },
      });
    }
  }

  return NextResponse.json({ changes });
}
