import { TrainingBlock, TrainingWeek, Session, Day, Actual } from "../lib/types";
import { computeInsights } from "../lib/analytics";
import TodayWorkout from "./TodayWorkout";
import ActiveBlock from "./ActiveBlock";
import InsightCard from "./InsightCard";

interface Props {
  activeBlock: TrainingBlock | null;
  weeks: TrainingWeek[];
  currentWeek: TrainingWeek | null;
  todaySession: Session | null;
  todayDay: Day;
  goal: string;
  eventDate: string;
  stravaToken?: string;
  onToggleSession: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onLogActual: (blockId: string, weekId: string, sessionId: string, actual: Actual) => void;
}

export default function TodayView({
  activeBlock, weeks, currentWeek, todaySession, todayDay, goal, eventDate, stravaToken,
  onToggleSession, onLogActual,
}: Props) {
  const insights = computeInsights(weeks, 4);
  const surfacedInsights = insights.filter(s => s.type === "warning").slice(0, 2);

  return (
    <>
      <TodayWorkout
        session={todaySession}
        blockId={activeBlock?.id ?? null}
        weekId={currentWeek?.id ?? null}
        stravaToken={stravaToken}
        onToggle={onToggleSession}
        onLogActual={onLogActual}
      />

      {activeBlock && (
        <ActiveBlock block={activeBlock} weeks={weeks} goal={goal} eventDate={eventDate} />
      )}

      {surfacedInsights.length > 0 && (
        <div className="flex flex-col gap-2">
          {surfacedInsights.map((signal, i) => (
            <InsightCard key={i} signal={signal} />
          ))}
        </div>
      )}
    </>
  );
}
