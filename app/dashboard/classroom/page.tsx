"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpenCheck, Loader2 } from "lucide-react";
import { ChapterPicker }       from "@/components/classroom/ChapterPicker";
import { TestTypeSelector }    from "@/components/classroom/TestTypeSelector";
import { MCQTest, type SubmitResult as MCQResult } from "@/components/classroom/MCQTest";
import { ScoreReport }         from "@/components/classroom/ScoreReport";
import { WrittenTest, type WrittenResult } from "@/components/classroom/WrittenTest";
import { WrittenScoreReport }  from "@/components/classroom/WrittenScoreReport";
import { ProctoringGuard }     from "@/components/classroom/ProctoringGuard";
import type { Chapter, MCQQuestion, WrittenQuestion, WrittenFeedbackItem } from "@/types";

const NAVY = "#0f1c4d";
const GOLD = "#C8A84B";

type View =
  | "pick" | "select-type" | "loading"
  | "mcq-test" | "written-test"
  | "mcq-result" | "written-result";

interface PaperData {
  paperId: string; questionIds: string[];
  questions: MCQQuestion[] | WrittenQuestion[];
  chapter: Chapter; type: "mcq" | "written";
}

// All views use the light glass panel — consistent with background image theme

const FADE = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.22 } };

export default function ClassroomPage() {
  const [view,           setView]          = useState<View>("pick");
  const [selectedChapter,setChapter]       = useState<Chapter | null>(null);
  const [paper,          setPaper]         = useState<PaperData | null>(null);
  const [mcqResult,      setMcqResult]     = useState<MCQResult | null>(null);
  const [writtenResult,  setWrittenResult] = useState<WrittenResult | null>(null);
  const [loadError,      setLoadError]     = useState<string | null>(null);
  const [loadingMsg,     setLoadingMsg]    = useState("");
  const [writtenPhase,   setWrittenPhase]  = useState("intro");

  const isLight = true; // always light

  const handleChapterSelect = (ch: Chapter) => { setChapter(ch); setLoadError(null); setView("select-type"); };

  const loadPaper = async (chapter: Chapter, type: "mcq" | "written") => {
    setView("loading");
    setLoadingMsg(type === "mcq" ? "Selecting 15 questions from the bank…" : "Loading question paper…");
    setLoadError(null);
    try {
      const res  = await fetch(`/api/classroom/paper?chapter_id=${chapter.id}&type=${type}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPaper({ paperId: data.paper_id, questionIds: data.question_ids ?? data.questions.map((q: any) => q.id), questions: data.questions, chapter: data.chapter, type });
      setWrittenPhase("intro");
      setView(type === "mcq" ? "mcq-test" : "written-test");
    } catch (e: any) {
      setLoadError(e.message ?? "Failed to load. Please try again.");
      setView("select-type");
    }
  };

  const handleTypeSelect      = (type: "mcq" | "written") => { if (selectedChapter) loadPaper(selectedChapter, type); };
  const handleMcqComplete     = (r: MCQResult)     => { setMcqResult(r);     setView("mcq-result"); };
  const handleWrittenComplete = (r: WrittenResult) => { setWrittenResult(r); setView("written-result"); };
  const retryMcq     = () => paper && loadPaper(paper.chapter, "mcq");
  const retryWritten = () => paper && loadPaper(paper.chapter, "written");

  const handleDisqualify = useCallback(() => {
    if (!paper) return;
    if (paper.type === "mcq") {
      const qs = paper.questions as MCQQuestion[];
      const fb: MCQResult["feedback"] = {};
      for (const q of qs) fb[q.id] = { correct: false, correct_index: -1, explanation: "Test terminated: proctoring violation." };
      setMcqResult({ score: 0, max_score: qs.length, feedback: fb, questions: qs, answers: {} });
      setView("mcq-result");
    } else {
      const qs = paper.questions as WrittenQuestion[];
      const fb: Record<string, WrittenFeedbackItem> = {};
      for (const q of qs) fb[q.id] = { score: 0, max: q.marks, feedback: "Test terminated: proctoring violation." };
      setWrittenResult({ score: 0, max_score: qs.reduce((s, q) => s + q.marks, 0), feedback: fb, questions: qs });
      setView("written-result");
    }
  }, [paper]);

  const proctoringActive = view === "mcq-test" || (view === "written-test" && writtenPhase === "test");

  return (
    <div
      className="flex flex-col"
      style={{
        height:             "100dvh",
        backgroundImage:    "url('/classroom/background.png')",
        backgroundSize:     "cover",
        backgroundPosition: "center",
        position:           "relative",
      }}
    >
      {/* ── Light overlay — brightens the image slightly ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(160deg, rgba(230,238,255,0.2) 0%, rgba(210,225,255,0.1) 100%)",
        zIndex: 0,
      }} />

      {/* ── Vignette ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(2,4,14,0.35) 100%)",
        zIndex: 1,
      }} />

      {/* ── Content ── */}
      <ProctoringGuard active={proctoringActive} onDisqualify={handleDisqualify}>
        <div className="flex-1 overflow-hidden flex relative z-10 py-4 px-4">

          {/* Light views — centered frosted card over background */}
          {isLight && (
            <div className="flex-1 flex flex-col overflow-hidden max-w-xl mx-auto w-full rounded-3xl"
              style={{
                background:     "rgba(255,255,255,0.78)",
                border:         "1px solid rgba(255,255,255,0.85)",
                backdropFilter: "blur(32px)",
                boxShadow:      "0 8px 48px rgba(15,28,77,0.12), 0 2px 12px rgba(15,28,77,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
              }}>
              {/* Top shimmer */}
              <div className="h-0.5 w-full flex-shrink-0 rounded-t-3xl" style={{
                background: `linear-gradient(90deg, transparent 0%, ${GOLD}60 30%, #2563eb60 70%, transparent 100%)`,
              }} />

              <AnimatePresence mode="wait">

                {/* Chapter picker */}
                {view === "pick" && (
                  <motion.div key="pick" {...FADE} className="flex-1 overflow-y-auto px-5 pt-5 pb-3">
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <BookOpenCheck className="w-4 h-4" style={{ color: GOLD }} />
                        <span className="text-xs font-mono font-bold uppercase tracking-widest" style={{ color: GOLD }}>
                          Select a Chapter
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: `${NAVY}70` }}>
                        Each chapter has an MCQ test and a written exam.
                      </p>
                      {loadError && (
                        <div className="mt-3 text-xs px-3 py-2.5 rounded-xl"
                          style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}>
                          {loadError}
                        </div>
                      )}
                    </div>
                    <ChapterPicker onSelect={handleChapterSelect} />
                  </motion.div>
                )}

                {/* Test type selector */}
                {view === "select-type" && selectedChapter && (
                  <motion.div key="select-type" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                    {loadError && (
                      <div className="mx-5 mt-4 text-xs px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}>
                        {loadError}
                      </div>
                    )}
                    <TestTypeSelector chapter={selectedChapter} onSelect={handleTypeSelect} onBack={() => { setView("pick"); setLoadError(null); }} />
                  </motion.div>
                )}

                {/* Loading */}
                {view === "loading" && (
                  <motion.div key="loading" {...FADE} className="flex-1 flex flex-col items-center justify-center gap-5">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, rgba(200,168,75,0.15), rgba(37,99,235,0.08))`, border: `1px solid rgba(200,168,75,0.3)`, boxShadow: `0 0 40px rgba(200,168,75,0.15)` }}>
                        <Loader2 className="w-7 h-7 animate-spin" style={{ color: GOLD }} />
                      </div>
                      <div className="absolute -inset-3 rounded-[28px] opacity-20 animate-pulse"
                        style={{ background: `radial-gradient(circle, rgba(200,168,75,0.4), transparent 70%)` }} />
                    </div>
                    <div className="text-center">
                      <p className="font-display font-bold text-sm" style={{ color: NAVY }}>Preparing your test</p>
                      <p className="text-xs mt-1 font-mono" style={{ color: `${NAVY}50` }}>{loadingMsg}</p>
                    </div>
                  </motion.div>
                )}

                {/* MCQ test */}
                {view === "mcq-test" && paper && paper.type === "mcq" && (
                  <motion.div key="mcq-test" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                    <MCQTest paperId={paper.paperId} questionIds={paper.questionIds}
                      questions={paper.questions as MCQQuestion[]} chapter={paper.chapter}
                      onComplete={handleMcqComplete} onBack={() => setView("select-type")} />
                  </motion.div>
                )}

                {/* Written test */}
                {view === "written-test" && paper && paper.type === "written" && (
                  <motion.div key="written-test" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                    <WrittenTest paperId={paper.paperId} questions={paper.questions as WrittenQuestion[]}
                      chapter={paper.chapter} onComplete={handleWrittenComplete}
                      onBack={() => setView("select-type")} onPhaseChange={setWrittenPhase} />
                  </motion.div>
                )}

                {/* MCQ result */}
                {view === "mcq-result" && mcqResult && paper && (
                  <motion.div key="mcq-result" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                    <ScoreReport result={mcqResult} chapterTitle={paper.chapter.chapter_title} onRetry={retryMcq} />
                  </motion.div>
                )}

                {/* Written result */}
                {view === "written-result" && writtenResult && paper && (
                  <motion.div key="written-result" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                    <WrittenScoreReport result={writtenResult} chapterTitle={paper.chapter.chapter_title} onRetry={retryWritten} />
                  </motion.div>
                )}

              </AnimatePresence>

              {/* Bottom shimmer */}
              <div className="h-0.5 w-full flex-shrink-0 rounded-b-3xl" style={{
                background: `linear-gradient(90deg, transparent, rgba(200,168,75,0.3), transparent)`,
              }} />
            </div>
          )}

          {/* Test / result views inside the same light glass panel */}
          {!isLight && null /* never reached — kept for type safety */}

        </div>
      </ProctoringGuard>
    </div>
  );
}
