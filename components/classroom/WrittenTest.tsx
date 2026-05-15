"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeft, Clock, Play, Upload, X, ImagePlus,
  Loader2, AlertCircle, CheckCircle2, Send,
} from "lucide-react";
import type { WrittenQuestion, WrittenFeedbackItem, Chapter } from "@/types";

interface Props {
  paperId:   string;
  questions: WrittenQuestion[];
  chapter:   Chapter;
  onComplete: (result: WrittenResult) => void;
  onBack:    () => void;
}

export interface WrittenResult {
  score:     number;
  max_score: number;
  feedback:  Record<string, WrittenFeedbackItem>;
  questions: WrittenQuestion[];
}

const DURATION_SECS = 45 * 60; // 45 minutes

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const SECTION_LABELS: Record<string, string> = {
  A: "Section A — Short Answer (2 marks each)",
  B: "Section B — Medium Answer (4 marks each)",
  C: "Section C — Long Answer (5 marks each)",
};

export function WrittenTest({ paperId, questions, chapter, onBack, onComplete }: Props) {
  type Phase = "intro" | "test" | "upload" | "evaluating";
  const [phase,       setPhase]       = useState<Phase>("intro");
  const [timeLeft,    setTimeLeft]    = useState(DURATION_SECS);
  const [timesUp,     setTimesUp]     = useState(false);
  const [images,      setImages]      = useState<{ file: File; preview: string; url?: string }[]>([]);
  const [uploading,   setUploading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [startTime,   setStartTime]   = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  // Countdown timer
  useEffect(() => {
    if (phase !== "test") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setTimesUp(true);
          setPhase("upload");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phase]);

  const startTest = () => {
    setStartTime(Date.now());
    setPhase("test");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages(prev => [...prev, ...newImages].slice(0, 5));
    e.target.value = "";
  };

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const submitAnswers = useCallback(async () => {
    if (!images.length) { setError("Upload at least one photo of your answer sheet."); return; }
    setUploading(true);
    setError(null);
    setPhase("evaluating");

    try {
      // Upload all images
      const urls: string[] = [];
      for (const img of images) {
        const fd = new FormData();
        fd.append("file", img.file);
        const res = await fetch("/api/classroom/upload-answers", { method: "POST", body: fd });
        if (!res.ok) throw new Error("Image upload failed");
        const { url } = await res.json();
        urls.push(url);
      }

      // Evaluate
      const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined;
      const evalRes = await fetch("/api/classroom/evaluate-written", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ paper_id: paperId, image_urls: urls, time_taken_secs: timeTaken }),
      });
      if (!evalRes.ok) throw new Error(await evalRes.text());
      const data = await evalRes.json();
      onComplete({ ...data, questions });
    } catch (e: any) {
      setError(e.message ?? "Evaluation failed. Please try again.");
      setPhase("upload");
    } finally {
      setUploading(false);
    }
  }, [images, paperId, startTime, questions, onComplete]);

  const isUrgent = timeLeft <= 300 && phase === "test"; // < 5 min

  // ── Intro screen ─────────────────────────────────────────────────────────
  if (phase === "intro") {
    const bySection = questions.reduce<Record<string, WrittenQuestion[]>>((acc, q) => {
      if (!acc[q.section]) acc[q.section] = [];
      acc[q.section]!.push(q);
      return acc;
    }, {});

    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: "rgba(255,255,255,0.8)" }}>
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center">
            <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,184,0,0.7)" }}>Written Test</p>
            <p className="text-sm font-display font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.9)" }}>{chapter.chapter_title}</p>
          </div>
          <div className="w-16" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8">
          {/* Stats row */}
          <div className="flex gap-3 mb-8">
            {[
              { label: "Total Marks", value: `${questions.reduce((s,q)=>s+q.marks,0)}` },
              { label: "Questions",   value: `${questions.length}` },
              { label: "Duration",    value: "45 min" },
            ].map(({ label, value }) => (
              <div key={label} className="flex-1 rounded-xl p-3 text-center"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="font-display font-black text-lg" style={{ color: "#FFB800" }}>{value}</p>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Structure */}
          <div className="space-y-3 mb-8">
            {Object.entries(bySection).map(([sec, qs]) => (
              <div key={sec} className="rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-xs font-mono uppercase mb-2" style={{ color: "rgba(255,184,0,0.7)" }}>
                  {SECTION_LABELS[sec]}
                </p>
                <div className="space-y-1.5">
                  {qs.map((q, i) => (
                    <p key={q.id} className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                      <span className="font-mono" style={{ color: "rgba(255,184,0,0.6)" }}>Q{i+1}.</span> {q.question.slice(0, 90)}{q.question.length > 90 ? "…" : ""}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Instructions */}
          <div className="rounded-xl p-4 mb-6"
            style={{ background: "rgba(255,184,0,0.06)", border: "1px solid rgba(255,184,0,0.18)" }}>
            <p className="text-xs font-mono uppercase mb-2" style={{ color: "rgba(255,184,0,0.7)" }}>Instructions</p>
            <ul className="text-xs space-y-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
              <li>• Read all questions carefully before answering.</li>
              <li>• Write your answers on paper. Use a blue or black pen.</li>
              <li>• The timer begins when you click <strong style={{ color: "rgba(255,255,255,0.8)" }}>Start Test</strong>.</li>
              <li>• After finishing, photograph your answer sheets clearly and upload them.</li>
              <li>• AI will evaluate your answers and provide feedback within ~30 seconds.</li>
            </ul>
          </div>
        </div>

        <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button onClick={startTest}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-bold text-sm transition-all"
            style={{
              background: "linear-gradient(135deg, #FFB800, #FF8C00)",
              color: "#08080F",
              boxShadow: "0 0 24px rgba(255,184,0,0.3)",
            }}>
            <Play className="w-4 h-4" /> Start Test — Timer Begins Now
          </button>
        </div>
      </div>
    );
  }

  // ── Test in progress ──────────────────────────────────────────────────────
  if (phase === "test") {
    const bySection = questions.reduce<Record<string, WrittenQuestion[]>>((acc, q) => {
      if (!acc[q.section]) acc[q.section] = [];
      acc[q.section]!.push(q);
      return acc;
    }, {});

    let qCounter = 0;

    return (
      <div className="flex flex-col h-full">
        {/* Sticky timer bar */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3"
          style={{
            background:   isUrgent ? "rgba(255,45,120,0.08)" : "rgba(255,184,0,0.06)",
            borderBottom: `1px solid ${isUrgent ? "rgba(255,45,120,0.25)" : "rgba(255,184,0,0.2)"}`,
          }}>
          <p className="text-xs font-mono uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
            {chapter.chapter_title}
          </p>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: isUrgent ? "#FF2D78" : "#FFB800" }} />
            <span className="font-mono font-bold text-lg"
              style={{ color: isUrgent ? "#FF2D78" : "#FFB800", minWidth: 52, textAlign: "center" }}>
              {formatTime(timeLeft)}
            </span>
          </div>
          <button
            onClick={() => setPhase("upload")}
            className="text-xs font-display font-bold px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
          >
            I&apos;m Done
          </button>
        </div>

        {/* Questions */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {Object.entries(bySection).map(([sec, qs]) => (
            <div key={sec}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
                <span className="text-[10px] font-mono uppercase px-2 py-1 rounded"
                  style={{ background: "rgba(255,184,0,0.1)", color: "#FFB800", border: "1px solid rgba(255,184,0,0.2)" }}>
                  {SECTION_LABELS[sec]}
                </span>
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.07)" }} />
              </div>

              <div className="space-y-4">
                {qs.map(q => {
                  qCounter++;
                  return (
                    <div key={q.id} className="rounded-2xl p-4"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold mt-0.5"
                          style={{ background: "rgba(255,184,0,0.12)", color: "#FFB800" }}>
                          {qCounter}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}>
                              [{q.marks} mark{q.marks > 1 ? "s" : ""}]
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.88)" }}>
                            {q.question}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="h-4" />
        </div>
      </div>
    );
  }

  // ── Upload phase ──────────────────────────────────────────────────────────
  if (phase === "upload") {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={() => { if (!uploading) setPhase("test"); }}
            className="flex items-center gap-1.5 text-sm opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: "rgba(255,255,255,0.8)", pointerEvents: uploading ? "none" : "auto" }}
          >
            <ChevronLeft className="w-4 h-4" />
            {timesUp ? "Time's Up" : "Back to Paper"}
          </button>
          <div className="text-center">
            <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,184,0,0.7)" }}>
              {timesUp ? "⏱ Time's Up!" : "Upload Answers"}
            </p>
          </div>
          <div className="w-20" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>
            Take clear photos of your written answer sheets. Make sure all answers are legible.
            Upload up to 5 images.
          </p>

          {/* Upload button */}
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
          {images.length < 5 && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl mb-4 transition-all"
              style={{
                background:   "rgba(255,184,0,0.06)",
                border:       "2px dashed rgba(255,184,0,0.25)",
                color:        "#FFB800",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,184,0,0.1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,184,0,0.06)"; }}
            >
              <ImagePlus className="w-5 h-5" />
              <span className="text-sm font-display font-bold">
                {images.length === 0 ? "Add Answer Sheet Photos" : `Add More (${images.length}/5)`}
              </span>
            </button>
          )}

          {/* Image previews */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {images.map((img, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(255,255,255,0.1)", aspectRatio: "3/4" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt={`Sheet ${i+1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono"
                    style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.7)" }}>
                    Page {i + 1}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl mb-3"
              style={{ background: "rgba(255,45,120,0.1)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.2)" }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {images.length > 0 && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl"
              style={{ background: "rgba(0,255,148,0.05)", color: "rgba(0,255,148,0.7)", border: "1px solid rgba(0,255,148,0.15)" }}>
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {images.length} photo{images.length > 1 ? "s" : ""} ready to submit
            </div>
          )}
        </div>

        <div className="flex-shrink-0 px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={submitAnswers}
            disabled={!images.length || uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-bold text-sm transition-all"
            style={{
              background: images.length && !uploading ? "linear-gradient(135deg, #FFB800, #FF8C00)" : "rgba(255,255,255,0.05)",
              color:      images.length && !uploading ? "#08080F" : "rgba(255,255,255,0.25)",
              cursor:     images.length && !uploading ? "pointer" : "not-allowed",
              boxShadow:  images.length && !uploading ? "0 0 24px rgba(255,184,0,0.25)" : "none",
            }}
          >
            <Upload className="w-4 h-4" />
            Submit for AI Evaluation
          </button>
        </div>
      </div>
    );
  }

  // ── Evaluating ────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, rgba(255,184,0,0.15), rgba(255,184,0,0.05))",
          border:     "1px solid rgba(255,184,0,0.3)",
          boxShadow:  "0 0 40px rgba(255,184,0,0.15)",
        }}>
        <Loader2 className="w-7 h-7 animate-spin" style={{ color: "#FFB800" }} />
      </div>
      <div className="text-center max-w-xs">
        <p className="font-display font-bold text-sm mb-1" style={{ color: "rgba(255,255,255,0.8)" }}>
          Evaluating your answers
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
          AI is reading your handwriting and scoring each answer against the marking scheme.
          This takes about 20–40 seconds.
        </p>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-xs px-4 py-2 rounded-xl max-w-sm"
          style={{ background: "rgba(255,45,120,0.1)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.2)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
    </div>
  );
}
