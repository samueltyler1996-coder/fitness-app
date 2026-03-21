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

export interface TrainingBlock {
  id: string;
  name: string;
  primaryGoal: string;
  status: "active" | "completed";
  startDate: string;
  endDate: string;
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
}

export interface AdaptResponse {
  summary: string;
  changes: SessionChange[];
}
