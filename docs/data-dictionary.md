# Data Dictionary

All major entities, their fields, types, and notes on what is and isn't in the TypeScript interfaces.

---

## `users/{uid}` — User document

| Field | Type | Required | Notes |
|---|---|---|---|
| `uid` | `string` | yes | Firebase Auth UID. Written on first sign-in. |
| `email` | `string` | yes | From Google OAuth. |
| `displayName` | `string \| null` | yes | From Google OAuth. |
| `createdAt` | `Timestamp` | yes | `serverTimestamp()` on document creation. |
| `currentGoal` | `string \| null` | yes | User's freetext goal. e.g. "Hyrox", "Marathon". |
| `eventDate` | `string \| null` | yes | ISO date string `YYYY-MM-DD`. Race/event date. |

> **Not in TypeScript:** This document has no corresponding TS interface. `currentGoal` and `eventDate` are loaded into component state and accessed via `data.currentGoal` / `data.eventDate` directly.

---

## `users/{uid}/trainingBlocks/{blockId}` — Training Block

Typed as `TrainingBlock` in `lib/types.ts`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | derived | Firestore document ID. Injected client-side; not stored in document. |
| `name` | `string` | yes | e.g. "Marathon Block", "Maintenance Block". |
| `primaryGoal` | `string` | yes | Copy of user goal at time of creation. |
| `secondaryGoal` | `null` | yes | Always written as `null`. Reserved. **Not in TypeScript interface.** |
| `status` | `"active" \| "completed" \| "queued"` | yes | Only one block is `"active"` at a time. |
| `startDate` | `string` | yes | ISO date `YYYY-MM-DD`. |
| `endDate` | `string` | yes | ISO date `YYYY-MM-DD`. |
| `createdAt` | `Timestamp` | yes | `serverTimestamp()` on creation. **Not in TypeScript interface.** |
| `endedAt` | `Timestamp` | conditional | `serverTimestamp()` when status transitions to `"completed"`. Absent on active/queued blocks. **Not in TypeScript interface.** |
| `summary` | `BlockSummary` | conditional | Written when status → `"completed"`. Absent on active/queued blocks. See `BlockSummary` below. |

### `BlockSummary` (sub-object, not its own collection)

| Field | Type | Required | Notes |
|---|---|---|---|
| `completionRate` | `number` | yes | 0–1. Completed / total non-rest sessions. |
| `completedSessions` | `number` | yes | Count of sessions with `completed: true`. |
| `totalSessions` | `number` | yes | Count of non-rest sessions. |
| `runAdherence` | `number` | conditional | 0–1. Only present if block had Run sessions. |
| `strengthAdherence` | `number` | conditional | 0–1. Only present if block had Strength sessions. |
| `wodAdherence` | `number` | conditional | 0–1. Only present if block had WOD sessions. |
| `incidentCount` | `number` | conditional | Only present if incidents were tracked. |
| `completedAt` | `string` | yes | ISO date string. Snapshot date when block was completed. |

> **Computed by:** `computeBlockSummary()` in `lib/analytics.ts`. Written to Firestore once during `handleCreateBlock` when the previous active block is marked completed.

---

## `users/{uid}/trainingBlocks/{blockId}/trainingWeeks/{weekId}` — Training Week

Typed as `TrainingWeek` in `lib/types.ts` (without `sessions` array, which is assembled client-side).

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | derived | Firestore document ID. Injected client-side. |
| `startDate` | `string` | yes | ISO date `YYYY-MM-DD`. Week 1 starts on today; subsequent weeks start Monday. |
| `endDate` | `string` | yes | ISO date `YYYY-MM-DD`. Week 1 ends on Sunday; subsequent weeks end Sunday. |
| `createdAt` | `Timestamp` | yes | `serverTimestamp()` on creation. **Not in TypeScript interface.** |
| `sessions` | `Session[]` | derived | **Not stored in Firestore.** Assembled client-side from the `sessions` sub-collection. |

> **Week boundary behaviour:** Week 1 spans today → the coming Sunday (partial week is allowed). Weeks 2–6 are always Monday–Sunday.

---

## `users/{uid}/trainingBlocks/{blockId}/trainingWeeks/{weekId}/sessions/{sessionId}` — Session

Typed as `Session` in `lib/types.ts`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | derived | Firestore document ID. Injected client-side. |
| `day` | `Day` | yes | `"Monday" \| "Tuesday" \| "Wednesday" \| "Thursday" \| "Friday" \| "Saturday" \| "Sunday"` |
| `category` | `Category` | yes | `"Run" \| "Strength" \| "WOD" \| "Rest" \| null` |
| `completed` | `boolean` | yes | `false` on creation. Toggled by user. |
| `prescription` | `Prescription` | yes | Union type — shape depends on `category`. See prescription types below. |
| `actual` | `Actual` | yes | What the user actually did. `{}` on creation. |
| `aiGenerated` | `boolean` | yes | `true` for AI-generated sessions; `false` for manually created. |
| `manuallyModified` | `boolean` | yes | Set `true` when category or prescription is edited manually or via coach. |
| `createdAt` | `Timestamp` | yes | `serverTimestamp()` on creation. **Not in TypeScript interface.** |

---

## `Prescription` — union type

The `prescription` field on a session is one of four shapes. There is **no discriminator field** — the shape is determined by the `category` field on the session. TypeScript narrowing requires casting (`prescription as RunPrescription`, etc.).

### `RunPrescription` (when `category === "Run"`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `"easy" \| "tempo" \| "long" \| "intervals"` | yes | Run sub-type. |
| `distanceKm` | `number` | optional | Planned distance in km. |
| `targetPace` | `string` | optional | e.g. `"5:30/km"`. |
| `guidance` | `string` | optional | Freetext coaching note. |
| `intervals` | `RunInterval[]` | conditional | Only present when `type === "intervals"`. |

#### `RunInterval`

| Field | Type | Required |
|---|---|---|
| `reps` | `number` | yes |
| `distanceM` | `number` | optional |
| `durationSec` | `number` | optional |
| `targetPace` | `string` | optional |
| `restSec` | `number` | optional |
| `notes` | `string` | optional |

> **Inconsistency:** `durationSec` exists in the TypeScript type but is never referenced in the generate-plan prompt or rendered in the UI.

---

### `StrengthPrescription` (when `category === "Strength"`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `focus` | `"upper" \| "lower" \| "full" \| "pull" \| "push" \| "core"` | yes | |
| `goal` | `"strength" \| "hypertrophy" \| "power" \| "maintenance"` | optional | |
| `durationMin` | `number` | optional | Estimated session duration. |
| `guidance` | `string` | optional | Freetext coaching note. |
| `sections` | object | yes | Contains sub-arrays. |
| `sections.warmup` | `StrengthExercise[]` | optional | Required by generate-plan; optional per TypeScript. |
| `sections.main` | `StrengthExercise[]` | optional | Required by generate-plan; optional per TypeScript. |
| `sections.accessory` | `StrengthExercise[]` | optional | |
| `sections.finisher` | `StrengthExercise[]` | optional | |
| `sections.cooldown` | `StrengthExercise[]` | optional | |

#### `StrengthExercise`

| Field | Type | Required |
|---|---|---|
| `name` | `string` | yes |
| `type` | `"mobility" \| "activation" \| "strength" \| "accessory" \| "finisher"` | optional |
| `sets` | `number` | optional |
| `reps` | `string` | optional |
| `load` | `string` | optional |
| `restSec` | `number` | optional |
| `tempo` | `string` | optional |
| `notes` | `string` | optional |
| `rounds` | `number` | optional |
| `items` | `string[]` | optional |

> **Note:** `rounds` and `items` are for circuit/finisher entries (e.g. "3 rounds: 15 GHD, 30s plank"). They are on the same `StrengthExercise` interface as regular exercises, which is slightly awkward — a finisher entry uses `rounds`/`items` while a regular set uses `sets`/`reps`.

---

### `WodPrescription` (when `category === "WOD"`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `format` | `"for_time" \| "amrap" \| "emom" \| "intervals" \| "stations"` | yes | WOD structure. |
| `focus` | `"hyrox_conditioning" \| "hiit" \| "threshold" \| "mixed_engine"` | optional | |
| `durationCapMin` | `number` | optional | Time cap in minutes. |
| `guidance` | `string` | optional | Freetext coaching note. |
| `sections` | object | yes | |
| `sections.warmup` | `{ name: string; duration?: string; notes?: string }[]` | optional | |
| `sections.main` | object | yes | |
| `sections.main.wodName` | `string` | optional | e.g. `"Hyrox Half Sim"` |
| `sections.main.structure` | `string` | optional | e.g. `"4 rounds: 1km Run + Station"` |
| `sections.main.rounds` | `number` | optional | |
| `sections.main.workSec` | `number` | optional | For EMOM/interval formats. |
| `sections.main.restSec` | `number` | optional | |
| `sections.main.targetEffort` | `string` | optional | e.g. `"85% threshold"` |
| `sections.main.rest` | `string` | optional | e.g. `"None — continuous"` |
| `sections.main.stations` | `WodStation[]` | yes | |
| `sections.cooldown` | `{ name: string; duration?: string; notes?: string }[]` | optional | |

#### `WodStation`

| Field | Type | Required |
|---|---|---|
| `movement` | `string` | yes |
| `distance` | `string` | optional |
| `reps` | `number` | optional |
| `calories` | `number` | optional |
| `duration` | `string` | optional |
| `load` | `string` | optional |
| `notes` | `string` | optional |

---

### `RestPrescription` (when `category === "Rest"`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `guidance` | `string` | optional | e.g. `"Full rest day"`. |
| `recoveryType` | `"full_rest" \| "walk" \| "mobility" \| "stretching"` | optional | |
| `durationMin` | `number` | optional | Defined in TypeScript; rarely used by AI. |

---

## `Actual` — session actual data

| Field | Type | Required | Notes |
|---|---|---|---|
| `distanceKm` | `number \| null` | optional | Actual distance run. |
| `pace` | `string \| null` | optional | Actual pace string. |
| `effort` | `"easy" \| "moderate" \| "hard" \| null` | optional | Perceived effort. |
| `notes` | `string \| null` | optional | Freetext note from athlete. |
| `rawText` | `string` | optional | Original user text before AI parsing. **Defined in TypeScript but never written to Firestore in current code.** |

---

## `users/{uid}/coachSessions/{coachSessionId}` — Coach Session Log

Typed as `CoachSessionLog` in `lib/types.ts`. **Flat collection, not nested under a training block.**

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | `string` | derived | Firestore document ID. Injected client-side. |
| `appliedAt` | `Timestamp` | yes | `serverTimestamp()`. In-memory representation uses `{ seconds: number; nanoseconds: number }`. |
| `firstMessage` | `string` | yes | The user's first message in that coach conversation. |
| `summary` | `string` | yes | The last coach response text. |
| `changesCount` | `number` | yes | Count of sessions changed. |
| `changes` | `CoachSessionChange[]` | yes | Full before/after for each changed session. |

### `CoachSessionChange` (embedded in `changes` array)

| Field | Type | Required |
|---|---|---|
| `weekId` | `string` | yes |
| `sessionId` | `string` | yes |
| `day` | `string` | yes |
| `fromCategory` | `Category` | yes |
| `fromPrescription` | `Prescription` | yes |
| `toCategory` | `Category` | yes |
| `toPrescription` | `Prescription` | yes |

> **Note:** `coachSessions` is not scoped to a specific training block in Firestore. Cross-block coach history is possible. The app fetches the 10 most recent by `appliedAt`.

---

## Enums and Type Aliases

| Name | Values | Used on |
|---|---|---|
| `Day` | `"Monday" \| "Tuesday" \| "Wednesday" \| "Thursday" \| "Friday" \| "Saturday" \| "Sunday"` | `session.day` |
| `Category` | `"Run" \| "Strength" \| "WOD" \| "Rest" \| null` | `session.category` |
| `IncidentType` | `"illness" \| "injury" \| "missed_session" \| "scheduling_conflict" \| "fatigue" \| "general"` | `/api/handle-incident` response |

---

## Implicit / Undocumented Fields

The following fields exist in Firestore writes but are absent from TypeScript interfaces. They are schema drift risks:

| Entity | Field | Written where |
|---|---|---|
| `trainingBlocks` | `secondaryGoal` | `handleCreateBlock` — always `null` |
| `trainingBlocks` | `createdAt` | `handleCreateBlock`, `handleQueueBlock` |
| `trainingBlocks` | `endedAt` | `handleCreateBlock` when completing previous block |
| `trainingWeeks` | `createdAt` | `handleCreateBlock` |
| `sessions` | `createdAt` | `handleCreateBlock` |
| `users/{uid}` | `uid`, `email`, `displayName`, `createdAt` | `onAuthStateChanged` first sign-in |

---

## Derived / Computed Fields (client-side only, never stored)

| Field | Computed by | Notes |
|---|---|---|
| `TrainingWeek.sessions` | `fetchBlockData` | Assembled from `sessions` sub-collection; sorted by calendar offset. |
| `BlockMetrics` | `computeBlockMetrics()` | Pure function; used in ReviewView only. |
| `WeekMetrics` | `computeWeekMetrics()` | Pure function; used in ReviewView only. |
| `InsightSignal[]` | `computeInsights()` | Passed to AI prompts as context. Never stored. |
| `todaySession` | `app/page.tsx` | Derived from `currentWeek` + today's weekday name. |
| `currentWeek` | `app/page.tsx` | Derived from `weeks` + today's date. |
