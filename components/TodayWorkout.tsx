import { Session } from "../lib/types";

interface Props {
  session: Session | null;
}

export default function TodayWorkout({ session }: Props) {
  if (!session) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-1">Today's Workout</h2>
        <p className="text-sm text-gray-500">No session found for today.</p>
      </div>
    );
  }

  return (
    <div className="p-4 border-2 border-blue-400 rounded-lg bg-blue-50">
      <h2 className="text-lg font-semibold mb-2">Today's Workout</h2>
      <div className="text-sm">
        <div className="font-medium text-base mb-1">{session.day}</div>

        {session.category === "Run" && (
          <div className="flex flex-col gap-1">
            <div><span className="text-gray-500">Type:</span> {session.prescription?.type}</div>
            <div><span className="text-gray-500">Distance:</span> {session.prescription?.distanceKm} km</div>
            <div><span className="text-gray-500">Pace:</span> {session.prescription?.targetPace}</div>
            {session.prescription?.guidance && (
              <div className="text-gray-600 italic mt-1">{session.prescription.guidance}</div>
            )}
          </div>
        )}

        {session.category === "Strength" && (
          <div className="flex flex-col gap-1">
            <div><span className="text-gray-500">Focus:</span> {session.prescription?.focus}</div>
            {session.prescription?.guidance && (
              <div className="text-gray-600 italic mt-1">{session.prescription.guidance}</div>
            )}
          </div>
        )}

        {session.category === "Rest" && (
          <div className="text-gray-600">Rest day — recover well.</div>
        )}

        {!session.category && (
          <div className="text-gray-400">No prescription set for today.</div>
        )}

        <div className="mt-3">
          <span className={`text-xs px-2 py-1 rounded-full ${session.completed ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
            {session.completed ? "Completed" : "Not done yet"}
          </span>
        </div>
      </div>
    </div>
  );
}
