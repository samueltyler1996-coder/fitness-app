"use client";

import {
  TrainingBlock, TrainingWeek, Category, Day, Actual, Prescription, SessionChange,
} from "../lib/types";
import PlanView from "./PlanView";

interface Props {
  uid: string;
  activeBlock: TrainingBlock | null;
  queuedBlock: TrainingBlock | null;
  completedBlocks: TrainingBlock[];
  weeks: TrainingWeek[];
  currentWeek: TrainingWeek | null;
  todayDay: Day;
  goal: string;
  eventDate: string;
  creating: boolean;
  stravaAthleteInfo: string | null;
  stravaToken?: string;
  onGoalChange: (v: string) => void;
  onEventDateChange: (v: string) => void;
  onSave: () => Promise<void>;
  onCreateBlock: () => Promise<void>;
  onToggleSession: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onLogActual: (blockId: string, weekId: string, sessionId: string, actual: Actual) => void;
  onCategoryChange: (blockId: string, weekId: string, sessionId: string, newCategory: Category) => void;
  onEditPrescription: (blockId: string, weekId: string, sessionId: string, newCategory: Category, newPrescription: Prescription) => Promise<void>;
  onApplyChanges: (changes: SessionChange[], meta: { firstMessage: string; summary: string }) => Promise<void>;
  onQueueBlock: (goal: string, numWeeks: number) => Promise<void>;
  onRemoveQueuedBlock: () => Promise<void>;
  onActivateQueuedBlock: () => Promise<void>;
  expandedBlockData: Map<string, TrainingWeek[]>;
  expandingBlockId: string | null;
  onExpandCompletedBlock: (blockId: string) => void;
}

export default function BlockZone(props: Props) {
  return (
    <div className="min-h-screen bg-[#f8f6f3] px-5 pt-10 pb-8">
      <PlanView {...props} />
    </div>
  );
}
