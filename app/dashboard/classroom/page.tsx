"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Loader2, BookOpenCheck } from "lucide-react";
import { ChapterPicker }       from "@/components/classroom/ChapterPicker";
import { TestTypeSelector }    from "@/components/classroom/TestTypeSelector";
import { MCQTest, type SubmitResult as MCQResult } from "@/components/classroom/MCQTest";
import { ScoreReport }         from "@/components/classroom/ScoreReport";
import { WrittenTest, type WrittenResult } from "@/components/classroom/WrittenTest";
import { WrittenScoreReport }  from "@/components/classroom/WrittenScoreReport";
import type { Chapter, MCQQuestion, WrittenQuestion } from "@/types";

type View =
  | "pick"
  | "select-type"
  | "loading"
  | "mcq-test"
  | "written-test"
  | "mcq-result"
  | "written-result";

interface PaperData {
  paperId:     string;
  questionIds: string[];
  questions:   MCQQuestion[] | WrittenQuestion[];
  chapter:     Chapter;
  type:        "mcq" | "written";
}

const FADE = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 }, transition: { duration: 0.22 } };

export default function ClassroomPage() {
  const [view,         setView]         = useState<View>("pick");
  const [selectedChapter, setChapter]  = useState<Chapter | null>(null);
  const [paper,        setPaper]        = useState<PaperData | null>(null);
  const [mcqResult,    setMcqResult]    = useState<MCQResult | null>(null);
  const [writtenResult,setWrittenResult]= useState<WrittenResult | null>(null);
  const [loadError,    setLoadError]    = useState<string | null>(null);
  const [loadingMsg,   setLoadingMsg]   = useState("");

  const handleChapterSelect = (chapter: Chapter) => {
    setChapter(chapter);
    setLoadError(null);
    setView("select-type");
  };

  const loadPaper = async (chapter: Chapter, type: "mcq" | "written") => {
    setView("loading");
    setLoadingMsg(type === "mcq" ? "Selecting 15 questions from the bank…" : "Loading question paper…");
    setLoadError(null);
    try {
      const res = await fetch(`/api/classroom/paper?chapter_id=${chapter.id}&type=${type}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setPaper({
        paperId:     data.paper_id,
        questionIds: data.question_ids ?? data.questions.map((q: any) => q.id),
        questions:   data.questions,
        chapter:     data.chapter,
        type,
      });
      setView(type === "mcq" ? "mcq-test" : "written-test");
    } catch (e: any) {
      setLoadError(e.message ?? "Failed to load paper. Please try again.");
      setView("select-type");
    }
  };

  const handleTypeSelect = (type: "mcq" | "written") => {
    if (selectedChapter) loadPaper(selectedChapter, type);
  };

  const handleMcqComplete = (r: MCQResult) => { setMcqResult(r); setView("mcq-result"); };
  const handleWrittenComplete = (r: WrittenResult) => { setWrittenResult(r); setView("written-result"); };

  const retryMcq     = () => paper && loadPaper(paper.chapter, "mcq");
  const retryWritten = () => paper && loadPaper(paper.chapter, "written");

  return (
    <div className="flex flex-col" style={{ height: "100dvh", background: "#08080F" }}>

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4"
        style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.05))", border: "1px solid rgba(0,212,255,0.3)" }}>
          <GraduationCap className="w-4 h-4" style={{ color: "#00D4FF" }} />
        </div>
        <div>
          <h1 className="font-display font-black text-base" style={{ color: "rgba(255,255,255,0.92)" }}>Classroom</h1>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>CBSE · Grade 10 · Science</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 flex flex-col overflow-hidden max-w-2xl mx-auto w-full">
          <AnimatePresence mode="wait">

            {/* Chapter picker */}
            {view === "pick" && (
              <motion.div key="pick" {...FADE} className="flex-1 overflow-y-auto px-4 py-6">
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpenCheck className="w-4 h-4" style={{ color: "#00D4FF" }} />
                    <span className="text-xs font-mono uppercase tracking-widest" style={{ color: "#00D4FF" }}>
                      Select a Chapter
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Each chapter has an MCQ test and a written exam. Pick one to begin.
                  </p>
                  {loadError && (
                    <div className="mt-3 text-xs px-3 py-2 rounded-xl"
                      style={{ background: "rgba(255,45,120,0.1)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.2)" }}>
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
                  <div className="mx-4 mt-4 text-xs px-3 py-2 rounded-xl"
                    style={{ background: "rgba(255,45,120,0.1)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.2)" }}>
                    {loadError}
                  </div>
                )}
                <TestTypeSelector
                  chapter={selectedChapter}
                  onSelect={handleTypeSelect}
                  onBack={() => { setView("pick"); setLoadError(null); }}
                />
              </motion.div>
            )}

            {/* Loading */}
            {view === "loading" && (
              <motion.div key="loading" {...FADE}
                className="flex-1 flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))", border: "1px solid rgba(0,212,255,0.3)", boxShadow: "0 0 40px rgba(0,212,255,0.15)" }}>
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#00D4FF" }} />
                </div>
                <div className="text-center">
                  <p className="font-display font-bold text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>Preparing your test</p>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{loadingMsg}</p>
                </div>
              </motion.div>
            )}

            {/* MCQ test */}
            {view === "mcq-test" && paper && paper.type === "mcq" && (
              <motion.div key="mcq-test" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                <MCQTest
                  paperId={paper.paperId}
                  questionIds={paper.questionIds}
                  questions={paper.questions as MCQQuestion[]}
                  chapter={paper.chapter}
                  onComplete={handleMcqComplete}
                  onBack={() => setView("select-type")}
                />
              </motion.div>
            )}

            {/* Written test */}
            {view === "written-test" && paper && paper.type === "written" && (
              <motion.div key="written-test" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                <WrittenTest
                  paperId={paper.paperId}
                  questions={paper.questions as WrittenQuestion[]}
                  chapter={paper.chapter}
                  onComplete={handleWrittenComplete}
                  onBack={() => setView("select-type")}
                />
              </motion.div>
            )}

            {/* MCQ result */}
            {view === "mcq-result" && mcqResult && paper && (
              <motion.div key="mcq-result" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                <ScoreReport
                  result={mcqResult}
                  chapterTitle={paper.chapter.chapter_title}
                  onRetry={retryMcq}
                />
              </motion.div>
            )}

            {/* Written result */}
            {view === "written-result" && writtenResult && paper && (
              <motion.div key="written-result" {...FADE} className="flex-1 overflow-hidden flex flex-col">
                <WrittenScoreReport
                  result={writtenResult}
                  chapterTitle={paper.chapter.chapter_title}
                  onRetry={retryWritten}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
