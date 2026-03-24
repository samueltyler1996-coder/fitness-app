# Fitness App — Product Plan

_Last updated: 2026-03-24 (session 6)_

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

### Phase I — Deep Drill-Down (Lazy Session Fetch) ✓
_Goal: let the user explore past block data in detail without slowing the main load._

- [x] Tap a completed block in history → expand to see full week grid + session list
- [x] Fetch sessions from completed blocks on demand (not on initial load) — cached in React state, no re-fetch on collapse/expand
- [x] `CompletedBlockDetail` component — collapsible weeks, read-only session rows, prescription + actuals summary
- [x] `StrengthExerciseActual` type + extend `Actual` with `strengthExercises[]`
- [x] `StrengthLoadProgression` + `StrengthLogEntry` types in `lib/types.ts`
- [x] `computeStrengthLoadProgression()` in `lib/analytics.ts` — groups exercises across weeks, computes trend
- [x] Strength progression table rendered inside expanded completed block (exercise × week grid with trend arrow)

### Phase J — Strava Integration ✓
_Goal: auto-populate actual run data from Strava instead of manual logging._

- [x] `GET /api/strava/authorize` — builds Strava OAuth URL with `state=uid`, redirects
- [x] `GET /api/strava/callback` — exchanges code for tokens, writes to `users/{uid}/integrations/strava`
- [x] Firestore structure: `users/{uid}/integrations/strava` — athleteId, accessToken, refreshToken, expiresAt, scope, connectedAt
- [x] `lib/strava.ts` — `getValidAccessToken(uid)` handles 6-hour expiry and refresh automatically
- [x] `GET /api/strava/activities` — fetches activities for a date range, returns mapped array
- [x] Match by date (session day X → Strava activities between X 00:00–23:59), filter type === "Run"
- [x] `computePaceStr()` and `inferEffort()` utilities in `lib/strava.ts`
- [x] "Connect Strava" button in Block Settings / profile area with connected state display
- [x] Auto-fill actual in `TodayWorkout`, `SessionDetail`, `NowZone` when opening a Run session — silently checks Strava, pre-fills log input

### Phase K — Messaging Coach ✓
_Goal: interact with the coach conversationally on the go via Telegram and WhatsApp._

- [x] `lib/firebase-admin.ts` — server-side Firestore access via service account (base64 JSON)
- [x] `POST /api/telegram` — Telegram bot webhook: routes messages, YES/NO confirmation, applies changes to Firestore
- [x] `POST /api/whatsapp` — WhatsApp Cloud API webhook (Meta, free up to 1,000 conversations/month)
- [x] Phone number / chat ID → Firestore UID mapping on user doc (`whatsappPhone`, `telegramChatId`)
- [x] Connect Telegram + Connect WhatsApp UI in CoachZone (minimal, both supported)
- [x] Conversational flow — YES/NO gate removed, pending changes replaced/cleared naturally mid-conversation
- [x] Changes list — bullet-point summary of each session change before YES/NO prompt
- [x] Conversation history stored in Firestore (rolling 20 messages, separate per channel)
- [x] Pending changes stored in Firestore per channel, applied server-side via batch write + coach session log

### Phase L — Race Week + Race Day Experience ✓
_Goal: own the emotional peak of the athlete's year — no competitor does this._

- [x] Detect race week automatically (event date within 7 days) — `lib/race.ts` with `isRaceWeek()`, `isRaceDay()`, `isPostRace()`
- [x] Race week card on dashboard — countdown, taper status, "Race Day" state, post-race "You did it" state (`RaceWeekCard`)
- [x] Race morning briefing: wake time, nutrition timing, warm-up protocol, target splits — AI-generated from goal + block history (`/api/race-briefing`, `RaceDayBriefing` full-screen modal)
- [x] Race week session modifications: "Suggest taper" button in Plan view → `/api/generate-taper` (deterministic: −35% volume, maintained intensity)
- [x] Share briefing via Web Share API (native mobile share sheet) with clipboard fallback

### Phase M — Post-Race Debrief + Next Block Seeding
_Goal: capture the most emotionally charged moment of the athlete's year and feed it forward._

- [ ] Trigger debrief when event date passes — proactive WhatsApp/Telegram message: "How did it go?"
- [ ] Structured debrief conversation: result, how it felt, what worked, what didn't, injury/fatigue status
- [ ] Debrief stored to Firestore, injected into next block generation as context
- [ ] "Start next block" flow pre-populated from debrief answers (goal, event date, adjustments)

### Phase N — Hyrox Simulation + Station Benchmarks ✓
_Goal: own the Hyrox training category — 500k+ athletes, zero dedicated coaching apps._

- [x] Athlete profile: benchmark times per station via `HyroxBenchmarkInput` in CoachZone (MM:SS inputs, wall balls by reps)
- [x] `HyroxBenchmarks` type + Firestore write/read (`users/{uid}/hyroxBenchmarks/benchmarks`)
- [x] `"hyrox_simulation"` WOD format — 8-round view with per-station target times in `TodayWorkout` + `SessionDetail`
- [x] AI-calibrated prescriptions: when goal contains "hyrox" and benchmarks are set, `generate-plan` appends station targets at `benchmark × 1.1`
- [x] Progress view: read-only benchmark display (violet-themed) with `lastUpdated`

### Phase O — Predictive Race Time Estimate
_Goal: answer the question every athlete asks — "am I on track?"_

- [ ] Apply Riegel formula / VDOT model to completed run actuals
- [ ] Weekly-updated predicted finish time shown on dashboard (with confidence range)
- [ ] Trend line: predicted time improving/worsening across weeks
- [ ] Hyrox equivalent: projected total time based on station benchmarks + run pace

### Phase P — Proactive Coach Check-ins
_Goal: make the app feel alive — an agentic coach that reaches out, not one that waits._

- [ ] Scheduled check-ins via WhatsApp/Telegram (uses existing messaging infra)
- [ ] "You haven't logged Tuesday's session — did it happen?"
- [ ] "You've trained hard 4 days in a row — keeping tomorrow easy is a good call"
- [ ] Weekly summary sent every Sunday: sessions done, km logged, how next week looks
- [ ] Cron job / scheduled Cloud Function triggers — rule-based logic first, AI synthesis for message text

### Phase Q — Voice Session Logging
_Goal: remove logging friction — athletes shouldn't have to type post-workout._

- [ ] Web Speech API input on log fields (mobile Chrome/Safari)
- [ ] Tap mic → speak → transcribed text fed into existing `/api/parse-actual` pipeline
- [ ] Works in `TodayWorkout`, `SessionDetail`, WhatsApp/Telegram (already text-based)

### Phase R — Training Load Visualisation (ATL/CTL)
_Goal: give athletes the TrainingPeaks Performance Management Chart without the 2009 UI._

- [ ] Session load scoring: RPE × duration (manual), or HR-based if wearable data available
- [ ] Acute Training Load (ATL, 7-day rolling) and Chronic Training Load (CTL, 42-day rolling)
- [ ] Form = CTL − ATL: "fresh", "optimal", "fatigued" zones
- [ ] Chart in Progress view: ATL/CTL/Form over time, race date marked
- [ ] Taper detection: form trending positive into race week

### Phase S — Garmin / Apple Health Integration
_Goal: let real physiological data (HRV, sleep, training readiness) inform the plan._

- [ ] Garmin Connect OAuth flow — access HR, HRV, training load, sleep score
- [ ] Apple HealthKit integration (iOS) — resting HR, HRV, sleep
- [ ] Daily readiness signal: if HRV suppressed or sleep poor → suggest session downgrade
- [ ] Proactive check-in when readiness is low (uses Phase P infrastructure)
- [ ] Feeds ATL/CTL calculations (Phase R) with device-measured load instead of manual RPE

### Phase T — Shareable Race Day Card
_Goal: turn the race briefing into a viral moment — Spotify Wrapped for athletes._

- [ ] Render race briefing as a designed visual card (dark background, big typography, emerald accents)
- [ ] Card shows: goal, race date, target splits, top mental cue, app branding
- [ ] Capture card as PNG using `html-to-image` or similar
- [ ] Share via Web Share API with `files: [imageFile]` — lands as a real image in Instagram Stories, WhatsApp etc.
- [ ] App branding at bottom drives traffic back to the app

### Phase U — Unified Athlete Profile + Block Creation UX
_Goal: make setup, configuration, and goal-setting feel like a first-class experience._

- [ ] Dedicated Settings page: Profile (goal, event date, training preferences), Integrations (Strava, WhatsApp, Telegram), Athlete targets (predicted race times, strength 1RM, Hyrox benchmarks — editable/toggleable)
- [ ] Block creation flow with goal type selector (Running / Hyrox / Strength / Mixed) — replaces generic text input
- [ ] Progress view enriched with targets vs actuals: predicted race finish time (Riegel formula), Hyrox projected total time (benchmarks + run pace), strength targets per key lift
- [ ] Benchmark inputs moved from CoachZone into Settings as part of Athlete Targets section
- [ ] Block creation pre-populates from athlete profile (goal, event date, benchmarks)

---

## Working Style

- Exact code placement with explanation of why — never vague
- User controls when to git commit
- Test understanding before directing — explain goal, ask how user thinks it should work, then refine together
