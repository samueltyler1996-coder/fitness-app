export type Day = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
export type Category = "Run" | "Strength" | "WOD" | "Rest" | null;

// ─── Run ─────────────────────────────────────────────────────────────────────

export interface RunInterval {
  reps: number;
  distanceM?: number;
  durationSec?: number;
  targetPace?: string;
  restSec?: number;
  notes?: string;
}

export interface RunPrescription {
  type: "easy" | "tempo" | "long" | "intervals";
  distanceKm?: number;
  targetPace?: string;
  guidance?: string;
  intervals?: RunInterval[];
}

// ─── Strength ─────────────────────────────────────────────────────────────────

export interface StrengthExercise {
  name: string;
  type?: "mobility" | "activation" | "strength" | "accessory" | "finisher";
  sets?: number;
  reps?: string;
  load?: string;
  restSec?: number;
  tempo?: string;
  notes?: string;
  rounds?: number;
  items?: string[];
}

export interface StrengthPrescription {
  focus: "upper" | "lower" | "full" | "pull" | "push" | "core";
  goal?: "strength" | "hypertrophy" | "power" | "maintenance";
  durationMin?: number;
  guidance?: string;
  sections: {
    warmup?: StrengthExercise[];
    main?: StrengthExercise[];
    accessory?: StrengthExercise[];
    finisher?: StrengthExercise[];
    cooldown?: StrengthExercise[];
  };
}

// ─── WOD / HIIT / Hyrox ──────────────────────────────────────────────────────

export interface WodStation {
  movement: string;
  distance?: string;
  reps?: number;
  calories?: number;
  duration?: string;
  load?: string;
  notes?: string;
}

export interface WodPrescription {
  format: "for_time" | "amrap" | "emom" | "intervals" | "stations";
  focus?: "hyrox_conditioning" | "hiit" | "threshold" | "mixed_engine";
  durationCapMin?: number;
  guidance?: string;
  sections: {
    warmup?: { name: string; duration?: string; notes?: string }[];
    main: {
      wodName?: string;
      structure?: string;
      rounds?: number;
      workSec?: number;
      restSec?: number;
      targetEffort?: string;
      rest?: string;
      stations: WodStation[];
    };
    cooldown?: { name: string; duration?: string; notes?: string }[];
  };
}

// ─── Rest ─────────────────────────────────────────────────────────────────────

export interface RestPrescription {
  guidance?: string;
  recoveryType?: "full_rest" | "walk" | "mobility" | "stretching";
  durationMin?: number;
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type Prescription = RunPrescription | StrengthPrescription | WodPrescription | RestPrescription;

// ─── Actual ───────────────────────────────────────────────────────────────────

export interface Actual {
  distanceKm?: number | null;
  pace?: string | null;
  effort?: "easy" | "moderate" | "hard" | null;
  notes?: string | null;
  rawText?: string;
  // Strava-enriched fields
  avgHr?: number | null;
  elevationGain?: number | null;  // metres
  sufferScore?: number | null;
  workoutType?: string | null;    // "race" | "long_run" | "workout"
  achievements?: number | null;   // PR count
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  day: Day;
  category: Category;
  completed: boolean;
  prescription: Prescription;
  actual: Actual;
  aiGenerated: boolean;
  manuallyModified: boolean;
}

// ─── Training structure ───────────────────────────────────────────────────────

export interface TrainingWeek {
  id: string;
  startDate: string;
  endDate: string;
  sessions: Session[];
}

export interface BlockSummary {
  completionRate: number;       // 0–1
  completedSessions: number;
  totalSessions: number;
  runAdherence?: number;        // 0–1, only if block had run sessions
  strengthAdherence?: number;   // 0–1, only if block had strength sessions
  wodAdherence?: number;        // 0–1, only if block had WOD sessions
  incidentCount?: number;
  completedAt: string;          // ISO date string, snapshot frozen at completion
  // Run actuals — derived from session.actual at completion time
  totalActualKm?: number;       // total km logged across all completed run sessions
  longestActualRunKm?: number;  // longest single completed run in the block
  avgEasyPaceSecs?: number;     // average easy run pace in seconds/km (lower = faster)
}

export interface TrainingBlock {
  id: string;
  name: string;
  primaryGoal: string;
  status: "active" | "completed" | "queued";
  startDate: string;
  endDate: string;
  summary?: BlockSummary;       // written when status → "completed", absent on active/queued
}

// ─── Coach ────────────────────────────────────────────────────────────────────

export interface SessionChange {
  weekId: string;
  sessionId: string;
  day: string;
  category: Category;
  prescription: Prescription;
}

export interface CoachSessionChange {
  weekId: string;
  sessionId: string;
  day: string;
  fromCategory: Category;
  fromPrescription: Prescription;
  toCategory: Category;
  toPrescription: Prescription;
}

export interface CoachSessionLog {
  id: string;
  appliedAt: { seconds: number; nanoseconds: number };
  firstMessage: string;
  summary: string;
  changesCount: number;
  changes: CoachSessionChange[];
  incidentType?: IncidentType;  // set when session originated from handle-incident
}

export interface AdaptResponse {
  summary: string;
  changes: SessionChange[];
}

// ─── Incidents ────────────────────────────────────────────────────────────────

export type IncidentType =
  | "illness"
  | "injury"
  | "missed_session"
  | "scheduling_conflict"
  | "fatigue"
  | "general";

export interface MissedSessionOption {
  id: string;
  label: string;
  description: string;
  changes: SessionChange[];
}

export interface IncidentPriorContext {
  type: IncidentType;
  severity?: string | null;
  affectedModality?: string | null;
  affectedDay?: string | null;
}

export interface IncidentResponse {
  incidentType: IncidentType;
  severity?: string | null;
  affectedModality?: string | null;
  summary: string | null;
  changes: SessionChange[];
  followUpChips?: string[] | null;
  options?: MissedSessionOption[] | null;
  priorContext?: IncidentPriorContext | null;
}
