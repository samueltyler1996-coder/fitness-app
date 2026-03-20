# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands must be run from the `fitness-app/` directory.

```bash
npm run dev      # Start dev server at http://localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test suite is configured.

## Architecture

This is a **Next.js 16 / React 19 / TypeScript** app using **Tailwind CSS v4** and **Firebase** (Auth + Firestore).

### Structure

- `app/page.tsx` — The entire application UI and logic lives here as a single client component (`"use client"`). Auth state, Firestore reads/writes, and all rendering are colocated.
- `lib/firebase.ts` — Initializes the Firebase app and exports `auth` (Firebase Auth) and `db` (Firestore instance). Config is read from `NEXT_PUBLIC_FIREBASE_*` env vars.
- `.env.local` — Firebase project credentials (not committed).

### Firestore Data Model

```
users/{uid}
  currentGoal: string
  eventDate: string

users/{uid}/trainingBlocks/{blockId}
  name, primaryGoal, status ("active"|"completed"), startDate, endDate

users/{uid}/trainingBlocks/{blockId}/trainingWeeks/{weekId}
  startDate, endDate

users/{uid}/trainingBlocks/{blockId}/trainingWeeks/{weekId}/sessions/{sessionId}
  day: "Monday"…"Sunday"
  category: "Run" | "Strength" | "Rest" | null
  completed: boolean
  prescription: { type?, distanceKm?, targetPace?, guidance?, focus? }
  actual: {}
  aiGenerated: boolean
  manuallyModified: boolean
```

Only one block has `status === "active"` at a time. Creating a new block marks any existing active block as `"completed"`.

### Key Behaviours

- Google OAuth sign-in via `signInWithPopup`.
- On auth, the app fetches the active training block, all its weeks (ordered by `startDate`), and all sessions per week. Sessions are sorted client-side by day-of-week order.
- "Today's session" is determined by matching today's date range against week `startDate`/`endDate` and today's weekday name against `session.day`.
- `handleCreateBlock` generates a hardcoded 6-week block with 7 placeholder sessions per week, then populates week 1 with hardcoded prescriptions.
- Session completion toggles and category changes are written to Firestore and also applied optimistically to local React state.
