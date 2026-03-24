"use client";

import { useEffect, useState } from "react";

interface Briefing {
  briefingText: string;
  wakeUpTimeline: string;
  nutrition: string;
  warmup: string;
  targetSplits: string;
  mentalCues: string;
}

interface Props {
  eventDate: string;
  goal: string;
  progressContext: string;
  uid: string;
  whatsappPhone?: string;
  telegramChatId?: string;
  onClose: () => void;
}

export default function RaceDayBriefing({
  eventDate, goal, progressContext, uid, onClose,
}: Props) {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchBriefing() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/race-briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, eventDate, goal, progressContext }),
        });
        if (!res.ok) throw new Error("Failed to fetch briefing");
        const data = await res.json();
        if (!cancelled) {
          if (data.briefing) {
            setBriefing(data.briefing);
          } else {
            setError("No briefing data returned.");
          }
        }
      } catch {
        if (!cancelled) setError("Could not generate briefing. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBriefing();
    return () => { cancelled = true; };
  }, [uid, eventDate, goal, progressContext]);

  const handleShare = async () => {
    if (!briefing?.briefingText) return;
    if (navigator.share) {
      await navigator.share({ text: briefing.briefingText });
    } else {
      await navigator.clipboard.writeText(briefing.briefingText);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-950 z-50 overflow-y-auto">
      <div className="max-w-[430px] mx-auto px-5 pt-12 pb-32">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-emerald-500 mb-1">Race Day</p>
            <h1 className="text-xl font-black text-white tracking-tight">RACE DAY BRIEFING</h1>
          </div>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300 text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col gap-4 animate-pulse">
            <div className="h-4 bg-stone-800 rounded-full w-3/4" />
            <div className="h-4 bg-stone-800 rounded-full w-1/2" />
            <div className="h-4 bg-stone-800 rounded-full w-2/3" />
            <p className="text-[11px] text-stone-600 mt-2">Preparing your race briefing…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-stone-900 border border-stone-800 rounded-xl px-5 py-5">
            <p className="text-sm text-stone-400">{error}</p>
          </div>
        )}

        {/* Briefing content */}
        {!loading && briefing && (
          <div className="flex flex-col gap-6">

            <Section label="Wake-Up Timeline" body={briefing.wakeUpTimeline} />
            <Section label="Nutrition" body={briefing.nutrition} />
            <Section label="Warm-Up" body={briefing.warmup} />
            <Section label="Target Splits" body={briefing.targetSplits} />
            <Section label="Mental Cues" body={briefing.mentalCues} />

            {/* Copy message */}
            <div className="pt-4 border-t border-stone-800 flex flex-col gap-3">
              <p className="text-[10px] tracking-[0.15em] uppercase text-stone-500">Share briefing</p>
              <button
                onClick={handleShare}
                className="self-start bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-[11px] tracking-[0.12em] uppercase font-semibold px-5 py-3 rounded-xl transition-colors"
              >
                {shared ? "Copied!" : "Share"}
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-[9px] tracking-[0.2em] uppercase text-stone-500 mb-2">{label}</p>
      <p className="text-[13px] text-stone-300 leading-relaxed">{body}</p>
    </div>
  );
}
