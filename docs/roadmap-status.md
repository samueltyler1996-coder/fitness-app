# Roadmap Status

_Last verified against code: 2026-03-22_

The PLAN.md in the repo root is the authoritative roadmap. This document reflects actual build status based on reading the code — not just what PLAN.md says is done.

---

## Foundation — Complete

- [x] Google OAuth sign-in
- [x] User document creation on first sign-in (`uid`, `email`, `displayName`, `createdAt`, `currentGoal`, `eventDate`)
- [x] User profile: goal + event date (saved to Firestore, loaded on auth)
- [x] Nested Firestore model: `users/{uid}/trainingBlocks/{blockId}/trainingWeeks/{weekId}/sessions/{sessionId}`

---

## Block Generation — Complete

- [x] `POST /api/generate-plan` — Gemini generates 6 weeks of structured prescriptions
- [x] Previous active block marked `"completed"` with `BlockSummary` snapshot before new block is written
- [x] All 7 sessions per week written to Firestore with full prescription objects
- [x] Sessions carry `prescription`, `actual`, `aiGenerated`, `manuallyModified` fields

---

## Phase A — Dashboard Polish — Complete

- [x] Progress bar on active block (done / total sessions)
- [x] Week N of M indicator
- [x] Days to race countdown (derived from `eventDate`)
- [x] Today's session detection (by week date range + weekday name)
- [x] TodayWorkout card with large typography
- [x] Auto-expand current week on load
- [x] Three-tab navigation: Today / Plan / Review

---

## Phase B — Full Session Schema — Complete

- [x] `RunPrescription`: type, distanceKm, targetPace, guidance, intervals array
- [x] `StrengthPrescription`: focus, goal, durationMin, guidance, sections (warmup/main/accessory/finisher/cooldown) with real exercises
- [x] `WodPrescription`: format, focus, durationCapMin, guidance, sections with named stations
- [x] `RestPrescription`: guidance, recoveryType
- [x] `WOD` added as a `Category`
- [x] All four prescriptions rendered in TodayWorkout and SessionRow
- [x] generate-plan and adapt-plan prompts updated for all prescription shapes

---

## Phase C — Planning / Editing Screen — Complete

- [x] Dedicated Plan tab (week grid, block settings, block history)
- [x] Week grid: 6-row × 7-column colour-coded grid
- [x] Click day → `SessionDetail` (structured training sheet)
- [x] Click week label → full week list (`SessionRow` for each session)
- [x] `SessionEditModal` — manual prescription editing
- [x] `RegenerateWeekModal` + `POST /api/regenerate-week` — regenerate a single week with AI
- [x] Block settings: goal and race date editable on Plan view
- [x] `manuallyModified` flag set on direct edits and coach-applied changes
- [x] Warning before coach overwrites manually-edited sessions

---

## Phase D — Deterministic Adaptation Rules — Complete

> PLAN.md shows these as unchecked (`[ ]`), but the code fully implements them.

- [x] `POST /api/handle-incident` — classifies illness / injury / missed_session / scheduling_conflict / fatigue via Gemini
- [x] Deterministic rule engine in TypeScript — no second AI call for session changes:
  - [x] **Illness:** mild → downgrade intense runs + cancel Strength/WOD; moderate/severe → cancel all training in 7-day window; severe → additional recovery week (days 7–13)
  - [x] **Injury:** mild → downgrade affected modality this week; moderate → 2 weeks; severe → all remaining weeks
  - [x] **Fatigue:** mild → acknowledge only; moderate → downgrade intervals/tempo runs; severe → cancel WOD, add deload note to Strength
  - [x] **Missed session:** three-option picker (continue / move to tomorrow if rest day / drop)
  - [x] **Scheduling conflict:** same as missed_session
- [x] Multi-turn clarification flow (needsClarification + follow-up chips)
- [x] `priorContext` carried across turns so follow-up answers fill in missing severity/modality
- [x] Graceful fallback: `incidentType === "general"` falls through to adapt-plan flow
- [x] Edge case: future session classified as "missed" → corrected response; rest day → corrected response
- [x] `IncidentResponse`, `IncidentPriorContext`, `MissedSessionOption`, `IncidentType` types defined

---

## Phase E — Historical Review + Analytics — Complete

> PLAN.md shows these as unchecked (`[ ]`), but the code fully implements them.

- [x] `lib/analytics.ts` — pure computation layer:
  - [x] `computeWeekMetrics()` — completion rate, per-category stats, run comparisons
  - [x] `computeBlockMetrics()` — block-level aggregation
  - [x] `computeBlockSummary()` — snapshot written to Firestore on block completion
  - [x] `computeInsights()` — pattern signals over last N weeks (warning / positive / info)
- [x] `ReviewView` component — block completion rate, per-category adherence, run plan vs actual table
- [x] Insight signals displayed on Plan tab ("Based on recent weeks")
- [x] Insight signals injected into AI prompts (adapt-plan + handle-incident) as context
- [x] Cross-block trend signals in Plan → Block History section (uses `BlockSummary` snapshots)
- [x] `BlockSummary` written when block is completed (completionRate, adherence per modality, incidentCount)

---

## Phase F — Multi-Block Planning — Partially Complete

- [x] Queue a next block (stub document with name, dates, `status: "queued"`)
- [x] View completed block history (Plan → History section with summary stats)
- [x] Remove queued block
- [ ] **"Activate → Generate Plan" button is not wired.** The button exists in `PlanView.tsx` but its `onClick` is empty.
- [ ] Transition logic when queued block activates (should auto-complete active block + generate sessions)
- [ ] Multiple completed blocks in history beyond the current display (display is present; generation/activation flow is incomplete)

---

## Not Started / Not Documented in PLAN.md

- Notifications / reminders (no PWA, no push)
- Offline support
- Multi-user / team features
- Import from Garmin / Strava / Apple Health
- Strength 1RM tracking over time
- Progressive overload tracking across blocks
- User-adjustable training volume preferences

---

## PLAN.md vs Code Discrepancy Summary

| PLAN.md says | Reality |
|---|---|
| Phase D items are `[ ]` (not done) | Fully implemented in `handle-incident/route.ts` and `CoachChat.tsx` |
| Phase E items are `[ ]` (not done) | Fully implemented in `analytics.ts`, `ReviewView.tsx`, `PlanView.tsx` |
| Phase F items are `[ ]` (not done) | Queue + history display are done; activation flow is partially wired |
| `handleCreateBlock` uses "hardcoded" prescriptions | Replaced — uses Gemini AI for all prescriptions |

> **PLAN.md is stale for Phases D and E.** The checklist was not updated after implementation. The code is ahead of the documented roadmap.
