export type Day = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
export type Category = "Run" | "Strength" | "Rest" | null;

export interface Prescription {
  type?: string;
  distanceKm?: number;
  targetPace?: string;
  guidance?: string;
  focus?: string;
}

export interface Session {
  id: string;
  day: Day;
  category: Category;
  completed: boolean;
  prescription: Prescription;
  actual: Record<string, unknown>;
  aiGenerated: boolean;
  manuallyModified: boolean;
}

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
