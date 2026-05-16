"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Loader2, BookOpenCheck, Sparkles } from "lucide-react";
import { ChapterPicker }       from "@/components/classroom/ChapterPicker";
import { TestTypeSelector }    from "@/components/classroom/TestTypeSelector";
import { MCQTest, type SubmitResult as MCQResult } from "@/components/classroom/MCQTest";
import { ScoreReport }         from "@/components/classroom/ScoreReport";
import { WrittenTest, type WrittenResult } from "@/components/classroom/WrittenTest";
import { WrittenScoreReport }  from "@/components/classroom/WrittenScoreReport";
import { ProctoringGuard }     from "@/components/classroom/ProctoringGuard";
import type { Chapter, MCQQuestion, WrittenQuestion, WrittenFeedbackItem } from "@/types";

// ── Classroom palette (derived from background.png) ───────────────────────────
const CL = {
  cyan:        "#00D4FF",
  cyanDim:     "rgba(0,212,255,0.12)",
  cyanGlow:    "rgba(0,212,255,0.25)",
  gold:        "#C8A84B",
  goldDim:     "rgba(200,168,75,0.12)",
  goldBorder:  "rgba(200,168,75,0.22)",
  goldGlow:    "rgba(200,168,75,0.3)",
  panel:       "rgba(6,8,20,0.78)",
  panelBorder: "rgba(200,168,75,0.18)",
  topbar:      "rgba(4,6,18,0.88)",
};

type View =
  | "pick" | "select-type" | "loading"
  | "mcq-test" | "written-test"
  | "mcq-result" | "written-result";

interface PaperData {
  paperId: string; questionIds: string[];
  questions: MCQQuestion[] | WrittenQuestion[];
  chapter: Chapter; type: "mcq" | "written";
}

const FADE  = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.24 } };
const STEPS = ["Chapter", "Test Type", "In Progress", "Results"];

function viewToStep(v: View) {
  if (v === "pick")        return 0;
  if (v === "select-type") return 1;
  if (v === "loading" || v === "mcq-test" || v === "written-test") return 2;
  return 3;
}

export default function ClassroomPage() {
  const [view,           setView]          = useState<View>("pick");
  const [selectedChapter,setChapter]       = useState<Chapter | null>(null);
  const [paper,          setPaper]         = useState<PaperData | null>(null);
  const [mcqResult,      setMcqResult]     = useState<MCQResult | null>(null);
  const [writtenResult,  setWrittenResult] = useState<WrittenResult | null>(null);
  const [loadError,      setLoadError]     = useState<string | null>(null);
  const [loadingMsg,     setLoadingMsg]    = useState("");
  const [writtenPhase,   setWrittenPhase]  = useState("intro");

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
  const currentStep      = viewToStep(view);

  return (
    <div
      className="flex flex-col"
      style={{
        height:              "100dvh",
        backgroundImage:     "url('/classroom/background.png')",
        backgroundSize:      "cover",
        backgroundPosition:  "center",
        backgroundRepeat:    "no-repeat",
        position:            "relative",
      }}
    >
      {/* ── Dark overlay to keep dark UI readable over light image ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(160deg, rgba(4,6,22,0.86) 0%, rgba(6,8,28,0.80) 50%, rgba(4,6,22,0.88) 100%)",
        zIndex: 0,
      }} />

      {/* ── Subtle vignette ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 40%, rgba(2,4,14,0.6) 100%)",
        zIndex: 1,
      }} />

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 relative z-10" style={{
        background:   CL.topbar,
        borderBottom: `1px solid ${CL.panelBorder}`,
        backdropFilter: "blur(20px)",
        boxShadow: `0 1px 0 ${CL.goldBorder}, 0 4px 24px rgba(0,0,0,0.4)`,
      }}>
        <div className="flex items-center justify-between px-6 py-3">

          {/* Logo / title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{
              background: `linear-gradient(135deg, ${CL.goldDim}, rgba(200,168,75,0.04))`,
              border:     `1px solid ${CL.goldBorder}`,
              boxShadow:  `0 0 20px ${CL.goldDim}`,
            }}>
              <GraduationCap className="w-4.5 h-4.5" style={{ color: CL.gold }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display font-black text-base leading-none" style={{ color: "#fff" }}>
                  Classroom
                </h1>
                <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{
                  background: CL.goldDim, color: CL.gold, border: `1px solid ${CL.goldBorder}`,
                }}>
                  <Sparkles className="w-2.5 h-2.5" />AI Powered
                </span>
              </div>
              <p className="text-[11px] mt-0.5 font-mono" style={{ color: "rgba(200,168,75,0.5)" }}>
                CBSE · Grade 10 · Science
              </p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="hidden sm:flex items-center gap-1.5">
            {STEPS.map((label, i) => {
              const done   = i < currentStep;
              const active = i === currentStep;
              return (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold transition-all duration-300"
                      style={{
                        background: active ? CL.cyan   : done ? CL.gold    : "rgba(255,255,255,0.05)",
                        color:      active ? "#031024" : done ? "#08080F"  : "rgba(255,255,255,0.2)",
                        border:     active ? "none"    : done ? "none"      : "1px solid rgba(255,255,255,0.08)",
                        boxShadow:  active ? `0 0 12px ${CL.cyanGlow}` : done ? `0 0 8px ${CL.goldGlow}` : "none",
                      }}>
                      {done ? "✓" : i + 1}
                    </div>
                    <span className="text-[10px] font-mono hidden md:block transition-colors" style={{
                      color: active ? CL.cyan : done ? CL.gold : "rgba(255,255,255,0.2)",
                    }}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="w-5 h-px transition-colors duration-500" style={{
                      background: done ? CL.gold : "rgba(255,255,255,0.07)",
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <ProctoringGuard active={proctoringActive} onDisqualify={handleDisqualify}>
        <div className="flex-1 overflow-hidden flex relative z-10 py-4 px-4">
          {/* Glass panel — floats over the background */}
          <div className="flex-1 flex flex-col overflow-hidden max-w-2xl mx-auto w-full rounded-2xl" style={{
            background:    CL.panel,
            border:        `1px solid ${CL.panelBorder}`,
            backdropFilter:"blur(28px)",
            boxShadow:     `0 0 0 1px rgba(200,168,75,0.08), 0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(200,168,75,0.12)`,
          }}>

            {/* Gold shimmer line at top of panel */}
            <div className="h-px w-full flex-shrink-0" style={{
              background: `linear-gradient(90deg, transparent, ${CL.gold}, ${CL.cyan}, ${CL.gold}, transparent)`,
              opacity: 0.5,
            }} />

            <AnimatePresence mode="wait">

              {/* Chapter picker */}
              {view === "pick" && (
                <motion.div key="pick" {...FADE} className="flex-1 overflow-y-auto px-5 py-6">
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1.5">
                      <BookOpenCheck className="w-4 h-4" style={{ color: CL.gold }} />
                      <span className="text-xs font-mono uppercase tracking-widest" style={{ color: CL.gold }}>
                        Select a Chapter
                      </span>
                    </div>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Each chapter has an MCQ test and a written exam. Pick one to begin.
                    </p>
                    {loadError && (
                      <div className="mt-3 text-xs px-3 py-2.5 rounded-xl"
                        style={{ background: "rgba(255,45,120,0.08)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.2)" }}>
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
                      style={{ background: "rgba(255,45,120,0.08)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.2)" }}>
                      {loadError}
                    </div>
                  )}
                  <TestTypeSelector chapter={selectedChapter} onSelect={handleTypeSelect} onBack={() => { setView("pick"); setLoadError(null); }} />
                </motion.div>
              )}

              {/* Loading */}
              {view === "loading" && (
                <motion.div key="loading" {...FADE} className="flex-1 flex flex-col items-center justify-center gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{
                      background: `linear-gradient(135deg, ${CL.goldDim}, rgba(0,212,255,0.06))`,
                      border:     `1px solid ${CL.goldBorder}`,
                      boxShadow:  `0 0 60px ${CL.goldDim}, 0 0 120px rgba(0,212,255,0.06)`,
                    }}>
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: CL.gold }} />
                    </div>
                    <div className="absolute -inset-4 rounded-[32px] opacity-30 animate-pulse" style={{
                      background: `radial-gradient(circle, ${CL.goldGlow}, transparent 70%)`,
                    }} />
                  </div>
                  <div className="text-center">
                    <p className="font-display font-bold text-base" style={{ color: "rgba(255,255,255,0.85)" }}>
                      Preparing your test
                    </p>
                    <p className="text-xs mt-1.5 font-mono" style={{ color: "rgba(200,168,75,0.5)" }}>{loadingMsg}</p>
                  </div>
                </motion.div>
              )}

              {/* MCQ test */}
              {view === "mcq-test" && paper && paper.type === "mcq" && (
                <motion.div key="mcq-test" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                  <MCQTest
                    paperId={paper.paperId} questionIds={paper.questionIds}
                    questions={paper.questions as MCQQuestion[]} chapter={paper.chapter}
                    onComplete={handleMcqComplete} onBack={() => setView("select-type")}
                  />
                </motion.div>
              )}

              {/* Written test */}
              {view === "written-test" && paper && paper.type === "written" && (
                <motion.div key="written-test" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                  <WrittenTest
                    paperId={paper.paperId} questions={paper.questions as WrittenQuestion[]}
                    chapter={paper.chapter} onComplete={handleWrittenComplete}
                    onBack={() => setView("select-type")} onPhaseChange={setWrittenPhase}
                  />
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

            {/* Gold shimmer line at bottom of panel */}
            <div className="h-px w-full flex-shrink-0" style={{
              background: `linear-gradient(90deg, transparent, ${CL.goldBorder}, transparent)`,
            }} />
          </div>
        </div>
      </ProctoringGuard>
    </div>
  );
}
