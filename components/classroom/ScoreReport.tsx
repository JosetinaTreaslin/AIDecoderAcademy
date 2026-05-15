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
  const r     = 52;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;

  const color = pct >= 0.8 ? "#00FF94" : pct >= 0.5 ? "#FFB800" : "#FF2D78";

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="72" cy="72" r={r} fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)", filter: `drop-shadow(0 0 12px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-black text-3xl leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-sm font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
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
  const correct   = questions.filter(q => feedback[q.id]?.correct).length;
  const incorrect = questions.length - correct;

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* ── Hero ── */}
      <div
        className="flex-shrink-0 flex flex-col items-center gap-5 pt-8 pb-6 px-6"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: "#00D4FF" }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
            MCQ Results
          </span>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ background: "rgba(0,212,255,0.1)", color: "#00D4FF" }}>
            {chapterTitle}
          </span>
        </div>

        <ScoreRing score={score} max={max_score} />

        <div className="text-center">
          <p className="font-display font-black text-3xl leading-none" style={{ color: grade.color }}>
            {grade.label}
          </p>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
            {Math.round(pct * 100)}% · {score} / {max_score} marks
          </p>
        </div>

        {/* Quick stats row */}
        <div className="flex gap-3 w-full max-w-xs">
          <div className="flex-1 rounded-xl p-3 text-center"
            style={{ background: "rgba(0,255,148,0.06)", border: "1px solid rgba(0,255,148,0.15)" }}>
            <p className="font-display font-black text-xl" style={{ color: "#00FF94" }}>{correct}</p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(0,255,148,0.6)" }}>Correct</p>
          </div>
          <div className="flex-1 rounded-xl p-3 text-center"
            style={{ background: "rgba(255,45,120,0.06)", border: "1px solid rgba(255,45,120,0.15)" }}>
            <p className="font-display font-black text-xl" style={{ color: "#FF2D78" }}>{incorrect}</p>
            <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(255,45,120,0.6)" }}>Incorrect</p>
          </div>
        </div>

        {/* Difficulty breakdown */}
        <div className="flex gap-2 w-full max-w-xs">
          {(["easy", "medium", "hard"] as const).map(d => {
            const qs = byDiff[d];
            if (!qs.length) return null;
            const s  = diffScore(qs);
            const dc = DIFF_COLORS[d];
            const p  = qs.length > 0 ? s / qs.length : 0;
            return (
              <div key={d} className="flex-1 rounded-xl p-2.5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-[10px] font-mono uppercase block mb-1.5" style={{ color: dc.text, opacity: 0.75 }}>{d}</span>
                <span className="font-display font-black text-sm block" style={{ color: dc.text }}>
                  {s}/{qs.length}
                </span>
                <div className="h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${p * 100}%`, background: dc.text }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Per-question review ── */}
      <div className="flex-1 px-4 py-5 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4" style={{ color: "#00D4FF" }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
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
              className="rounded-2xl overflow-hidden"
              style={{
                background: correct ? "rgba(0,255,148,0.03)" : "rgba(255,45,120,0.03)",
                border:     correct ? "1px solid rgba(0,255,148,0.13)" : "1px solid rgba(255,45,120,0.13)",
              }}
            >
              {/* Question top bar */}
              <div className="flex items-center gap-2.5 px-4 py-2.5"
                style={{ background: correct ? "rgba(0,255,148,0.05)" : "rgba(255,45,120,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {correct
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "#00FF94" }} />
                  : <XCircle      className="w-4 h-4 flex-shrink-0" style={{ color: "#FF2D78" }} />
                }
                <span className="text-xs font-mono font-bold" style={{ color: correct ? "#00FF94" : "#FF2D78" }}>
                  Q{idx + 1}
                </span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.06)", color: diff.text }}>
                  {q.difficulty}
                </span>
                <span className="ml-auto text-xs font-mono" style={{ color: correct ? "#00FF94" : "#FF2D78" }}>
                  {correct ? "+1" : "0"}/1
                </span>
              </div>

              <div className="p-4">
                <p className="text-sm leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {q.question}
                </p>

                {/* Options */}
                <div className="space-y-1.5">
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = optIdx === fb?.correct_index;
                    const isChosen  = optIdx === chosen;
                    let bg = "transparent";
                    let color = "rgba(255,255,255,0.35)";
                    if (isCorrect) { bg = "rgba(0,255,148,0.09)"; color = "#00FF94"; }
                    else if (isChosen && !isCorrect) { bg = "rgba(255,45,120,0.09)"; color = "#FF2D78"; }

                    return (
                      <div
                        key={optIdx}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm"
                        style={{ background: bg, color, border: `1px solid ${isCorrect ? "rgba(0,255,148,0.15)" : isChosen && !isCorrect ? "rgba(255,45,120,0.15)" : "transparent"}` }}
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
                  <div className="mt-3 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(0,212,255,0.05)", borderLeft: "2px solid rgba(0,212,255,0.35)" }}>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {fb.explanation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div className="h-2" />
      </div>

      {/* ── Retry ── */}
      <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.01)" }}>
        <button
          onClick={onRetry}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display font-bold text-sm transition-all"
          style={{
            background: "rgba(0,212,255,0.08)",
            border:     "1px solid rgba(0,212,255,0.22)",
            color:      "#00D4FF",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.16)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.35)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.08)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.22)"; }}
        >
          <RotateCcw className="w-4 h-4" />
          Try Again with New Questions
        </button>
      </div>
    </div>
  );
}
