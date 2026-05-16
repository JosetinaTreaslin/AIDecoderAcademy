"use client";

import { useState } from "react";
import { CheckCircle, ChevronLeft, Send, Loader2, AlertCircle } from "lucide-react";
import type { MCQQuestion, Chapter } from "@/types";

interface Props {
  paperId:     string;
  questionIds: string[];
  questions:   MCQQuestion[];
  chapter:     Chapter;
  onComplete:  (result: SubmitResult) => void;
  onBack:      () => void;
}

export interface SubmitResult {
  score:     number;
  max_score: number;
  feedback:  Record<string, { correct: boolean; correct_index: number; explanation: string }>;
  questions: MCQQuestion[];
  answers:   Record<string, number>;
}

const DIFF_COLORS = {
  easy:   { bg: "rgba(0,255,148,0.12)", text: "#00FF94", border: "rgba(0,255,148,0.25)" },
  medium: { bg: "rgba(255,184,0,0.12)", text: "#FFB800", border: "rgba(255,184,0,0.25)" },
  hard:   { bg: "rgba(255,45,120,0.12)", text: "#FF2D78",  border: "rgba(255,45,120,0.25)" },
};

export function MCQTest({ paperId, questionIds, questions, chapter, onComplete, onBack }: Props) {
  const [answers,    setAnswers]    = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [startTime]                 = useState(() => Date.now());

  const answered = Object.keys(answers).length;
  const total    = questions.length;
  const allDone  = answered === total;

  const choose = (qId: string, idx: number) =>
    setAnswers(prev => ({ ...prev, [qId]: idx }));

  const submit = async () => {
    if (!allDone) return;
    setSubmitting(true);
    setError(null);
    try {
      const timeTaken = Math.round((Date.now() - startTime) / 1000);
      const res = await fetch("/api/classroom/evaluate-mcq", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ paper_id: paperId, question_ids: questionIds, answers, time_taken_secs: timeTaken }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onComplete({ ...data, questions, answers });
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-6 py-3.5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm transition-all px-3 py-1.5 rounded-lg"
            style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="text-center">
            <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "rgba(0,212,255,0.6)" }}>
              {chapter.subject} · Ch. {chapter.chapter_number}
            </p>
            <p className="text-sm font-display font-bold mt-0.5 max-w-[200px] truncate" style={{ color: "rgba(255,255,255,0.92)" }}>
              {chapter.chapter_title}
            </p>
          </div>

          {/* Progress pill */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold"
            style={{
              background: allDone ? "rgba(0,255,148,0.12)" : "rgba(0,212,255,0.10)",
              border:     `1px solid ${allDone ? "rgba(0,255,148,0.3)" : "rgba(0,212,255,0.2)"}`,
              color:      allDone ? "#00FF94" : "#00D4FF",
            }}
          >
            {answered}<span style={{ opacity: 0.5 }}>/{total}</span>
          </div>
        </div>
        {/* Animated fill progress bar */}
        <div className="h-0.5 w-full" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${total > 0 ? (answered / total) * 100 : 0}%`,
              background: allDone
                ? "linear-gradient(90deg, #00FF94, #00D4FF)"
                : "linear-gradient(90deg, #00D4FF, #7C3AED)",
              boxShadow: allDone ? "0 0 8px rgba(0,255,148,0.6)" : "0 0 8px rgba(0,212,255,0.5)",
            }}
          />
        </div>
      </div>

      {/* ── Question list ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {questions.map((q, idx) => {
          const diff      = DIFF_COLORS[q.difficulty] ?? DIFF_COLORS.easy;
          const chosen    = answers[q.id];
          const isAnswered = chosen !== undefined;

          return (
            <div
              key={q.id}
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{
                background: isAnswered ? "rgba(0,212,255,0.03)" : "rgba(255,255,255,0.025)",
                border:     isAnswered ? "1px solid rgba(0,212,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {/* Question header */}
              <div className="flex items-start gap-3 px-4 pt-4 pb-3">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-mono font-bold mt-0.5"
                  style={{
                    background: isAnswered ? "rgba(0,212,255,0.18)" : "rgba(255,255,255,0.07)",
                    color:      isAnswered ? "#00D4FF" : "rgba(255,255,255,0.45)",
                    border:     isAnswered ? "1px solid rgba(0,212,255,0.25)" : "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full"
                      style={{ background: diff.bg, color: diff.text, border: `1px solid ${diff.border}` }}
                    >
                      {q.difficulty}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                      1 mark
                    </span>
                    {isAnswered && (
                      <CheckCircle className="w-3.5 h-3.5 ml-auto" style={{ color: "rgba(0,212,255,0.6)" }} />
                    )}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                    {q.question}
                  </p>
                </div>
              </div>

              {/* Options */}
              <div className="px-4 pb-4 space-y-2">
                {q.options.map((opt, optIdx) => {
                  const isChosen = chosen === optIdx;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => choose(q.id, optIdx)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all"
                      style={{
                        background: isChosen ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.025)",
                        border:     isChosen ? "1px solid rgba(0,212,255,0.4)" : "1px solid rgba(255,255,255,0.06)",
                        color:      isChosen ? "#ffffff" : "rgba(255,255,255,0.6)",
                      }}
                      onMouseEnter={e => { if (!isChosen) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                      onMouseLeave={e => { if (!isChosen) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"; }}
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                        style={{
                          background: isChosen ? "#00D4FF" : "transparent",
                          border:     isChosen ? "none" : "1.5px solid rgba(255,255,255,0.2)",
                        }}
                      >
                        {isChosen && <div className="w-2 h-2 rounded-full bg-[#031024]" />}
                      </div>
                      <span className="text-sm">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        <div className="h-2" />
      </div>

      {/* ── Footer ── */}
      <div
        className="flex-shrink-0 px-6 py-4 flex flex-col gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.01)" }}
      >
        {error && (
          <div className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(255,45,120,0.08)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.18)" }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!allDone && (
          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
            {total - answered} question{total - answered !== 1 ? "s" : ""} remaining
          </p>
        )}

        <button
          onClick={submit}
          disabled={!allDone || submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-display font-bold text-sm transition-all"
          style={{
            background: allDone && !submitting
              ? "linear-gradient(135deg, #00D4FF, #0284C7)"
              : "rgba(255,255,255,0.05)",
            color:     allDone && !submitting ? "#031024" : "rgba(255,255,255,0.2)",
            cursor:    allDone && !submitting ? "pointer" : "not-allowed",
            boxShadow: allDone && !submitting ? "0 0 28px rgba(0,212,255,0.35)" : "none",
          }}
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Evaluating…</>
            : <><Send className="w-4 h-4" /> Submit Answers</>
          }
        </button>
      </div>
    </div>
  );
}
