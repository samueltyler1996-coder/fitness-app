"use client";
import { useState } from "react";
import { Session, Category, Prescription } from "../lib/types";

const PACE_REGEX = /^\d{1,2}:\d{2}(\/km)?$/;

function validate(category: Category, p: any): Record<string, string> {
  const errs: Record<string, string> = {};

  if (category === "Run") {
    if (p.targetPace && !PACE_REGEX.test(p.targetPace.trim())) {
      errs.targetPace = "Use mm:ss or mm:ss/km";
    }
    if (p.distanceKm != null && p.distanceKm <= 0) {
      errs.distanceKm = "Must be > 0";
    }
  }

  if (category === "Strength") {
    (["warmup", "main", "accessory", "finisher", "cooldown"] as const).forEach(section => {
      (p.sections?.[section] ?? []).forEach((ex: any, i: number) => {
        if (!ex.name?.trim()) errs[`ex_${section}_${i}_name`] = "Name required";
        if (ex.sets != null && ex.sets <= 0) errs[`ex_${section}_${i}_sets`] = "Must be > 0";
      });
    });
  }

  if (category === "WOD") {
    if (p.durationCapMin != null && p.durationCapMin <= 0) {
      errs.durationCapMin = "Must be > 0";
    }
    (p.sections?.main?.stations ?? []).forEach((s: any, i: number) => {
      if (!s.movement?.trim()) errs[`station_${i}_movement`] = "Required";
    });
  }

  return errs;
}

interface Props {
  session: Session;
  onSave: (category: Category, prescription: Prescription) => Promise<void>;
  onClose: () => void;
}

const STRENGTH_SECTIONS = ["warmup", "main", "accessory", "finisher", "cooldown"] as const;
const SECTION_LABELS: Record<string, string> = {
  warmup: "Warmup", main: "Main", accessory: "Accessory", finisher: "Finisher", cooldown: "Cooldown",
};

export default function SessionEditModal({ session, onSave, onClose }: Props) {
  const [saving, setSaving] = useState(false);
  const [editedCategory, setEditedCategory] = useState<Category>(session.category);
  const [p, setP] = useState<any>(() => JSON.parse(JSON.stringify(session.prescription ?? {})));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const err = (key: string) => errors[key]
    ? <p className="text-[10px] text-red-400 mt-0.5">{errors[key]}</p>
    : null;
  const borderClass = (key: string) => errors[key] ? "border-red-300" : "border-stone-200";

  const setField = (field: string, value: any) => {
    setErrors({});
    setP((prev: any) => ({ ...prev, [field]: value }));
  };

  const updateExercise = (section: string, idx: number, field: string, value: any) =>
    setP((prev: any) => {
      const arr = [...(prev.sections?.[section] ?? [])];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, sections: { ...prev.sections, [section]: arr } };
    });

  const addExercise = (section: string) =>
    setP((prev: any) => {
      const arr = [...(prev.sections?.[section] ?? []), { name: "", sets: undefined, reps: "", load: "", notes: "" }];
      return { ...prev, sections: { ...prev.sections, [section]: arr } };
    });

  const removeExercise = (section: string, idx: number) =>
    setP((prev: any) => {
      const arr = (prev.sections?.[section] ?? []).filter((_: any, i: number) => i !== idx);
      return { ...prev, sections: { ...prev.sections, [section]: arr } };
    });

  const updateStation = (idx: number, field: string, value: any) =>
    setP((prev: any) => {
      const stations = [...(prev.sections?.main?.stations ?? [])];
      stations[idx] = { ...stations[idx], [field]: value };
      return { ...prev, sections: { ...prev.sections, main: { ...prev.sections?.main, stations } } };
    });

  const addStation = () =>
    setP((prev: any) => {
      const stations = [...(prev.sections?.main?.stations ?? []), { movement: "", distance: "", load: "" }];
      return { ...prev, sections: { ...prev.sections, main: { ...prev.sections?.main, stations } } };
    });

  const removeStation = (idx: number) =>
    setP((prev: any) => {
      const stations = (prev.sections?.main?.stations ?? []).filter((_: any, i: number) => i !== idx);
      return { ...prev, sections: { ...prev.sections, main: { ...prev.sections?.main, stations } } };
    });

  const handleSave = async () => {
    const errs = validate(editedCategory, p);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    await onSave(editedCategory, p as Prescription);
    setSaving(false);
  };

  const isRun = editedCategory === "Run";
  const isStrength = editedCategory === "Strength";
  const isWod = editedCategory === "WOD";
  const isRest = editedCategory === "Rest";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl max-h-[85vh] flex flex-col max-w-md w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 shrink-0">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">{session.day}</p>
            <p className="font-bold text-stone-900">{editedCategory ?? "Session"}</p>
          </div>
          <button onClick={onClose} className="text-stone-300 hover:text-stone-700 text-2xl leading-none">×</button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto px-5 py-5 flex flex-col gap-6">

          {/* Category */}
          <div>
            <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Category</p>
            <select
              value={editedCategory ?? ""}
              onChange={e => setEditedCategory((e.target.value || null) as Category)}
              className="border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full"
            >
              <option value="">—</option>
              <option value="Run">Run</option>
              <option value="Strength">Strength</option>
              <option value="WOD">WOD</option>
              <option value="Rest">Rest</option>
            </select>
          </div>

          {/* ── Run ── */}
          {isRun && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Type</p>
                  <select
                    value={p.type ?? "easy"}
                    onChange={e => setField("type", e.target.value)}
                    className="border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full"
                  >
                    <option value="easy">Easy</option>
                    <option value="tempo">Tempo</option>
                    <option value="long">Long</option>
                    <option value="intervals">Intervals</option>
                  </select>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Distance (km)</p>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={p.distanceKm ?? ""}
                    onChange={e => setField("distanceKm", e.target.value ? Number(e.target.value) : undefined)}
                    className={`border-0 border-b ${borderClass("distanceKm")} pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full`}
                  />
                  {err("distanceKm")}
                </div>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Target Pace</p>
                <input
                  type="text"
                  placeholder="e.g. 5:30/km"
                  value={p.targetPace ?? ""}
                  onChange={e => setField("targetPace", e.target.value)}
                  className={`border-0 border-b ${borderClass("targetPace")} pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full placeholder:text-stone-300`}
                />
                {err("targetPace")}
              </div>
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Guidance</p>
                <textarea
                  value={p.guidance ?? ""}
                  onChange={e => setField("guidance", e.target.value)}
                  rows={2}
                  className="w-full border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 resize-none"
                />
              </div>
            </>
          )}

          {/* ── Strength ── */}
          {isStrength && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Focus</p>
                  <select
                    value={p.focus ?? "full"}
                    onChange={e => setField("focus", e.target.value)}
                    className="border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full"
                  >
                    {["upper", "lower", "full", "pull", "push", "core"].map(f => (
                      <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Goal</p>
                  <select
                    value={p.goal ?? "strength"}
                    onChange={e => setField("goal", e.target.value)}
                    className="border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full"
                  >
                    {["strength", "hypertrophy", "power", "maintenance"].map(g => (
                      <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Guidance</p>
                <textarea
                  value={p.guidance ?? ""}
                  onChange={e => setField("guidance", e.target.value)}
                  rows={2}
                  className="w-full border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 resize-none"
                />
              </div>

              {STRENGTH_SECTIONS.map(section => {
                const exercises: any[] = p.sections?.[section] ?? [];
                return (
                  <div key={section}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400">{SECTION_LABELS[section]}</p>
                      <button
                        onClick={() => addExercise(section)}
                        className="text-[10px] tracking-[0.1em] uppercase text-stone-400 hover:text-stone-700"
                      >
                        + Add
                      </button>
                    </div>
                    {exercises.length === 0 && (
                      <p className="text-[11px] text-stone-200 italic pb-1">Empty</p>
                    )}
                    <div className="flex flex-col gap-4">
                      {exercises.map((ex: any, i: number) => (
                        <div key={i} className="flex flex-col gap-2 pl-3 border-l-2 border-stone-100">
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder="Exercise name"
                                value={ex.name ?? ""}
                                onChange={e => { setErrors({}); updateExercise(section, i, "name", e.target.value); }}
                                className={`w-full border-0 border-b ${borderClass(`ex_${section}_${i}_name`)} pb-1 text-sm font-medium bg-transparent focus:outline-none focus:border-stone-800 placeholder:text-stone-300`}
                              />
                              {err(`ex_${section}_${i}_name`)}
                            </div>
                            <button
                              onClick={() => removeExercise(section, i)}
                              className="text-stone-300 hover:text-red-400 text-lg leading-none shrink-0"
                            >
                              ×
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-[9px] uppercase tracking-wide text-stone-300 mb-1">Sets</p>
                              <input
                                type="number"
                                placeholder="3"
                                min="1"
                                value={ex.sets ?? ""}
                                onChange={e => { setErrors({}); updateExercise(section, i, "sets", e.target.value ? Number(e.target.value) : undefined); }}
                                className={`w-full border-0 border-b ${borderClass(`ex_${section}_${i}_sets`)} pb-1 text-sm bg-transparent focus:outline-none focus:border-stone-800 placeholder:text-stone-300`}
                              />
                              {err(`ex_${section}_${i}_sets`)}
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wide text-stone-300 mb-1">Reps</p>
                              <input
                                type="text"
                                placeholder="8–12"
                                value={ex.reps ?? ""}
                                onChange={e => updateExercise(section, i, "reps", e.target.value)}
                                className="w-full border-0 border-b border-stone-200 pb-1 text-sm bg-transparent focus:outline-none focus:border-stone-800 placeholder:text-stone-300"
                              />
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-wide text-stone-300 mb-1">Load</p>
                              <input
                                type="text"
                                placeholder="heavy"
                                value={ex.load ?? ""}
                                onChange={e => updateExercise(section, i, "load", e.target.value)}
                                className="w-full border-0 border-b border-stone-200 pb-1 text-sm bg-transparent focus:outline-none focus:border-stone-800 placeholder:text-stone-300"
                              />
                            </div>
                          </div>
                          <input
                            type="text"
                            placeholder="Notes (optional)"
                            value={ex.notes ?? ""}
                            onChange={e => updateExercise(section, i, "notes", e.target.value)}
                            className="w-full border-0 border-b border-stone-100 pb-1 text-[11px] text-stone-400 bg-transparent focus:outline-none focus:border-stone-400 placeholder:text-stone-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* ── WOD ── */}
          {isWod && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Format</p>
                  <select
                    value={p.format ?? "for_time"}
                    onChange={e => setField("format", e.target.value)}
                    className="border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full"
                  >
                    {["for_time", "amrap", "emom", "intervals", "stations"].map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Cap (min)</p>
                  <input
                    type="number"
                    min="1"
                    value={p.durationCapMin ?? ""}
                    onChange={e => setField("durationCapMin", e.target.value ? Number(e.target.value) : undefined)}
                    className={`border-0 border-b ${borderClass("durationCapMin")} pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full`}
                  />
                  {err("durationCapMin")}
                </div>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Structure</p>
                <input
                  type="text"
                  placeholder="e.g. 4 Rounds: 1km Run + Ski Erg 500m"
                  value={p.sections?.main?.structure ?? ""}
                  onChange={e => setP((prev: any) => ({
                    ...prev,
                    sections: { ...prev.sections, main: { ...prev.sections?.main, structure: e.target.value } },
                  }))}
                  className="border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full placeholder:text-stone-300"
                />
              </div>
              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Target Effort</p>
                <input
                  type="text"
                  placeholder="e.g. 85% threshold"
                  value={p.sections?.main?.targetEffort ?? ""}
                  onChange={e => setP((prev: any) => ({
                    ...prev,
                    sections: { ...prev.sections, main: { ...prev.sections?.main, targetEffort: e.target.value } },
                  }))}
                  className="border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full placeholder:text-stone-300"
                />
              </div>

              {/* Stations */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400">Stations</p>
                  <button
                    onClick={addStation}
                    className="text-[10px] tracking-[0.1em] uppercase text-stone-400 hover:text-stone-700"
                  >
                    + Add
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  {(p.sections?.main?.stations ?? []).map((station: any, i: number) => (
                    <div key={i} className="flex flex-col gap-2 pl-3 border-l-2 border-stone-100">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            placeholder="Movement"
                            value={station.movement ?? ""}
                            onChange={e => { setErrors({}); updateStation(i, "movement", e.target.value); }}
                            className={`w-full border-0 border-b ${borderClass(`station_${i}_movement`)} pb-1 text-sm font-medium bg-transparent focus:outline-none focus:border-stone-800 placeholder:text-stone-300`}
                          />
                          {err(`station_${i}_movement`)}
                        </div>
                        <button
                          onClick={() => removeStation(i)}
                          className="text-stone-300 hover:text-red-400 text-lg leading-none shrink-0"
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[9px] uppercase tracking-wide text-stone-300 mb-1">Distance / Reps</p>
                          <input
                            type="text"
                            placeholder="500m or 20 reps"
                            value={station.distance ?? (station.reps != null ? String(station.reps) : "")}
                            onChange={e => updateStation(i, "distance", e.target.value)}
                            className="w-full border-0 border-b border-stone-200 pb-1 text-sm bg-transparent focus:outline-none focus:border-stone-800 placeholder:text-stone-300"
                          />
                        </div>
                        <div>
                          <p className="text-[9px] uppercase tracking-wide text-stone-300 mb-1">Load</p>
                          <input
                            type="text"
                            placeholder="80kg"
                            value={station.load ?? ""}
                            onChange={e => updateStation(i, "load", e.target.value)}
                            className="w-full border-0 border-b border-stone-200 pb-1 text-sm bg-transparent focus:outline-none focus:border-stone-800 placeholder:text-stone-300"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Guidance</p>
                <textarea
                  value={p.guidance ?? ""}
                  onChange={e => setField("guidance", e.target.value)}
                  rows={2}
                  className="w-full border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 resize-none"
                />
              </div>
            </>
          )}

          {/* ── Rest ── */}
          {isRest && (
            <div>
              <p className="text-[10px] tracking-[0.15em] uppercase text-stone-400 mb-2">Recovery Type</p>
              <select
                value={p.recoveryType ?? "full_rest"}
                onChange={e => setField("recoveryType", e.target.value)}
                className="border-0 border-b border-stone-200 pb-1.5 text-sm bg-transparent focus:outline-none focus:border-stone-800 w-full"
              >
                {["full_rest", "walk", "mobility", "stretching"].map(r => (
                  <option key={r} value={r}>
                    {r.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="h-2" />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-100 flex gap-3 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-stone-900 hover:bg-stone-800 text-white text-[11px] tracking-[0.1em] uppercase py-3 rounded-xl disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={onClose}
            className="px-5 text-[11px] tracking-[0.1em] uppercase text-stone-400 hover:text-stone-700 border border-stone-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
