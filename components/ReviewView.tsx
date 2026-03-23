import { TrainingBlock, TrainingWeek } from "../lib/types";
import { computeBlockMetrics, computeInsights } from "../lib/analytics";

interface Props {
  activeBlock: TrainingBlock | null;
  weeks: TrainingWeek[];
}

const CATS = ["Run", "Strength", "WOD"] as const;

const CAT_BAR: Record<string, string> = {
  Run: "bg-stone-700",
  Strength: "bg-stone-600",
  WOD: "bg-stone-500",
};

function pct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

function weekSquareColor(rate: number, hasSessions: boolean) {
  if (!hasSessions) return "bg-stone-100";
  if (rate >= 0.8) return "bg-emerald-400";
  if (rate >= 0.5) return "bg-amber-300";
  return "bg-red-400";
}

export default function ReviewView({ activeBlock, weeks }: Props) {
  if (!activeBlock || weeks.length === 0) {
    return <p className="text-sm text-stone-400">No training data yet.</p>;
  }

  const metrics = computeBlockMetrics(weeks);
  const insights = computeInsights(weeks);

  return (
    <div className="flex flex-col gap-8">

      {/* Block headline */}
      <div>
        <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">{activeBlock.name}</p>
        <div className="flex items-end gap-6 mb-3">
          <div>
            <p className="font-display font-black text-stone-900 leading-none" style={{ fontSize: "52px" }}>{pct(metrics.completionRate)}</p>
            <p className="text-[11px] text-stone-400 mt-1">{metrics.completedSessions} of {metrics.totalSessions} sessions done</p>
          </div>
        </div>
        {metrics.completionRate >= 0.8 && (
          <p className="text-[12px] text-stone-500 pl-3 border-l-2 border-stone-300">On track. Keep the consistency going.</p>
        )}
        {metrics.completionRate < 0.6 && metrics.totalSessions > 0 && (
          <p className="text-[12px] text-stone-500 pl-3 border-l-2 border-stone-300">Completion is low — worth reviewing what's getting skipped.</p>
        )}
      </div>

      {/* Week-by-week grid */}
      <div>
        <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-3">Week by week</p>
        <div className="flex gap-1.5 flex-wrap">
          {metrics.weekMetrics.map((wm, i) => (
            <div key={wm.weekId} className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded ${weekSquareColor(wm.completionRate, wm.totalSessions > 0)}`}
                title={`W${i + 1}: ${pct(wm.completionRate)} · ${wm.completedSessions}/${wm.totalSessions} sessions`}
              />
              <span className="text-[9px] text-stone-400">W{i + 1}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2.5">
          {[
            { label: "≥80%", color: "bg-emerald-400" },
            { label: "50–79%", color: "bg-amber-300" },
            { label: "<50%", color: "bg-red-400" },
          ].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1 text-[9px] text-stone-400">
              <span className={`w-2 h-2 rounded-sm inline-block ${color}`} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-3">By session type</p>
        <div className="flex flex-col gap-3">
          {CATS.map(cat => {
            const s = metrics.byCategory[cat];
            if (s.planned === 0) return null;
            return (
              <div key={cat}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-stone-600">{cat}</span>
                  <span className="text-stone-400">
                    {s.completed}/{s.planned} · {pct(s.rate)}
                  </span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${CAT_BAR[cat]}`}
                    style={{ width: pct(s.rate) }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Run log — plan vs actual */}
      {metrics.runComparisons.length > 0 && (
        <div>
          <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-3">Run log</p>
          <div className="flex flex-col">
            {metrics.runComparisons.slice(-12).map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs py-2 border-b border-stone-100 last:border-0"
              >
                <span className="text-stone-400 w-12">{r.day.slice(0, 3)}</span>
                <span className="text-stone-700">
                  {r.actualKm != null ? `${r.actualKm} km` : "—"}
                </span>
                <span className="text-stone-300">
                  {r.plannedKm != null ? `planned ${r.plannedKm} km` : ""}
                </span>
                {r.effort && (
                  <span className={`capitalize text-[10px] ${
                    r.effort === "hard" ? "text-red-400" :
                    r.effort === "easy" ? "text-emerald-500" :
                    "text-amber-500"
                  }`}>
                    {r.effort}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patterns / insights */}
      {insights.length > 0 && (
        <div className="flex flex-col gap-2">
          {insights.map((signal, i) => (
            <p key={i} className="text-[12px] text-stone-500 leading-relaxed pl-3 border-l-2 border-stone-200">
              {signal.message}
            </p>
          ))}
        </div>
      )}

      {insights.length === 0 && metrics.weekMetrics.filter(w => w.totalSessions > 0).length < 2 && (
        <p className="text-xs text-stone-400">Complete a few weeks to see patterns here.</p>
      )}

    </div>
  );
}
