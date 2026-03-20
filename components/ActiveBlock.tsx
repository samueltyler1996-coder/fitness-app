import { TrainingBlock, TrainingWeek } from "../lib/types";

interface Props {
  block: TrainingBlock;
  weeks: TrainingWeek[];
}

export default function ActiveBlock({ block, weeks }: Props) {
  const allSessions = weeks.flatMap(w => w.sessions).filter(s => s.category && s.category !== "Rest");
  const completed = allSessions.filter(s => s.completed).length;
  const total = allSessions.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="p-4 border rounded">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h2 className="text-lg font-semibold">{block.name}</h2>
          <p className="text-sm text-gray-500">{block.startDate} → {block.endDate}</p>
        </div>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Active</span>
      </div>

      <div>
        <div className="flex justify-between text-sm text-gray-600 mb-1">
          <span>{completed} of {total} sessions done</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
