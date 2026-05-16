"use client";

import { Trophy, RotateCcw, TrendingUp, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";
import type { WrittenQuestion, WrittenFeedbackItem } from "@/types";
import type { WrittenResult } from "./WrittenTest";

interface Props {
  result:       WrittenResult;
  chapterTitle: string;
  onRetry:      () => void;
}

const NAVY     = "#0f1c4d";
const NAVY_60  = "rgba(15,28,77,0.6)";
const NAVY_45  = "rgba(15,28,77,0.45)";
const NAVY_08  = "rgba(15,28,77,0.08)";

const SECTION_LABELS: Record<string, string> = {
  A: "Section A — Short Answer",
  B: "Section B — Medium Answer",
  C: "Section C — Long Answer",
};

const SECTION_COLORS: Record<string, string> = {
  A: "#C8A84B",   // gold
  B: "#2563eb",   // blue
  C: "#dc2626",   // red
};

// Score-based colours — adjusted for light background
function scoreColor(pct: number) {
  if (pct >= 0.75) return "#16a34a";   // green
  if (pct >= 0.4)  return "#d97706";   // amber
  return "#dc2626";                     // red
}

function gradeLabel(pct: number): { label: string; color: string } {
  if (pct >= 0.9)  return { label: "Outstanding!", color: "#16a34a" };
  if (pct >= 0.75) return { label: "Very Good",    color: "#2563eb" };
  if (pct >= 0.5)  return { label: "Good",          color: "#d97706" };
  if (pct >= 0.33) return { label: "Needs Work",    color: "#ea580c" };
  return                  { label: "Keep Trying",   color: "#dc2626" };
}

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct   = max > 0 ? score / max : 0;
  const r     = 52;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;
  const color = scoreColor(pct);

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke={NAVY_08} strokeWidth="10" />
        <circle cx="72" cy="72" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)", filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-black text-3xl leading-none" style={{ color }}>{score}</span>
        <span className="text-sm font-mono mt-0.5" style={{ color: NAVY_45 }}>/ {max}</span>
      </div>
    </div>
  );
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct   = max > 0 ? score / max : 0;
  const color = scoreColor(pct);
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: NAVY_08 }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct * 100}%`, background: color }} />
      </div>
      <span className="text-xs font-mono flex-shrink-0 font-bold" style={{ color, minWidth: 36, textAlign: "right" }}>
        {score}/{max}
      </span>
    </div>
  );
}

export function WrittenScoreReport({ result, chapterTitle, onRetry }: Props) {
  const { score, max_score, feedback, questions } = result;
  const pct   = max_score > 0 ? score / max_score : 0;
  const grade = gradeLabel(pct);

  const bySection = questions.reduce<Record<string, WrittenQuestion[]>>((acc, q) => {
    if (!acc[q.section]) acc[q.section] = [];
    acc[q.section]!.push(q);
    return acc;
  }, {});

  let qCounter = 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Hero ── */}
      <div className="flex-shrink-0 flex flex-col items-center gap-5 pt-7 pb-5 px-6"
        style={{ borderBottom: `1px solid ${NAVY_08}` }}>

        {/* Title row */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <Trophy className="w-4 h-4" style={{ color: "#C8A84B" }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: NAVY_60 }}>
            Written Test Results
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: "rgba(200,168,75,0.1)", color: "#C8A84B", border: "1px solid rgba(200,168,75,0.25)" }}>
            {chapterTitle}
          </span>
        </div>

        <ScoreRing score={score} max={max_score} />

        <div className="text-center">
          <p className="font-display font-black text-3xl leading-none" style={{ color: grade.color }}>
            {grade.label}
          </p>
          <p className="text-sm mt-2" style={{ color: NAVY_60 }}>
            {Math.round(pct * 100)}% · {score} / {max_score} marks
          </p>
        </div>

        {/* Section breakdown */}
        <div className="w-full max-w-sm space-y-2">
          {Object.entries(bySection).map(([sec, qs]) => {
            const secScore = qs.reduce((s, q) => s + (feedback[q.id]?.score ?? 0), 0);
            const secMax   = qs.reduce((s, q) => s + q.marks, 0);
            const secColor = SECTION_COLORS[sec] ?? "#C8A84B";
            return (
              <div key={sec} className="rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.85)", border: `1px solid ${NAVY_08}` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-black"
                      style={{ background: `${secColor}18`, color: secColor }}>
                      {sec}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: NAVY_60 }}>
                      {SECTION_LABELS[sec]?.split("—")[1]?.trim()}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold" style={{ color: secColor }}>
                    {secScore}/{secMax}
                  </span>
                </div>
                <ScoreBar score={secScore} max={secMax} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Per-question review ── */}
      <div className="flex-1 px-4 py-5 space-y-5">

        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: "#C8A84B" }} />
          <span className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: NAVY_60 }}>
            Question-by-Question Feedback
          </span>
        </div>

        {Object.entries(bySection).map(([sec, qs]) => {
          const secColor = SECTION_COLORS[sec] ?? "#C8A84B";
          return (
            <div key={sec}>
              {/* Section header */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-black"
                  style={{ background: `${secColor}18`, color: secColor }}>
                  {sec}
                </div>
                <span className="text-xs font-semibold" style={{ color: secColor }}>
                  {SECTION_LABELS[sec]}
                </span>
                <div className="flex-1 h-px" style={{ background: `${secColor}30` }} />
              </div>

              <div className="space-y-3">
                {qs.map(q => {
                  qCounter++;
                  const fb    = feedback[q.id];
                  const s     = fb?.score ?? 0;
                  const m     = q.marks;
                  const pctQ  = m > 0 ? s / m : 0;
                  const color = scoreColor(pctQ);
                  const Icon  = pctQ >= 0.75 ? CheckCircle2 : pctQ >= 0.4 ? MinusCircle : AlertCircle;

                  const bgMap = {
                    good:    "rgba(22,163,74,0.05)",
                    partial: "rgba(217,119,6,0.05)",
                    poor:    "rgba(220,38,38,0.05)",
                  };
                  const borderMap = {
                    good:    "rgba(22,163,74,0.18)",
                    partial: "rgba(217,119,6,0.18)",
                    poor:    "rgba(220,38,38,0.18)",
                  };
                  const tier = pctQ >= 0.75 ? "good" : pctQ >= 0.4 ? "partial" : "poor";

                  return (
                    <div key={q.id} className="rounded-2xl overflow-hidden"
                      style={{ background: bgMap[tier], border: `1px solid ${borderMap[tier]}` }}>

                      {/* Card header */}
                      <div className="flex items-center justify-between px-4 py-2.5"
                        style={{ background: "rgba(255,255,255,0.6)", borderBottom: `1px solid ${NAVY_08}` }}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color }} />
                          <span className="text-xs font-mono font-bold" style={{ color: NAVY }}>
                            Q{qCounter}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: NAVY_08 }}>
                            <div className="h-full rounded-full" style={{ width: `${pctQ * 100}%`, background: color }} />
                          </div>
                          <span className="text-xs font-mono font-bold" style={{ color }}>
                            {s}/{m}
                          </span>
                        </div>
                      </div>

                      {/* Card body */}
                      <div className="px-4 py-3">
                        <p className="text-sm leading-relaxed mb-2.5" style={{ color: "rgba(15,28,77,0.82)" }}>
                          {q.question}
                        </p>
                        {fb?.feedback && (
                          <div className="px-3 py-2.5 rounded-xl"
                            style={{ background: "rgba(255,255,255,0.8)", borderLeft: `3px solid ${color}` }}>
                            <p className="text-xs leading-relaxed" style={{ color: NAVY_60 }}>
                              {fb.feedback}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="h-2" />
      </div>

      {/* ── Retry ── */}
      <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: `1px solid ${NAVY_08}` }}>
        <button onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display font-bold text-sm transition-all"
          style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.2)", color: "#2563eb" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.14)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.08)"; }}
        >
          <RotateCcw className="w-4 h-4" /> Attempt Again
        </button>
      </div>
    </div>
  );
}
