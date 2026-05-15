"use client";

import { CheckCircle2, XCircle, RotateCcw, Trophy, TrendingUp } from "lucide-react";
import type { MCQQuestion } from "@/types";
import type { SubmitResult } from "./MCQTest";

interface Props {
  result:   SubmitResult;
  chapterTitle: string;
  onRetry: () => void;
}

const DIFF_COLORS = {
  easy:   { text: "#00FF94" },
  medium: { text: "#FFB800" },
  hard:   { text: "#FF2D78" },
};

function ScoreRing({ score, max }: { score: number; max: number }) {
  const pct   = max > 0 ? score / max : 0;
  const r     = 44;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;

  const color = pct >= 0.8 ? "#00FF94" : pct >= 0.5 ? "#FFB800" : "#FF2D78";

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
        <circle
          cx="56" cy="56" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1)", filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-black text-2xl" style={{ color }}>
          {score}
        </span>
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
          / {max}
        </span>
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

export function ScoreReport({ result, chapterTitle, onRetry }: Props) {
  const { score, max_score, feedback, questions, answers } = result;
  const pct   = max_score > 0 ? score / max_score : 0;
  const grade = gradeLabel(pct);

  const byDiff = {
    easy:   questions.filter(q => q.difficulty === "easy"),
    medium: questions.filter(q => q.difficulty === "medium"),
    hard:   questions.filter(q => q.difficulty === "hard"),
  };

  const diffScore = (qs: MCQQuestion[]) => qs.filter(q => feedback[q.id]?.correct).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Hero ── */}
      <div
        className="flex-shrink-0 flex flex-col items-center gap-4 py-8 px-6"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2 opacity-60">
          <Trophy className="w-4 h-4" style={{ color: "#00D4FF" }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "#00D4FF" }}>
            Results — {chapterTitle}
          </span>
        </div>

        <ScoreRing score={score} max={max_score} />

        <div className="text-center">
          <p className="font-display font-black text-2xl" style={{ color: grade.color }}>
            {grade.label}
          </p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
            {Math.round(pct * 100)}% — {score} out of {max_score} marks
          </p>
        </div>

        {/* Difficulty breakdown */}
        <div className="flex gap-3 mt-1">
          {(["easy", "medium", "hard"] as const).map(d => {
            const qs = byDiff[d];
            if (!qs.length) return null;
            const s  = diffScore(qs);
            const dc = DIFF_COLORS[d];
            return (
              <div
                key={d}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-xs font-mono uppercase" style={{ color: dc.text, opacity: 0.8 }}>{d}</span>
                <span className="font-display font-black text-base" style={{ color: dc.text }}>
                  {s}/{qs.length}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Per-question review ── */}
      <div className="flex-1 px-4 py-4 space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4" style={{ color: "#00D4FF" }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
            Question Review
          </span>
        </div>

        {questions.map((q, idx) => {
          const fb      = feedback[q.id];
          const correct = fb?.correct ?? false;
          const chosen  = answers[q.id] ?? -1;
          const diff    = DIFF_COLORS[q.difficulty] ?? DIFF_COLORS.easy;

          return (
            <div
              key={q.id}
              className="rounded-2xl p-4"
              style={{
                background: correct ? "rgba(0,255,148,0.04)" : "rgba(255,45,120,0.04)",
                border:     correct ? "1px solid rgba(0,255,148,0.15)" : "1px solid rgba(255,45,120,0.15)",
              }}
            >
              <div className="flex items-start gap-3">
                {correct
                  ? <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#00FF94" }} />
                  : <XCircle      className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#FF2D78" }} />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>Q{idx + 1}</span>
                    <span
                      className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded"
                      style={{ background: "rgba(255,255,255,0.05)", color: diff.text }}
                    >
                      {q.difficulty}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed mb-2" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {q.question}
                  </p>

                  {/* Options */}
                  <div className="space-y-1">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === fb?.correct_index;
                      const isChosen  = optIdx === chosen;
                      let bg = "transparent";
                      let color = "rgba(255,255,255,0.4)";
                      if (isCorrect) { bg = "rgba(0,255,148,0.1)"; color = "#00FF94"; }
                      else if (isChosen && !isCorrect) { bg = "rgba(255,45,120,0.1)"; color = "#FF2D78"; }

                      return (
                        <div
                          key={optIdx}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                          style={{ background: bg, color }}
                        >
                          {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
                          {isChosen && !isCorrect && <XCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                          {!isCorrect && !isChosen && <span className="w-3.5 h-3.5 flex-shrink-0" />}
                          <span>{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {fb?.explanation && (
                    <p className="text-xs mt-2 leading-relaxed"
                      style={{ color: "rgba(255,255,255,0.45)", borderLeft: "2px solid rgba(0,212,255,0.3)", paddingLeft: 8 }}>
                      {fb.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Retry ── */}
      <div className="flex-shrink-0 px-6 py-5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-bold text-sm transition-all"
          style={{
            background: "rgba(0,212,255,0.1)",
            border:     "1px solid rgba(0,212,255,0.25)",
            color:      "#00D4FF",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.18)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.1)"; }}
        >
          <RotateCcw className="w-4 h-4" />
          Try Again with New Questions
        </button>
      </div>
    </div>
  );
}
