# Fitness App — Product Plan

_Last updated: 2026-03-21 (session 2)_

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

## What's Next (Prioritised)

### Phase A — Dashboard Polish
_Goal: make the home screen feel like a coaching app, not a dev prototype._

- [ ] Progress indicator on ActiveBlock card (e.g. "Week 2 of 6", % complete, days to race)
- [ ] Race name display (currently only shows event date — should show goal name too)
- [ ] Profile section moved/redesigned — currently a raw form at the bottom, should feel less like settings
- [ ] Visual hierarchy: Today's Workout should dominate the screen; rest should feel secondary

### Phase B — Full Session Schema
_Goal: sessions should carry real plan + real actual data, not just basic fields._

Prescription fields to flesh out:
- For runs: `type` (easy/tempo/long/intervals), `distanceKm`, `targetPace`, `targetTime`, `HRzone`, `intervals`, `recovery`, `guidance`
- For strength: `focus`, `movements`, `sets`, `reps`, `intensity`, `guidance`
- For rest: `guidance`

Actual fields to flesh out:
- `completed`, `actualDistanceKm`, `actualTime`, `actualPace`, `perceivedEffort`, `notes`
- Later: pain/illness/fatigue markers to feed adaptation

### Phase C — Planning / Editing Screen
_Goal: separate the "what am I doing today" dashboard from the "let me manage my plan" editor._

- [ ] Dedicated planning view (separate route or panel)
- [ ] Edit a session prescription manually
- [ ] Regenerate a single week
- [ ] Adjust block end date / goal
- [ ] Mark sessions as manually modified (already flagged in data — needs UI)

### Phase D — Deterministic Adaptation Rules
_Goal: safe, predictable adaptation before relying purely on AI._

- [ ] Illness flow: reduce/cancel N sessions, preserve audit trail
- [ ] Injury flow: downgrade multiple future weeks
- [ ] Missed session: suggest recovery or continuation
- [ ] Rules-based first, AI-assisted second — keeps behaviour explainable

### Phase E — Historical Review + Analytics
_Goal: the app should know how training is going, not just what's planned._

- [ ] Block review: completion rate, plan vs actual comparison
- [ ] Session adherence trends
- [ ] Highlight missed sessions or repeated issues
- [ ] Feed into future AI adaptation: lower adherence → reduce complexity, strong consistency → progress more

### Phase F — Multi-Block Planning
_Goal: support a training journey over time, not just one cycle._

- [ ] Queue future blocks (e.g. Base → Build → Taper)
- [ ] View completed block history
- [ ] Transition logic between blocks

---

## Architecture Decisions (locked)

- Nested Firestore structure is correct and stays
- `prescription` = what the app tells you to do. `actual` = what happened.
- Weeks use real calendar dates, not forced Monday-start
- Sessions sorted Mon→Sun client-side (Firestore doesn't guarantee order)
- One block has `status === "active"` at a time — new block marks old as `"completed"`
- AI adaptation goes through human-in-the-loop confirmation before writing to Firestore

---

## Working Style

- Exact code placement with explanation of why — never vague
- User controls when to git commit
- Test understanding before directing — explain goal, ask how user thinks it should work, then refine together
