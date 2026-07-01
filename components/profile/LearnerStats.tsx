"use client";

// Learner Stats — RPG-style stat bars + AIDA-notices card + weekly recs.
// Canon: ../../obsidian/AIDA/AIDA Dev/Adaptive Learner/references/architecture-decisions.md
//        §"Decision 3 — Profile Visualization — Game-Like Motivation".
//
// Design direction: Editorial-meets-retro-arcade. Capital uppercase eyebrow
// labels in JetBrains Mono, Syne for the big numbers, DM Sans body.
// Bars are double-clad: a thin chrome rail above, a soft inner glow inside.
// The five categories are colour-coded by what each maps to in the playground.

import { motion } from "framer-motion";
import { useMemo } from "react";
import { Sparkles, TrendingUp, Zap } from "lucide-react";
import { hydrateLearnerModel, type LearnerModel } from "@/lib/learnerModel";
import type { Profile } from "@/types";

interface LearnerStatsProps {
  profile: Profile & { learner_model?: Record<string, unknown> | null };
  /** Quality / usage counts to drive bars when concept mastery is sparse. */
  outputCounts?: Record<string, number>;
}

interface StatRow {
  key:     string;
  label:   string;
  emoji:   string;
  hue:     string;       // arena-accent style
  level:   number;       // 0..1
  trend:   "up" | "down" | "flat" | "new";
  delta:   number;       // signed value to show next to bar
  count:   number;       // usage samples
}

const CATEGORIES: Array<{ key: string; label: string; emoji: string; hue: string; conceptKeys: string[]; outputTypes: string[] }> = [
  { key: "art",     label: "Art",       emoji: "🎨", hue: "#00D4FF", conceptKeys: ["visual_description", "color_theory", "composition"], outputTypes: ["image"] },
  { key: "story",   label: "Story",     emoji: "📝", hue: "#FF6B2B", conceptKeys: ["narrative_design", "prompt_crafting", "vocabulary"], outputTypes: ["text", "json"] },
  { key: "audio",   label: "Audio",     emoji: "🎵", hue: "#FF2D78", conceptKeys: ["audio_direction", "voice_acting", "scripting"], outputTypes: ["audio"] },
  { key: "present", label: "Presents",  emoji: "📊", hue: "#00FF94", conceptKeys: ["structured_presentation", "outline", "summarisation"], outputTypes: ["slides"] },
  { key: "video",   label: "Video",     emoji: "🎬", hue: "#C8FF00", conceptKeys: ["scene_blocking", "cinematography", "pacing"], outputTypes: ["video"] },
];

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function rowFromModel(
  cat: typeof CATEGORIES[number],
  m: LearnerModel,
  outputCounts: Record<string, number>,
): StatRow {
  let levelSum = 0, levelCount = 0, deltaSum = 0;
  for (const k of cat.conceptKeys) {
    const e = m.cognitive_profile.concept_mastery[k];
    if (!e) continue;
    levelSum += e.level;
    levelCount += 1;
    deltaSum += e.trend_velocity ?? 0;
  }
  let count = 0;
  for (const t of cat.outputTypes) {
    const p = m.cognitive_profile.output_type_preferences[t];
    if (p) count += p.usage_count;
    if (outputCounts[t]) count += outputCounts[t];
  }
  // Fallback: when no concepts have been seeded for the category yet, use
  // creation usage as a weak proxy so the bar shows *something* once the
  // student has done anything at all.
  const fromConcepts = levelCount > 0 ? levelSum / levelCount : null;
  const fromCounts   = count > 0 ? Math.min(0.7, count / 20) : 0;
  const level = clamp01(fromConcepts ?? fromCounts);
  const avgDelta = levelCount > 0 ? deltaSum / levelCount : 0;
  const trend: StatRow["trend"] =
    count > 0 && levelCount === 0 ? "new"
    : avgDelta > 0.03  ? "up"
    : avgDelta < -0.03 ? "down"
    : "flat";
  return {
    key:    cat.key,
    label:  cat.label,
    emoji:  cat.emoji,
    hue:    cat.hue,
    level,
    trend,
    delta:  Math.round(avgDelta * 100),
    count,
  };
}

function StatBar({ row, index, coldStart }: { row: StatRow; index: number; coldStart: boolean }) {
  const widthPct = coldStart ? 0 : Math.round(row.level * 100);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: 0.05 * index, ease: [0.16, 1, 0.3, 1] }}
      className="grid items-center"
      style={{ gridTemplateColumns: "7.4em 1fr 4em 4.6em", gap: "0.86em", padding: "0.43em 0" }}
    >
      {/* Label */}
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ fontSize: "1.14em" }}>{row.emoji}</span>
        <span
          className="uppercase tracking-[0.1em] font-bold truncate"
          style={{ fontSize: "0.75em", color: "#666" }}
        >
          {row.label}
        </span>
      </div>

      {/* Bar */}
      <div
        className="relative h-2.5 rounded-full overflow-hidden"
        style={{
          background: "rgba(0,0,0,0.05)",
          border:     "1px solid rgba(0,0,0,0.06)",
          boxShadow:  "inset 0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{ duration: 0.9, delay: 0.1 + 0.05 * index, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${row.hue}cc 0%, ${row.hue} 60%, ${row.hue}cc 100%)`,
            boxShadow:  `0 0 12px ${row.hue}88, inset 0 1px 0 rgba(255,255,255,0.3)`,
          }}
        />
        {coldStart && (
          <motion.div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, transparent, ${row.hue}33, transparent)`,
            }}
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      {/* Value */}
      <div className="text-right">
        <span
          style={{
            color:      "#1a1a2e",
            fontSize:   "0.93em",
            fontFamily: "var(--font-space-grotesk,'Space Grotesk',sans-serif)",
            fontWeight: 900,
            letterSpacing: "-0.01em",
          }}
        >
          {coldStart ? "—" : `${widthPct}%`}
        </span>
      </div>

      {/* Trend chip */}
      <div className="text-right">
        {!coldStart && row.trend === "up" && (
          <span style={{ color: "#16A34A", fontSize: "0.79em", fontWeight: 700 }}>▲ +{Math.abs(row.delta)}%</span>
        )}
        {!coldStart && row.trend === "down" && (
          <span style={{ color: "#DC2626", fontSize: "0.79em", fontWeight: 700 }}>▼ {row.delta}%</span>
        )}
        {!coldStart && row.trend === "flat" && (
          <span style={{ color: "#bbb", fontSize: "0.79em", fontWeight: 700 }}>—</span>
        )}
        {(coldStart || row.trend === "new") && (
          <span
            className="uppercase tracking-widest"
            style={{ color: row.hue, fontSize: "0.64em", fontWeight: 800 }}
          >
            new
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function LearnerStats({ profile, outputCounts = {} }: LearnerStatsProps) {
  const m = useMemo(() => hydrateLearnerModel(profile.learner_model ?? null), [profile.learner_model]);
  const reflectionCount = m.reflection_count ?? 0;
  const coldStart = reflectionCount === 0 && Object.values(outputCounts).every(c => !c);
  const rows = useMemo(
    () => CATEGORIES.map(cat => rowFromModel(cat, m, outputCounts)),
    [m, outputCounts],
  );

  // Edge case 14: 5-7 year olds get a friendly "stars collected" view instead
  // of stat bars + percentages. Confidence-eroding numbers don't help here.
  if (profile.age_group === "5-7") {
    const totalCreations = Object.values(outputCounts).reduce((s, n) => s + (n ?? 0), 0);
    const stars = Math.min(50, totalCreations);
    return (
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-3xl p-6"
        style={{
          background: "rgba(255,255,255,0.92)",
          border:     "1px solid rgba(255,255,255,0.75)",
          backdropFilter: "blur(20px)",
          boxShadow:  "0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset",
        }}
      >
        <div
          className="uppercase tracking-[0.18em] mb-2"
          style={{ fontSize: "0.68em", color: "#E8A93C", fontWeight: 800 }}
        >
          Stars Collected
        </div>
        <div
          style={{
            fontFamily: "var(--font-space-grotesk,'Space Grotesk',sans-serif)",
            color: "#1a1a2e", fontSize: 28, fontWeight: 900, lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          You&apos;ve made {totalCreations} thing{totalCreations === 1 ? "" : "s"}!
        </div>
        <div className="mt-3 text-2xl tracking-wider" aria-label={`${stars} stars`}>
          {"⭐".repeat(stars) || "✨"}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "#888" }}>
          Keep playing — every creation is a star.
        </p>
      </motion.section>
    );
  }

  const weekly = m.weekly_analysis;
  const strengths = m.cognitive_profile.top_strengths.slice(0, 3);
  const growth    = m.cognitive_profile.top_growth_areas.slice(0, 3);

  // Pick a weekly focus: the lowest-level category with at least some samples,
  // or the first recommendation from the weekly cron — whichever is fresher.
  const focusFromRec = weekly?.recommendations?.[0];
  const focusFromBar = [...rows].filter(r => r.count > 0).sort((a, b) => a.level - b.level)[0];
  const focusText = focusFromRec
    ?? (focusFromBar
        ? `Your ${focusFromBar.label.toLowerCase()} bar is lowest — try 2 ${focusFromBar.label.toLowerCase()} creations this week.`
        : "Make your first creation to set a baseline.");

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.92)",
        border:     "1px solid rgba(255,255,255,0.75)",
        backdropFilter: "blur(20px)",
        boxShadow:  "0 8px 32px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.8) inset",
      }}
    >
      {/* Top hairline */}
      <div
        className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, #00AEEF 30%, #7C3AED 70%, transparent)",
        }}
      />

      <div className="p-5 md:p-6">
        {/* Heading */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <div
              className="uppercase tracking-[0.18em] mb-1 font-bold"
              style={{ fontSize: "0.68em", color: "#0891B2" }}
            >
              Your Creator Stats
            </div>
            <h2
              style={{
                fontFamily: "var(--font-space-grotesk,'Space Grotesk',sans-serif)",
                color:      "#1a1a2e",
                fontSize:   "1.57em",
                fontWeight: 900,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              {coldStart
                ? "Your stats are coming to life…"
                : reflectionCount === 1
                  ? "First read — still settling in"
                  : `Read from ${reflectionCount} sessions`}
            </h2>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest font-bold" style={{ color: "#bbb" }}>Overall</div>
            <div
              style={{
                fontFamily: "var(--font-space-grotesk,'Space Grotesk',sans-serif)",
                color:      "#1a1a2e",
                fontSize:   "2em",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              {coldStart
                ? "—"
                : Math.round(rows.reduce((s, r) => s + r.level, 0) / rows.length * 100) + "%"}
            </div>
          </div>
        </div>

        {/* Bars */}
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 8 }}>
          {rows.map((r, i) => (
            <StatBar key={r.key} row={r} index={i} coldStart={coldStart} />
          ))}
        </div>

        {/* Insights row */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* AIDA notices */}
          <div
            className="relative rounded-2xl p-4"
            style={{
              background: "linear-gradient(180deg, rgba(0,174,239,0.07), rgba(124,58,237,0.05))",
              border:     "1px solid rgba(0,174,239,0.22)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} style={{ color: "#0891B2" }} />
              <span
                className="uppercase tracking-[0.14em] font-bold"
                style={{ fontSize: "0.64em", color: "#0891B2" }}
              >
                AIDA Notices
              </span>
            </div>
            {coldStart ? (
              <p className="text-[13px] leading-relaxed" style={{ color: "#777" }}>
                Start creating in the playground and AIDA will begin learning how you think.
              </p>
            ) : (
              <p className="text-[13px] leading-relaxed" style={{ color: "#555" }}>
                {weekly?.weekly_summary && weekly.weekly_summary.length > 0 ? (
                  weekly.weekly_summary
                ) : strengths.length > 0 ? (
                  <>
                    You&apos;re strong in <span className="font-semibold" style={{ color: "#1a1a2e" }}>{strengths[0].concept.replace(/_/g, " ")}</span>
                    {growth[0] ? (
                      <> and there&apos;s room to grow in <span className="font-semibold" style={{ color: "#1a1a2e" }}>{growth[0].concept.replace(/_/g, " ")}</span>.</>
                    ) : "."}
                  </>
                ) : (
                  "I'm still getting a read on your style — keep going and I'll spot patterns."
                )}
              </p>
            )}
          </div>

          {/* Weekly focus */}
          <div
            className="relative rounded-2xl p-4"
            style={{
              background: "linear-gradient(180deg, rgba(124,58,237,0.06), rgba(34,197,94,0.04))",
              border:     "1px solid rgba(124,58,237,0.2)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} style={{ color: "#7C3AED" }} />
              <span
                className="uppercase tracking-[0.14em] font-bold"
                style={{ fontSize: "0.64em", color: "#7C3AED" }}
              >
                This Week&apos;s Focus
              </span>
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: "#555" }}>{focusText}</p>
            {(weekly?.plateau_warnings?.length ?? 0) > 0 && (
              <div className="mt-2 text-[11px] flex items-center gap-1" style={{ color: "#999" }}>
                <TrendingUp size={11} />
                {weekly!.plateau_warnings[0]}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
