# System Overview — What Is Actually Built

_As of 2026-03-22_

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | Firebase Authentication (Google OAuth only) |
| Database | Firebase Firestore |
| AI | Google Gemini (`gemini-2.5-flash` default via `GEMINI_API_KEY`) |
| Deployment | Not documented — assumed Vercel |

> **Note:** The app uses Gemini, not Claude. The model is configured via `GEMINI_MODEL` env var. Default is `gemini-2.5-flash`.

---

## Application Structure

```
app/
  page.tsx                   ← entire app shell (auth, state, routing)
  api/
    generate-plan/route.ts   ← POST — AI generates 6-week block
    regenerate-week/route.ts ← POST — AI regenerates a single week
    adapt-plan/route.ts      ← POST — AI proposes session changes via chat
    handle-incident/route.ts ← POST — classifies illness/injury/missed/fatigue + deterministic rules
    parse-actual/route.ts    ← POST — AI parses freetext session description into structured Actual

components/
  TodayView.tsx              ← Today tab wrapper
  TodayWorkout.tsx           ← Today's session card (large typography)
  ActiveBlock.tsx            ← Block header: name, week progress, days to race
  TrainingWeeks.tsx          ← Week list with expand/collapse
  WeekCard.tsx               ← Individual week row
  SessionRow.tsx             ← Session row in week list
  SessionDetail.tsx          ← Structured training-sheet session view
  SessionEditModal.tsx       ← Manual prescription editor
  RegenerateWeekModal.tsx    ← Week regeneration dialog
  CoachChat.tsx              ← Chat interface (incident + adapt-plan flows)
  PlanView.tsx               ← Plan tab: week grid, block settings, next block, history
  ReviewView.tsx             ← Review tab: analytics and adherence charts
  InsightCard.tsx            ← Single insight signal chip

lib/
  firebase.ts                ← Firebase init, exports auth + db
  types.ts                   ← All TypeScript interfaces and union types
  analytics.ts               ← Pure functions: computeWeekMetrics, computeBlockMetrics,
                                computeBlockSummary, computeInsights
```

---

## User-Facing Features

### Authentication
- Google OAuth sign-in via `signInWithPopup`.
- On first sign-in, a `users/{uid}` document is created with profile fields.
- Sign-out clears all state.

### Three-Tab Navigation
- **Today** — today's session + coach chat + week list
- **Plan** — week grid with session management + block settings + history
- **Review** — analytics: completion rates, run comparisons, insight signals

### Block Lifecycle
1. User enters a goal and optional race date.
2. "Generate Training Block" calls `/api/generate-plan`, which returns 6 weeks of structured sessions from Gemini.
3. Any existing active block is snapshotted (summary computed) and marked `"completed"` atomically.
4. New block is written with weeks and sessions to Firestore.
5. User can also **queue** a next block (stub document, no sessions yet).
6. Queued block shows in Plan view with "Activate → Generate Plan" button (not yet wired).

### Session Interaction
- **Completion toggle:** Tap to mark done. Optimistic UI + Firestore write.
- **Category change:** Change session type (Run / Strength / WOD / Rest).
- **Log actual:** Freetext description parsed by `/api/parse-actual` → `Actual` struct written to session.
- **Edit prescription:** Open `SessionEditModal` to manually rewrite category and full prescription.

### Coach Chat (AI Adaptive Layer)
Two-pathway system:

**Incident pathway** (illness, injury, missed session, fatigue):
1. Client regex (`looksLikeIncident`) classifies the message.
2. `POST /api/handle-incident` classifies type + severity via Gemini, then applies **deterministic rules** in server-side TypeScript.
3. Rules produce a set of `SessionChange[]` without additional AI calls.
4. Multi-turn clarification supported (e.g. "how severe?" → chips → answer → rules applied).
5. Missed session offers three explicit options (continue / move to tomorrow / drop).

**Adapt pathway** (all other messages):
1. `POST /api/adapt-plan` receives full conversation history + context.
2. Gemini returns `{ summary, changes[] }` — proposed session modifications.
3. Changes grouped by week are displayed in the chat thread with was/now labels.
4. User confirms → `applyChanges` batch-writes all changes + coach session log atomically.
5. Manually-modified sessions flagged with warning before overwrite.

**Coach memory:** Last 10 coach sessions (from `coachSessions` collection) are injected into every Gemini prompt. Insight signals from `computeInsights()` are also included.

### Plan View
- Week grid: 6-row × 7-column colour-coded grid. Click a day → `SessionDetail`. Click week label → full week list.
- Regenerate week: `RegenerateWeekModal` calls `/api/regenerate-week` with previous week context + optional athlete note.
- Block settings: goal and race date editable and saveable to Firestore.
- Next block: queue a stub block with a future goal.
- Block history: completed blocks with summary stats and cross-block trend signals.

### Review View
- Block-level completion rate.
- Per-category adherence (Run / Strength / WOD).
- Run comparison table: planned vs actual distance, pace, effort.
- Insight signals: pattern detection over last 4 weeks.
- Cross-block trend signals (uses `BlockSummary` snapshots from completed blocks).

---

## API Routes

### `POST /api/generate-plan`
**Input:** `{ goal: string, eventDate: string, weeks: number }`
**Output:** `{ weeks: [{ weekNumber, sessions: [{ day, category, prescription }] }] }`
**AI:** Gemini. Full structured prescription for all 7 sessions × 6 weeks.

### `POST /api/regenerate-week`
**Input:** `{ goal, weekNumber, totalWeeks, startDate, endDate, currentSessions, previousWeekSessions, instruction }`
**Output:** `{ summary: string, sessions: [{ day, category, prescription }] }`
**AI:** Gemini. Single week, context-aware (week type + prior week for progressive overload).

### `POST /api/adapt-plan`
**Input:** `{ messages, currentChanges, weeks (first 3 only), coachHistory, insights }`
**Output:** `{ summary: string, changes: SessionChange[] }`
**AI:** Gemini. Conversational — receives full turn history and refines proposed changes.
**Truncation:** Only the first 3 weeks of the block are sent to Gemini to manage token limits.

### `POST /api/handle-incident`
**Input:** `{ message, weeks (all), coachHistory, priorContext, insights }`
**Output:** `IncidentResponse` — `{ incidentType, severity, affectedModality, summary, changes, followUpChips, options, priorContext }`
**AI:** Gemini for classification only. Rules engine in TypeScript for all session changes.
**Important:** All weeks are sent (no truncation) because injury rules span multiple weeks.

### `POST /api/parse-actual`
**Input:** `{ prescription, category, userText }`
**Output:** `{ summary: string, actual: Actual }`
**AI:** Gemini. Extracts structured data from athlete's freetext session description.

---

## Data Flow: Creating a Block

```
User: clicks "Generate Training Block"
  → handleCreateBlock() in page.tsx
  → POST /api/generate-plan  [Gemini → 6-week JSON]
  → Firestore: mark existing active block as "completed", write summary
  → Firestore: write new trainingBlock document
  → Loop 6 weeks:
      → Firestore: write trainingWeek document
      → Loop 7 days:
          → Firestore: write session document (with AI prescription)
  → fetchBlockData() → re-read all blocks, weeks, sessions into state
```

## Data Flow: Coach Applies Changes

```
User: types message → handleSend()
  → looksLikeIncident? → POST /api/handle-incident
                        : POST /api/adapt-plan
  → Coach message rendered with proposed changes
User: clicks "Apply changes" → handleApply()
  → applyChanges() in page.tsx
  → writeBatch():
      → updateDoc each changed session (category, prescription, manuallyModified: true)
      → setDoc new coachSession document (audit log)
  → Optimistic update to local weeks state
```

---

## State Management

All state lives in `app/page.tsx` as React `useState`. There is no external state manager (no Redux, Zustand, Context, etc.).

| State | Type | Notes |
|---|---|---|
| `user` | `User \| null` | Firebase Auth user |
| `goal` | `string` | Current goal input value |
| `eventDate` | `string` | ISO date string |
| `activeBlock` | `TrainingBlock \| null` | Active block metadata |
| `queuedBlock` | `TrainingBlock \| null` | Queued next block stub |
| `completedBlocks` | `TrainingBlock[]` | Most-recent first |
| `weeks` | `TrainingWeek[]` | Sessions assembled client-side |
| `expandedWeek` | `string \| null` | Expanded week ID on Today tab |
| `coachHistory` | `CoachSessionLog[]` | Last 10 sessions |
| `view` | `"today" \| "plan" \| "review"` | Active tab |

`CoachChat` maintains its own local state for the conversation thread. The component is always mounted (hidden via CSS when not on Today view) so conversation survives tab switches.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | yes | Firebase config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | yes | Firebase config |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | yes | Firebase config |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | yes | Firebase config |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | yes | Firebase config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | yes | Firebase config |
| `GEMINI_API_KEY` | yes | Gemini AI — server-side only |
| `GEMINI_MODEL` | optional | Defaults to `gemini-2.5-flash` |
