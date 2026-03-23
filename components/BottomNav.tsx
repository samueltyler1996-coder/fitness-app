"use client";

export type Zone = "now" | "block" | "coach" | "progress";

interface Props {
  zone: Zone;
  onChange: (z: Zone) => void;
  todayDone: boolean;
  hasTodaySession: boolean;
}

function NowIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="3" fill={active ? "white" : "#6b6560"} />
      <circle cx="10" cy="10" r="7" stroke={active ? "white" : "#6b6560"} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function BlockIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#6b6560";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="2" width="3.5" height="3.5" rx="0.5" fill={c} />
      <rect x="7" y="2" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.5" />
      <rect x="12" y="2" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.3" />
      <rect x="2" y="7" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.7" />
      <rect x="7" y="7" width="3.5" height="3.5" rx="0.5" fill={c} />
      <rect x="12" y="7" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.5" />
      <rect x="2" y="12" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.3" />
      <rect x="7" y="12" width="3.5" height="3.5" rx="0.5" fill={c} opacity="0.5" />
      <rect x="12" y="12" width="3.5" height="3.5" rx="0.5" fill={c} />
    </svg>
  );
}

function CoachIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#6b6560";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 2C5.58 2 2 5.13 2 9c0 2.1 1.02 3.98 2.64 5.3L4 17l3.16-1.34C7.99 15.87 8.98 16 10 16c4.42 0 8-3.13 8-7s-3.58-7-8-7z"
        fill={c}
        opacity={active ? 1 : 0.9}
      />
    </svg>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  const c = active ? "white" : "#6b6560";
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="12" width="3" height="6" rx="0.5" fill={c} opacity="0.4" />
      <rect x="6.5" y="8" width="3" height="10" rx="0.5" fill={c} opacity="0.6" />
      <rect x="11" y="5" width="3" height="13" rx="0.5" fill={c} opacity="0.8" />
      <rect x="15.5" y="2" width="3" height="16" rx="0.5" fill={c} />
    </svg>
  );
}

const TABS: { id: Zone; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "block", label: "Block" },
  { id: "coach", label: "Coach" },
  { id: "progress", label: "Progress" },
];

export default function BottomNav({ zone, onChange, todayDone, hasTodaySession }: Props) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-stone-950 border-t border-stone-800 z-50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-[430px] mx-auto flex">
        {TABS.map(tab => {
          const active = zone === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-opacity active:opacity-70"
            >
              <div className="relative">
                {tab.id === "now" && <NowIcon active={active} />}
                {tab.id === "block" && <BlockIcon active={active} />}
                {tab.id === "coach" && <CoachIcon active={active} />}
                {tab.id === "progress" && <ProgressIcon active={active} />}

                {/* Status dot — NOW tab only */}
                {tab.id === "now" && hasTodaySession && (
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-stone-950 ${
                      todayDone ? "bg-emerald-500" : "bg-stone-600"
                    }`}
                  />
                )}
              </div>
              <span
                className={`text-[9px] tracking-[0.12em] uppercase font-medium transition-colors ${
                  active ? "text-white" : "text-stone-600"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
