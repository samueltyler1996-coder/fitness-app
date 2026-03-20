import { Session } from "../lib/types";

interface Props {
  session: Session | null;
}

const RUN_TYPE_LABEL: Record<string, string> = {
  easy: "Easy Run",
  tempo: "Tempo Run",
  long: "Long Run",
  intervals: "Intervals",
};

export default function TodayWorkout({ session }: Props) {
  if (!session) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">Today</p>
        <p className="text-sm text-gray-500">No session scheduled.</p>
      </div>
    );
  }

  const isRest = session.category === "Rest";
  const isRun = session.category === "Run";
  const isStrength = session.category === "Strength";

  const categoryColor = isRun
    ? "bg-blue-50 border-blue-200"
    : isStrength
    ? "bg-orange-50 border-orange-200"
    : "bg-gray-50 border-gray-200";

  const badgeColor = isRun
    ? "bg-blue-100 text-blue-700"
    : isStrength
    ? "bg-orange-100 text-orange-700"
    : "bg-gray-100 text-gray-500";

  const runLabel = RUN_TYPE_LABEL[session.prescription?.type ?? ""] ?? session.prescription?.type ?? "";

  return (
    <div className={`p-4 border rounded-lg ${categoryColor}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Today · {session.day}</p>

      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          {isRun && (
            <>
              <p className="text-xl font-bold">{runLabel}</p>
              <div className="flex items-center gap-3 text-sm font-medium mt-1">
                <span>{session.prescription?.distanceKm} km</span>
                <span className="text-gray-300">·</span>
                <span>{session.prescription?.targetPace}</span>
              </div>
              {session.prescription?.guidance && (
                <p className="text-sm text-gray-500 mt-1">{session.prescription.guidance}</p>
              )}
            </>
          )}

          {isStrength && (
            <>
              <p className="text-xl font-bold capitalize">{session.prescription?.focus} Strength</p>
              {session.prescription?.guidance && (
                <p className="text-sm text-gray-500 mt-1">{session.prescription.guidance}</p>
              )}
            </>
          )}

          {isRest && (
            <p className="text-xl font-bold">Rest Day</p>
          )}

          {!session.category && (
            <p className="text-sm text-gray-400">No prescription set.</p>
          )}
        </div>

        <span className={`text-xs px-2 py-1 rounded-full shrink-0 ml-3 ${badgeColor}`}>
          {session.category ?? "—"}
        </span>
      </div>

      <div className="mt-3">
        <span className={`text-xs px-2 py-1 rounded-full ${session.completed ? "bg-green-100 text-green-700" : "bg-white text-gray-400 border"}`}>
          {session.completed ? "Completed" : "Not done yet"}
        </span>
      </div>
    </div>
  );
}
