import { Session, Category } from "../lib/types";

interface Props {
  session: Session;
  blockId: string;
  weekId: string;
  onToggle: (blockId: string, weekId: string, sessionId: string, current: boolean) => void;
  onCategoryChange: (blockId: string, weekId: string, sessionId: string, category: Category) => void;
}

export default function SessionRow({ session, blockId, weekId, onToggle, onCategoryChange }: Props) {
  return (
    <div
      onClick={() => onToggle(blockId, weekId, session.id, session.completed)}
      className="border-b py-2 cursor-pointer hover:bg-gray-50"
    >
      <div className="flex flex-col w-full">
        <div className="flex justify-between items-center">
          <span className="font-medium">{session.day}</span>

          <div className="flex items-center gap-3">
            <select
              value={session.category || ""}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onCategoryChange(blockId, weekId, session.id, (e.target.value || null) as Category)}
              className="border rounded px-2 py-1 text-xs"
            >
              <option value="">—</option>
              <option value="Run">Run</option>
              <option value="Strength">Strength</option>
              <option value="Rest">Rest</option>
            </select>

            <span>{session.completed ? "✅" : "⬜"}</span>
          </div>
        </div>

        {session.prescription && Object.keys(session.prescription).length > 0 && (
          <div className="text-xs text-gray-600 mt-1">
            {session.category === "Run" && (
              <>
                <div>Type: {session.prescription.type} · {session.prescription.distanceKm} km · {session.prescription.targetPace}</div>
                {session.prescription.guidance && <div className="italic">{session.prescription.guidance}</div>}
              </>
            )}
            {session.category === "Strength" && (
              <>
                <div>Focus: {session.prescription.focus}</div>
                {session.prescription.guidance && <div className="italic">{session.prescription.guidance}</div>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
