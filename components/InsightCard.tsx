import { InsightSignal } from "../lib/analytics";

const STYLES = {
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    dot: "bg-amber-400",
    text: "text-amber-800",
  },
  positive: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    dot: "bg-emerald-400",
    text: "text-emerald-800",
  },
  info: {
    border: "border-stone-200",
    bg: "bg-stone-50",
    dot: "bg-stone-400",
    text: "text-stone-600",
  },
};

export default function InsightCard({ signal }: { signal: InsightSignal }) {
  const s = STYLES[signal.type];
  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${s.border} ${s.bg}`}>
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
      <p className={`text-xs leading-relaxed ${s.text}`}>{signal.message}</p>
    </div>
  );
}
