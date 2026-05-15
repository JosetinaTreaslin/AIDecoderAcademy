"use client";

import { useState } from "react";
import { CheckCircle, Circle, ChevronLeft, Send, Loader2, AlertCircle } from "lucide-react";
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
  const [answers,     setAnswers]     = useState<Record<string, number>>({});
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [startTime]                   = useState(() => Date.now());

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
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-100 opacity-50"
          style={{ color: "rgba(255,255,255,0.8)" }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        <div className="text-center">
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(0,212,255,0.7)" }}>
            {chapter.subject} · Chapter {chapter.chapter_number}
          </p>
          <p className="text-sm font-display font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.9)" }}>
            {chapter.chapter_title}
          </p>
        </div>

        {/* Progress pill */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono"
          style={{
            background:  allDone ? "rgba(0,255,148,0.12)" : "rgba(0,212,255,0.10)",
            border:      `1px solid ${allDone ? "rgba(0,255,148,0.3)" : "rgba(0,212,255,0.2)"}`,
            color:       allDone ? "#00FF94" : "#00D4FF",
          }}
        >
          {answered}/{total}
        </div>
      </div>

      {/* ── Question list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {questions.map((q, idx) => {
          const diff    = DIFF_COLORS[q.difficulty] ?? DIFF_COLORS.easy;
          const chosen  = answers[q.id];
          const isAnswered = chosen !== undefined;

          return (
            <div
              key={q.id}
              className="rounded-2xl p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                border:     isAnswered
                  ? "1px solid rgba(0,212,255,0.2)"
                  : "1px solid rgba(255,255,255,0.07)",
                transition: "border-color 0.2s",
              }}
            >
              {/* Question header */}
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold mt-0.5"
                  style={{ background: "rgba(0,212,255,0.1)", color: "#00D4FF" }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded-md"
                      style={{ background: diff.bg, color: diff.text, border: `1px solid ${diff.border}` }}
                    >
                      {q.difficulty}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                      1 mark
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                    {q.question}
                  </p>
                </div>
              </div>

              {/* Options */}
              <div className="space-y-2 pl-10">
                {q.options.map((opt, optIdx) => {
                  const isChosen = chosen === optIdx;
                  return (
                    <button
                      key={optIdx}
                      onClick={() => choose(q.id, optIdx)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                      style={{
                        background:   isChosen ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.025)",
                        border:       isChosen ? "1px solid rgba(0,212,255,0.4)" : "1px solid rgba(255,255,255,0.06)",
                        color:        isChosen ? "#ffffff" : "rgba(255,255,255,0.65)",
                      }}
                    >
                      {isChosen
                        ? <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#00D4FF" }} />
                        : <Circle      className="w-4 h-4 flex-shrink-0 opacity-40" />
                      }
                      <span className="text-sm">{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div
        className="flex-shrink-0 px-6 py-4 flex flex-col gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {error && (
          <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl"
            style={{ background: "rgba(255,45,120,0.1)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.2)" }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!allDone && (
          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
            Answer all {total} questions to submit
          </p>
        )}

        <button
          onClick={submit}
          disabled={!allDone || submitting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-bold text-sm transition-all"
          style={{
            background: allDone && !submitting
              ? "linear-gradient(135deg, #00D4FF, #0284C7)"
              : "rgba(255,255,255,0.05)",
            color:   allDone && !submitting ? "#031024" : "rgba(255,255,255,0.25)",
            cursor:  allDone && !submitting ? "pointer" : "not-allowed",
            boxShadow: allDone && !submitting ? "0 0 24px rgba(0,212,255,0.3)" : "none",
          }}
        >
          {submitting
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Evaluating...</>
            : <><Send className="w-4 h-4" /> Submit Answers</>
          }
        </button>
      </div>
    </div>
  );
}
