"use client";

import { Trophy, RotateCcw, TrendingUp, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";
import type { WrittenQuestion, WrittenFeedbackItem } from "@/types";
import type { WrittenResult } from "./WrittenTest";

interface Props {
  result:       WrittenResult;
  chapterTitle: string;
  onRetry:      () => void;
}

const SECTION_LABELS: Record<string, string> = {
  A: "Section A — Short Answer",
  B: "Section B — Medium Answer",
  C: "Section C — Long Answer",
};

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct  = max > 0 ? score / max : 0;
  const r    = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = pct >= 0.75 ? "#00FF94" : pct >= 0.5 ? "#FFB800" : "#FF2D78";

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle cx="72" cy="72" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)", filter: `drop-shadow(0 0 12px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-black text-3xl leading-none" style={{ color }}>{score}</span>
        <span className="text-sm font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>/ {max}</span>
      </div>
    </div>
  );
}

function gradeLabel(pct: number) {
  if (pct >= 0.9) return { label: "Outstanding!", color: "#00FF94" };
  if (pct >= 0.75) return { label: "Very Good",   color: "#00D4FF" };
  if (pct >= 0.5)  return { label: "Good",         color: "#FFB800" };
  if (pct >= 0.33) return { label: "Needs Work",   color: "#FF6B2B" };
  return                  { label: "Keep Trying",  color: "#FF2D78" };
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0;
  const color = pct >= 0.75 ? "#00FF94" : pct >= 0.5 ? "#FFB800" : "#FF2D78";
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct * 100}%`, background: color, boxShadow: `0 0 6px ${color}` }} />
      </div>
      <span className="text-xs font-mono flex-shrink-0" style={{ color, minWidth: 36, textAlign: "right" }}>
        {score}/{max}
      </span>
    </div>
  );
}

const SECTION_COLORS: Record<string, string> = { A: "#FFB800", B: "#FF6B2B", C: "#FF2D78" };

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

      {/* Hero */}
      <div className="flex-shrink-0 flex flex-col items-center gap-5 pt-8 pb-6 px-6"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: "#FFB800" }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
            Written Test Results
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(255,184,0,0.1)", color: "#FFB800" }}>
            {chapterTitle}
          </span>
        </div>

        <ScoreRing score={score} max={max_score} />

        <div className="text-center">
          <p className="font-display font-black text-3xl leading-none" style={{ color: grade.color }}>{grade.label}</p>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
            {Math.round(pct * 100)}% · {score} / {max_score} marks
          </p>
        </div>

        {/* Section breakdown */}
        <div className="w-full max-w-sm space-y-2">
          {Object.entries(bySection).map(([sec, qs]) => {
            const secScore = qs.reduce((s, q) => s + (feedback[q.id]?.score ?? 0), 0);
            const secMax   = qs.reduce((s, q) => s + q.marks, 0);
            const secColor = SECTION_COLORS[sec] ?? "#FFB800";
            return (
              <div key={sec} className="rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold"
                      style={{ background: `${secColor}20`, color: secColor }}>
                      {sec}
                    </div>
                    <span className="text-xs font-mono" style={{ color: secColor }}>
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

      {/* Per-question review */}
      <div className="flex-1 px-4 py-5 space-y-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: "#FFB800" }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
            Question-by-Question Feedback
          </span>
        </div>

        {Object.entries(bySection).map(([sec, qs]) => {
          const secColor = SECTION_COLORS[sec] ?? "#FFB800";
          return (
            <div key={sec}>
              {/* Section label */}
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold"
                  style={{ background: `${secColor}18`, color: secColor }}>
                  {sec}
                </div>
                <span className="text-xs font-mono" style={{ color: secColor }}>
                  {SECTION_LABELS[sec]}
                </span>
                <div className="flex-1 h-px" style={{ background: `${secColor}20` }} />
              </div>

              <div className="space-y-3">
                {qs.map(q => {
                  qCounter++;
                  const fb      = feedback[q.id];
                  const s       = fb?.score ?? 0;
                  const m       = q.marks;
                  const pctQ    = m > 0 ? s / m : 0;
                  const color   = pctQ >= 0.75 ? "#00FF94" : pctQ >= 0.5 ? "#FFB800" : "#FF2D78";
                  const Icon    = pctQ >= 0.75 ? CheckCircle2 : pctQ >= 0.4 ? MinusCircle : AlertCircle;

                  return (
                    <div key={q.id} className="rounded-2xl overflow-hidden"
                      style={{
                        background: pctQ >= 0.75 ? "rgba(0,255,148,0.03)" : pctQ >= 0.4 ? "rgba(255,184,0,0.03)" : "rgba(255,45,120,0.03)",
                        border:     `1px solid ${pctQ >= 0.75 ? "rgba(0,255,148,0.12)" : pctQ >= 0.4 ? "rgba(255,184,0,0.14)" : "rgba(255,45,120,0.12)"}`,
                      }}>
                      {/* Question header */}
                      <div className="flex items-center justify-between px-4 py-2.5"
                        style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                          <span className="text-xs font-mono font-bold" style={{ color }}>Q{qCounter}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pctQ * 100}%`, background: color }} />
                          </div>
                          <span className="text-xs font-mono font-bold" style={{ color }}>
                            {s}/{m}
                          </span>
                        </div>
                      </div>

                      <div className="px-4 py-3">
                        <p className="text-sm leading-relaxed mb-2.5" style={{ color: "rgba(255,255,255,0.78)" }}>
                          {q.question}
                        </p>
                        {fb?.feedback && (
                          <div className="px-3 py-2.5 rounded-xl"
                            style={{ background: "rgba(255,255,255,0.03)", borderLeft: `2px solid ${color}50` }}>
                            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
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

      {/* Retry */}
      <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.01)" }}>
        <button onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display font-bold text-sm transition-all"
          style={{ background: "rgba(255,184,0,0.08)", border: "1px solid rgba(255,184,0,0.22)", color: "#FFB800" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,184,0,0.16)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,184,0,0.35)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,184,0,0.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,184,0,0.22)"; }}
        >
          <RotateCcw className="w-4 h-4" /> Attempt Again
        </button>
      </div>
    </div>
  );
}
