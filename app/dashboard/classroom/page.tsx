"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Loader2, BookOpenCheck } from "lucide-react";
import { ChapterPicker } from "@/components/classroom/ChapterPicker";
import { MCQTest, type SubmitResult } from "@/components/classroom/MCQTest";
import { ScoreReport } from "@/components/classroom/ScoreReport";
import type { Chapter, MCQQuestion } from "@/types";

type View = "pick" | "loading" | "test" | "result";

interface PaperData {
  paperId:     string;
  questionIds: string[];
  questions:   MCQQuestion[];
  chapter:     Chapter;
}

export default function ClassroomPage() {
  const [view,      setView]      = useState<View>("pick");
  const [paper,     setPaper]     = useState<PaperData | null>(null);
  const [result,    setResult]    = useState<SubmitResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const startTest = async (chapter: Chapter) => {
    setView("loading");
    setLoadError(null);
    try {
      const res = await fetch(`/api/classroom/paper?chapter_id=${chapter.id}&type=mcq`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPaper({
        paperId:     data.paper_id,
        questionIds: data.question_ids,
        questions:   data.questions,
        chapter:     data.chapter,
      });
      setView("test");
    } catch (e: any) {
      setLoadError(e.message ?? "Failed to load questions. Please try again.");
      setView("pick");
    }
  };

  const handleComplete = (r: SubmitResult) => {
    setResult(r);
    setView("result");
  };

  const handleRetry = () => {
    if (paper) startTest(paper.chapter);
  };

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100dvh)", background: "#08080F" }}
    >
      {/* ── Top bar ── */}
      <div
        className="flex-shrink-0 flex items-center gap-3 px-6 py-4"
        style={{
          background:   "rgba(255,255,255,0.02)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.05))",
            border:     "1px solid rgba(0,212,255,0.3)",
          }}
        >
          <GraduationCap className="w-4 h-4" style={{ color: "#00D4FF" }} />
        </div>
        <div>
          <h1 className="font-display font-black text-base" style={{ color: "rgba(255,255,255,0.92)" }}>
            Classroom
          </h1>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            CBSE · Grade 10 · MCQ Tests
          </p>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden flex">

        {/* Center panel */}
        <div className="flex-1 flex flex-col overflow-hidden max-w-2xl mx-auto w-full">
          <AnimatePresence mode="wait">

            {/* Chapter picker */}
            {view === "pick" && (
              <motion.div
                key="pick"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{    opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="flex-1 overflow-y-auto px-4 py-6"
              >
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpenCheck className="w-4 h-4" style={{ color: "#00D4FF" }} />
                    <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "#00D4FF" }}>
                      Select a Chapter
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Pick a chapter to start a 15-question MCQ test. Each attempt gives a fresh random set.
                  </p>
                  {loadError && (
                    <div
                      className="mt-3 text-xs px-3 py-2 rounded-xl"
                      style={{ background: "rgba(255,45,120,0.1)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.2)" }}
                    >
                      {loadError}
                    </div>
                  )}
                </div>
                <ChapterPicker onSelect={startTest} />
              </motion.div>
            )}

            {/* Loading state */}
            {view === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{    opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center gap-4"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))",
                    border:     "1px solid rgba(0,212,255,0.3)",
                    boxShadow:  "0 0 40px rgba(0,212,255,0.15)",
                  }}
                >
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#00D4FF" }} />
                </div>
                <div className="text-center">
                  <p className="font-display font-bold text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                    Preparing your test
                  </p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Selecting 15 questions from the question bank…
                  </p>
                </div>
              </motion.div>
            )}

            {/* MCQ test */}
            {view === "test" && paper && (
              <motion.div
                key="test"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{    opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
                className="flex-1 overflow-hidden flex flex-col"
              >
                <MCQTest
                  paperId={paper.paperId}
                  questionIds={paper.questionIds}
                  questions={paper.questions}
                  chapter={paper.chapter}
                  onComplete={handleComplete}
                  onBack={() => setView("pick")}
                />
              </motion.div>
            )}

            {/* Score report */}
            {view === "result" && result && paper && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{    opacity: 0, y: -16 }}
                transition={{ duration: 0.25 }}
                className="flex-1 overflow-hidden flex flex-col"
              >
                <ScoreReport
                  result={result}
                  chapterTitle={paper.chapter.chapter_title}
                  onRetry={handleRetry}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
