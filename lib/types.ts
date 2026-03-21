export type Day = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
export type Category = "Run" | "Strength" | "Rest" | null;

export interface Prescription {
  type?: string;
  distanceKm?: number;
  targetPace?: string;
  guidance?: string;
  focus?: string;
}

export interface Actual {
  distanceKm?: number | null;
  pace?: string | null;
  effort?: "easy" | "moderate" | "hard" | null;
  notes?: string | null;
  rawText?: string;
}

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

export interface TrainingWeek {
  id: string;
  startDate: string;
  endDate: string;
  sessions: Session[];
}

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

export interface TrainingBlock {
  id: string;
  name: string;
  primaryGoal: string;
  status: "active" | "completed";
  startDate: string;
  endDate: string;
}
