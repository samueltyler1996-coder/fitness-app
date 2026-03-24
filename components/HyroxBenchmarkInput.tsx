"use client";

import { useState } from "react";
import { HyroxBenchmarks } from "../lib/types";

interface Props {
  benchmarks: HyroxBenchmarks | null;
  onSave: (b: HyroxBenchmarks) => Promise<void>;
}

interface StationConfig {
  key: keyof Omit<HyroxBenchmarks, "weightCategory" | "lastUpdated">;
  label: string;
  isReps: boolean;
  defaultSeconds: number;
}

const STATIONS: StationConfig[] = [
  { key: "skiErg",         label: "SkiErg 1000m",          isReps: false, defaultSeconds: 240 },
  { key: "sledPush",       label: "Sled Push 50m",          isReps: false, defaultSeconds: 30  },
  { key: "sledPull",       label: "Sled Pull 50m",          isReps: false, defaultSeconds: 30  },
  { key: "burpeeBroadJump",label: "Burpee Broad Jump 80m",  isReps: false, defaultSeconds: 180 },
  { key: "rowing",         label: "Rowing 1000m",           isReps: false, defaultSeconds: 240 },
  { key: "farmersCarry",   label: "Farmer's Carry 200m",    isReps: false, defaultSeconds: 90  },
  { key: "sandbagLunges",  label: "Sandbag Lunges 100m",    isReps: false, defaultSeconds: 180 },
  { key: "wallBalls",      label: "Wall Balls (reps/2min)", isReps: true,  defaultSeconds: 60  },
];

function secsToMmss(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function mmssToSecs(val: string): number | null {
  const parts = val.split(":");
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(s) || s < 0 || s > 59) return null;
  return m * 60 + s;
}

function initTimeInputs(benchmarks: HyroxBenchmarks | null): Record<string, string> {
  const result: Record<string, string> = {};
  for (const st of STATIONS) {
    if (st.isReps) {
      result[st.key] = benchmarks ? String(benchmarks[st.key]) : String(st.defaultSeconds);
    } else {
      result[st.key] = benchmarks ? secsToMmss(benchmarks[st.key] as number) : secsToMmss(st.defaultSeconds);
    }
  }
  return result;
}

export default function HyroxBenchmarkInput({ benchmarks, onSave }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [inputs, setInputs] = useState<Record<string, string>>(() => initTimeInputs(benchmarks));
  const [weightCategory, setWeightCategory] = useState<"male" | "female">(benchmarks?.weightCategory ?? "male");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    setInputs(initTimeInputs(benchmarks));
    setWeightCategory(benchmarks?.weightCategory ?? "male");
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setError(null);
    const values: Partial<Record<keyof Omit<HyroxBenchmarks, "weightCategory" | "lastUpdated">, number>> = {};
    for (const st of STATIONS) {
      const raw = inputs[st.key]?.trim();
      if (st.isReps) {
        const n = parseInt(raw, 10);
        if (isNaN(n) || n <= 0) { setError(`${st.label}: enter a valid rep count`); return; }
        values[st.key] = n;
      } else {
        const secs = mmssToSecs(raw);
        if (secs === null || secs <= 0) { setError(`${st.label}: enter a valid MM:SS time`); return; }
        values[st.key] = secs;
      }
    }

    setSaving(true);
    try {
      await onSave({
        skiErg: values.skiErg!,
        sledPush: values.sledPush!,
        sledPull: values.sledPull!,
        burpeeBroadJump: values.burpeeBroadJump!,
        rowing: values.rowing!,
        farmersCarry: values.farmersCarry!,
        sandbagLunges: values.sandbagLunges!,
        wallBalls: values.wallBalls!,
        weightCategory,
        lastUpdated: new Date().toISOString(),
      });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  if (benchmarks && !showForm) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <p className="text-[10px] tracking-[0.12em] uppercase text-stone-400">Hyrox Benchmarks</p>
        </div>
        <button
          onClick={handleOpen}
          className="text-[10px] tracking-[0.12em] uppercase text-stone-300 hover:text-stone-500 transition-colors"
        >
          Edit
        </button>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[0.12em] uppercase text-stone-400">Hyrox Benchmarks</p>
          <button
            onClick={() => setShowForm(false)}
            className="text-[10px] tracking-[0.12em] uppercase text-stone-300 hover:text-stone-500 transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Weight category */}
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-stone-500 shrink-0">Category</p>
          <div className="flex gap-2">
            {(["male", "female"] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setWeightCategory(cat)}
                className={`text-[10px] tracking-[0.1em] uppercase px-3 py-1 rounded-lg border transition-colors ${
                  weightCategory === cat
                    ? "border-stone-700 bg-stone-900 text-white"
                    : "border-stone-200 text-stone-400 hover:text-stone-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Station inputs */}
        <div className="flex flex-col gap-2">
          {STATIONS.map(st => (
            <div key={st.key} className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-stone-600 leading-tight">{st.label}</p>
              <input
                type={st.isReps ? "number" : "text"}
                value={inputs[st.key] ?? ""}
                onChange={e => setInputs(prev => ({ ...prev, [st.key]: e.target.value }))}
                placeholder={st.isReps ? "60" : "0:30"}
                className="w-20 text-[11px] bg-transparent border-b border-stone-300 pb-0.5 text-stone-700 placeholder:text-stone-300 outline-none text-right"
              />
            </div>
          ))}
        </div>

        {error && (
          <p className="text-[10px] text-red-500">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="text-[10px] tracking-[0.12em] uppercase text-stone-700 disabled:text-stone-300 transition-colors self-start"
        >
          {saving ? "Saving…" : "Save benchmarks"}
        </button>
      </div>
    );
  }

  // No benchmarks yet — show connect button
  return (
    <button
      onClick={handleOpen}
      className="text-[10px] tracking-[0.12em] uppercase text-stone-300 hover:text-stone-500 transition-colors"
    >
      + Add Hyrox Benchmarks
    </button>
  );
}
