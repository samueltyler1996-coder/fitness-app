# Fitness App — Product Plan

_Last updated: 2026-03-22 (session 4)_

---

## Vision

Not a planner. An app that behaves like a trainer.

Core loop:
- Auto-generate a structured training block (AI-powered)
- Chat with the coach to adapt the current or future weeks
- "I'm ill this week" → reduce sessions. "I'm injured" → modify multiple future weeks.
- Eventually: add future blocks, review past performance, adapt intelligently over time.

Home = dashboard (not a list). Editing = separate experience.

---

## What's Built

### Foundation
- [x] Google OAuth sign-in
- [x] User document creation on first sign-in
- [x] User profile: goal + event date (saved to Firestore)
- [x] Nested Firestore model: `users/{uid}/trainingBlocks/{blockId}/trainingWeeks/{weekId}/sessions/{sessionId}`

### Block Generation
- [x] Create training block (marks previous active block as completed)
- [x] Gemini AI plan generation via `/api/generate-plan` — produces 6 weeks of sessions with real prescriptions
- [x] Sessions stored with `prescription`, `actual`, `aiGenerated`, `manuallyModified` fields

### Dashboard
- [x] Fetch active block → weeks (ordered by startDate) → sessions (sorted Mon→Sun)
- [x] Today's session detection by week date range + weekday name
- [x] TodayWorkout card — shows today's session and prescription
- [x] ActiveBlock card — shows block name and week progress
- [x] Auto-expand current week

### Session Interaction
- [x] Completion toggle (optimistic UI + Firestore write)
- [x] Category editing per session
- [x] Log actual session data via `/api/parse-actual` (AI-powered, with confirmation)

### Adaptive Coach
- [x] CoachChat component — back-and-forth conversation
- [x] `/api/adapt-plan` — full conversation history, proposes session changes grouped by week with was/now labels
- [x] Human-in-the-loop confirmation before applying changes
- [x] `applyChanges` — batch writes session updates + coach session log atomically to Firestore
- [x] Fix: conversation history now serialises full prescription detail (back-and-forth memory)
- [x] Fix: only future uncompleted sessions sent to AI (past sessions never proposed)
- [x] Fix: Week 1 starts on today → Sunday; Week 2+ always Monday → Sunday
- [x] Fix: sessions sorted by actual calendar date within week, not always Mon→Sun
- [x] Change log: `coachSessions` collection stores firstMessage, summary, changesCount, before/after per session
- [x] Long-term memory: last 10 coach sessions injected into AI prompt as compact history for trend awareness
- [x] Types: `CoachSessionChange`, `CoachSessionLog`

### Code Quality
- [x] Componentised: `TodayWorkout`, `ActiveBlock`, `TrainingWeeks`, `WeekCard`, `SessionRow`, `CoachChat`
- [x] TypeScript types: `TrainingBlock`, `TrainingWeek`, `Session`, `Category`, `Day`, `Actual`, `SessionChange`, `CoachSessionChange`, `CoachSessionLog`

---

## Phases

### Phase A — Dashboard Polish ✓
- [x] Progress indicator on ActiveBlock (Week N of M, days to race, segmented bar)
- [x] Goal + race date display on ActiveBlock
- [x] Profile section redesigned (underline inputs, dark button)
- [x] TodayWorkout dominates the screen with large typography

### Phase B — Full Session Schema ✓
- [x] `RunPrescription`: type, distanceKm, targetPace, guidance, intervals array
- [x] `StrengthPrescription`: focus, goal, durationMin, guidance, sections (warmup/main/accessory/finisher/cooldown) with real exercises (sets/reps/load/tempo)
- [x] `WodPrescription`: format, focus, durationCapMin, guidance, sections with named stations (movement/distance/reps/load)
- [x] `RestPrescription`: guidance, recoveryType
- [x] `WOD` added as a Category
- [x] generate-plan prompt outputs full prescription structures with real Hyrox movements
- [x] adapt-plan rules updated for WOD + new prescription shapes
- [x] TodayWorkout and SessionRow render all sections

### Phase C — Planning / Editing Screen ✓
_Goal: separate the "what am I doing today" dashboard from the "let me manage my plan" editor._

- [x] Dedicated planning view (week grid, progress bar, block settings)
- [x] Edit a session prescription manually (SessionEditModal with validation)
- [x] Regenerate a single week (RegenerateWeekModal + `/api/regenerate-week`)
- [x] Adjust block end date / goal (Block Settings on plan view)
- [x] Mark sessions as manually modified ("edited" badge + warn-before-overwrite in coach + regenerate)
- [x] Plan page interaction: day square → session detail, W1 label → full week management
- [x] SessionDetail: structured training-sheet layout with 2-line exercise rows

### Phase D — Deterministic Adaptation Rules ✓
_Goal: safe, predictable adaptation before relying purely on AI._

- [x] Illness flow: mild/moderate/severe — downgrade or cancel sessions over 7-day window
- [x] Injury flow: body-part to modality mapping, 1–all-remaining weeks affected by severity
- [x] Fatigue flow: deload week on severe, downgrade on moderate
- [x] Missed session: 3-option recovery flow (continue / move / drop)
- [x] Clarification chips when severity is ambiguous
- [x] Rules-based first, AI classification second — keeps behaviour explainable
- [x] `/api/handle-incident` route with Gemini classification + deterministic rule engine

### Phase E — Historical Review + Analytics ✓
_Goal: the app should know how training is going, not just what's planned._

- [x] Block review: completion rate, plan vs actual comparison (`ReviewView`)
- [x] Week-by-week completion grid (colour-coded: green/amber/red)
- [x] Category breakdown with progress bars (Run / Strength / WOD)
- [x] Run log: last 12 completed runs, planned vs actual km + effort
- [x] Insight signals: per-category miss patterns, completion trend, run km shortfall (`computeInsights`)
- [x] `lib/analytics.ts`: `computeWeekMetrics`, `computeBlockMetrics`, `computeInsights`

### Phase F — Block Sequencing ✓
_Goal: support a training journey over time, not just one cycle._

- [x] Block status extended: `"active" | "completed" | "queued"`
- [x] `fetchBlockData` fetches all blocks, splits by status in code (single query, not per-status)
- [x] `BlockSummary` written to Firestore when block completes — snapshot frozen at completion (completionRate, adherence by category, run actuals, incidentCount)
- [x] Completed block history in Plan view: cards with name, dates, completion %, per-category adherence pills
- [x] Cross-block insight signals in Plan view ("What this shows") — `computeCrossBlockInsights`
- [x] Queue next block: goal input + duration selector (4 / 6 / 8 / 10 / 12 weeks), dates auto-set from active block end
- [x] Remove queued block
- [x] Activate queued block: generates sessions via AI, completes current block with summary, promotes queued → active
- [x] Max 1 active + max 1 queued enforced in data layer

### Phase G — Athlete Progress Intelligence ✓
_Goal: the app remembers and learns — longitudinal trends across blocks, not just within one._

- [x] `BlockSummary` enriched with run actuals at completion: `totalActualKm`, `longestActualRunKm`, `avgEasyPaceSecs` (pace stored as seconds/km for clean trend comparison)
- [x] `CoachSessionLog` now tags `incidentType` — written to Firestore when incident changes are applied
- [x] `computeProgressInsights`: rule-based signal engine across blocks + coach history — run volume trend, easy pace trend, adherence trends, incident frequency, coaching pattern flags
- [x] `secsTopace` utility: converts stored pace seconds back to display string
- [x] `ProgressView` component: run volume bar chart (oldest → latest), current easy pace, signal cards grouped by run/strength/incidents/coaching, incident log with type + date
- [x] Progress nav tab added (Today / Plan / Review / Progress)

---

## Architecture Decisions (locked)

- Nested Firestore structure is correct and stays
- `prescription` = what the app tells you to do. `actual` = what happened.
- Weeks use real calendar dates, not forced Monday-start
- Sessions sorted Mon→Sun client-side (Firestore doesn't guarantee order)
- One block has `status === "active"` at a time — new block marks old as `"completed"`
- AI adaptation goes through human-in-the-loop confirmation before writing to Firestore
- Completed block summaries are snapshots frozen at completion — not recomputed retroactively
- Cross-block trends read from block-level summaries only (cheap); session-level deep dive is lazy-loaded on demand
- Rule-based signals first, AI synthesis later

---

## What's Next

### Phase H — Feed Progress into Adaptation ✓
_Goal: close the loop — what the app knows about you should inform what it prescribes._

- [x] `formatProgressContext()` in `lib/analytics.ts` — serialises completed block summaries + coach history into compact plain-text for AI prompts
- [x] Computed once via `useMemo` in `app/page.tsx`, passed to CoachChat and both block creation functions
- [x] `/api/adapt-plan` — receives and injects `progressContext` before conversation history
- [x] `/api/handle-incident` — receives and injects `progressContext` before classification prompt
- [x] `/api/generate-plan` — receives `progressContext` with explicit calibration instruction: use history to adjust volume, intensity, and session complexity
- [x] Empty-safe: returns `""` if no completed block summaries exist, all APIs unchanged for new accounts

### Phase I — Deep Drill-Down (Lazy Session Fetch)
_Goal: let the user explore past block data in detail without slowing the main load._

- [ ] Tap a completed block in history → expand to see full week grid + session list
- [ ] Fetch sessions from completed blocks on demand (not on initial load)
- [ ] Strength load progression per exercise (if actual data is logged consistently)

### Phase J — Strava Integration
_Goal: auto-populate actual run data from Strava instead of manual logging._

**OAuth flow (Option A — UID as state):**
- [ ] `GET /api/strava/authorize` — builds Strava OAuth URL with `state=uid`, redirects
- [ ] `GET /api/strava/callback` — exchanges code for tokens, writes to `users/{uid}/integrations/strava`
- [ ] Firestore structure: `users/{uid}/integrations/strava` — athleteId, accessToken, refreshToken, expiresAt, scope, connectedAt

**Token + activity layer:**
- [ ] `lib/strava.ts` — `getValidAccessToken(uid)` handles 6-hour expiry and refresh automatically
- [ ] `GET /api/strava/activities` — fetches activities for a date range, returns mapped array

**Activity → session matching:**
- [ ] Match by date (session day X → Strava activities between X 00:00–23:59), filter type === "Run"
- [ ] If multiple: pick closest to `prescription.distanceKm`
- [ ] Map to `Actual`: distanceKm, pace (computed from moving_time/distance), effort (from HR or perceived_exertion), notes (activity name)

**UI:**
- [ ] "Connect Strava" button in Block Settings / profile area
- [ ] Connected state display (athlete name)
- [ ] Auto-fill actual in `SessionDetail` when opening a Run session — silently check Strava, pre-fill log input
- [ ] New env vars: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `NEXT_PUBLIC_APP_URL`

### Phase K — WhatsApp Coach
_Goal: interact with the coach conversationally on the go via WhatsApp, for free._

- [ ] Twilio free tier or Meta Cloud API (free up to 1,000 conversations/month)
- [ ] `POST /api/whatsapp` webhook — receives messages, routes to existing handle-incident or adapt-plan
- [ ] Phone number → Firestore UID mapping on user doc
- [ ] Human-in-the-loop confirmation via reply keywords (YES/NO to apply proposed changes)
- [ ] Conversation state in Firestore for pending changes awaiting confirmation

---

## Working Style

- Exact code placement with explanation of why — never vague
- User controls when to git commit
- Test understanding before directing — explain goal, ask how user thinks it should work, then refine together
