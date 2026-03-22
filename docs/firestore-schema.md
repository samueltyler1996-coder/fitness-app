# Firestore Schema & Hierarchy

## Collection Hierarchy

```
users/
  {uid}/                              ← document
    currentGoal: string | null
    eventDate: string | null          ← YYYY-MM-DD
    uid: string
    email: string
    displayName: string | null
    createdAt: Timestamp

    trainingBlocks/                   ← sub-collection
      {blockId}/                      ← document
        name: string
        primaryGoal: string
        secondaryGoal: null           ← always null (reserved)
        status: "active"|"completed"|"queued"
        startDate: string             ← YYYY-MM-DD
        endDate: string               ← YYYY-MM-DD
        createdAt: Timestamp
        endedAt?: Timestamp           ← set when status → "completed"
        summary?: {                   ← set when status → "completed"
          completionRate: number      ← 0–1
          completedSessions: number
          totalSessions: number
          runAdherence?: number       ← 0–1, only if block had runs
          strengthAdherence?: number  ← 0–1, only if block had strength
          wodAdherence?: number       ← 0–1, only if block had WODs
          incidentCount?: number
          completedAt: string         ← YYYY-MM-DD
        }

        trainingWeeks/                ← sub-collection
          {weekId}/                   ← document
            startDate: string         ← YYYY-MM-DD
            endDate: string           ← YYYY-MM-DD
            createdAt: Timestamp

            sessions/                 ← sub-collection
              {sessionId}/            ← document
                day: Day              ← "Monday"..."Sunday"
                category: Category    ← "Run"|"Strength"|"WOD"|"Rest"|null
                completed: boolean
                prescription: object  ← shape depends on category (see below)
                actual: {
                  distanceKm?: number | null
                  pace?: string | null
                  effort?: "easy"|"moderate"|"hard" | null
                  notes?: string | null
                }
                aiGenerated: boolean
                manuallyModified: boolean
                createdAt: Timestamp

    coachSessions/                    ← sub-collection (NOT under trainingBlocks)
      {coachSessionId}/               ← document
        appliedAt: Timestamp
        firstMessage: string
        summary: string
        changesCount: number
        changes: Array<{
          weekId: string
          sessionId: string
          day: string
          fromCategory: Category
          fromPrescription: object
          toCategory: Category
          toPrescription: object
        }>
```

---

## Prescription Shapes by Category

The `prescription` field is an untyped Firestore object. Its shape is implicitly determined by the session's `category`. There is no discriminator field inside the prescription object itself.

### category = "Run"
```json
{
  "type": "easy" | "tempo" | "long" | "intervals",
  "distanceKm": 8,
  "targetPace": "5:30/km",
  "guidance": "Comfortable aerobic effort",
  "intervals": [                        ← only when type="intervals"
    {
      "reps": 6,
      "distanceM": 400,
      "targetPace": "4:00/km",
      "restSec": 90,
      "notes": "Hard effort"
    }
  ]
}
```

### category = "Strength"
```json
{
  "focus": "lower" | "upper" | "full" | "pull" | "push" | "core",
  "goal": "strength" | "hypertrophy" | "power" | "maintenance",
  "durationMin": 55,
  "guidance": "Heavy lower body day",
  "sections": {
    "warmup": [
      { "name": "Glute bridges", "sets": 2, "reps": "15", "notes": "..." }
    ],
    "main": [
      {
        "name": "Back Squat",
        "type": "strength",
        "sets": 4,
        "reps": "5",
        "load": "80% 1RM",
        "restSec": 180,
        "tempo": "3-1-1-0",
        "notes": "..."
      }
    ],
    "accessory": [ ... ],               ← optional
    "finisher": [
      {
        "name": "Core circuit",
        "type": "finisher",
        "rounds": 3,
        "items": ["15 GHD sit-ups", "30s plank"]
      }
    ],
    "cooldown": [ ... ]                 ← optional
  }
}
```

### category = "WOD"
```json
{
  "format": "for_time" | "amrap" | "emom" | "intervals" | "stations",
  "focus": "hyrox_conditioning" | "hiit" | "threshold" | "mixed_engine",
  "durationCapMin": 40,
  "guidance": "Hyrox simulation",
  "sections": {
    "warmup": [
      { "name": "Row 500m easy", "duration": "5 min" }
    ],
    "main": {
      "wodName": "Hyrox Half Sim",
      "structure": "4 rounds: 1km Run + Station",
      "rounds": 4,
      "workSec": null,
      "restSec": null,
      "targetEffort": "85% threshold",
      "rest": "None — continuous",
      "stations": [
        {
          "movement": "1km Run",
          "distance": null,
          "reps": null,
          "calories": null,
          "load": null,
          "notes": "Race pace"
        }
      ]
    },
    "cooldown": [ ... ]
  }
}
```

### category = "Rest"
```json
{
  "guidance": "Full rest day",
  "recoveryType": "full_rest" | "walk" | "mobility" | "stretching",
  "durationMin": null
}
```

### category = null (placeholder)
```json
{}
```
Empty object. Created for all 7 days when AI generation fails or for future weeks.

---

## Queries Used in the App

| Purpose | Query |
|---|---|
| Fetch all blocks | `collection(users/{uid}/trainingBlocks)` ordered by `startDate asc` |
| Fetch weeks for active block | `collection(…/trainingBlocks/{blockId}/trainingWeeks)` ordered by `startDate asc` |
| Fetch sessions for a week | `collection(…/trainingWeeks/{weekId}/sessions)` — no server-side ordering |
| Fetch coach history | `collection(users/{uid}/coachSessions)` ordered by `appliedAt desc`, limit 10 |
| Find active blocks (before completing) | `collection(…/trainingBlocks)` where `status == "active"` |

> **Session ordering:** Sessions within a week have no server-side ordering. They are sorted client-side by computing the calendar offset from `weekStartDate` to find the correct weekday.

---

## Constraints and Business Rules (enforced in app code)

1. **One active block at a time.** `handleCreateBlock` queries for `status == "active"` and marks all results as `"completed"` before writing the new block.
2. **One queued block at a time.** `handleQueueBlock` checks `queuedBlock !== null` and returns early if one already exists.
3. **Queued blocks have no sessions.** Only a stub document is created (name, dates, status). Sessions are generated only when the block is activated.
4. **Session edits via coach are atomic.** `applyChanges` uses a `writeBatch` to update all sessions and write the coach session log in a single transaction.
5. **Only uncompleted future sessions are sent to AI.** `adapt-plan` filters sessions to `!completed && date >= today` before including in the AI prompt.

---

## Known Schema Gaps / Inconsistencies

1. **`prescription` has no discriminator field.** The shape is implicit from `category`. Type narrowing in TypeScript requires casting.
2. **`secondaryGoal` is always `null`.** It's stored in every block document but unused. Intended for future multi-goal blocks.
3. **`coachSessions` is not scoped to a block.** Cross-block coach history is mixed into a single flat collection per user.
4. **`Actual.rawText` is typed but never written.** The TypeScript interface includes `rawText` but `logActual` and `parse-actual` never populate it.
5. **`RunInterval.durationSec` is typed but never used.** Neither the generate-plan prompt nor any UI rendering references it.
6. **`createdAt` exists on blocks, weeks, and sessions in Firestore but is not in any TypeScript interface.**
7. **`endedAt` on completed blocks is not in the TypeScript interface.**
