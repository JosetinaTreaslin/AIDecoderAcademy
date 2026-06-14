"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Upload, X, Loader2, ImagePlus, CheckCircle2, RotateCcw, ChevronRight } from "lucide-react";
import type { Chapter, Assignment, AssignmentSubmission, CorrectionResult, AssignmentStatus } from "@/types";
import { CorrectionReport } from "./CorrectionReport";

interface Props {
  chapter:              Chapter;
  assignment:           Assignment;
  submissions:          AssignmentSubmission[];
  onBack:               () => void;
  onSubmissionsChange?: (submissions: AssignmentSubmission[]) => void;
}

const MAX_IMAGES    = 5;
const TEAL          = "#06B6D4";
const NAVY          = "#0f1c4d";
const PASS_THRESHOLD = 80;

interface ImageEntry {
  file:    File;
  preview: string;
}

type Phase = "upload" | "uploading" | "correcting";
type View  = "history" | "submit" | "result";

const STATUS_CHIP: Record<AssignmentStatus, { label: string; bg: string; text: string }> = {
  passed:         { label: "Passed",         bg: "rgba(34,197,94,0.12)",  text: "#16a34a" },
  needs_resubmit: { label: "Needs Resubmit", bg: "rgba(220,38,38,0.1)",   text: "#dc2626" },
};

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins   = Math.floor(diffMs / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AssignmentPanel({ chapter, assignment, submissions: initialSubmissions, onBack, onSubmissionsChange }: Props) {
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>(initialSubmissions);
  const hasPassed = submissions.some(s => s.status === "passed");

  const [view, setView] = useState<View>(submissions.length === 0 ? "submit" : "history");
  const [selected, setSelected] = useState<AssignmentSubmission | null>(
    submissions.length > 0 ? submissions[submissions.length - 1]! : null
  );

  // Upload state
  const [images,    setImages]    = useState<ImageEntry[]>([]);
  const [phase,     setPhase]     = useState<Phase>("upload");
  const [statusMsg, setStatusMsg] = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = phase !== "upload";

  const updateSubmissions = (next: AssignmentSubmission[]) => {
    setSubmissions(next);
    onSubmissionsChange?.(next);
  };

  // ── Add images from file picker ────────────────────────────────────────────
  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files)
      .filter(f => f.type.startsWith("image/"))
      .slice(0, MAX_IMAGES - images.length);

    const newEntries: ImageEntry[] = incoming.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImages(prev => [...prev, ...newEntries].slice(0, MAX_IMAGES));
    setError(null);
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index]!.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  async function uploadImage(entry: ImageEntry): Promise<string> {
    const form = new FormData();
    form.append("file", entry.file);
    const res = await fetch("/api/classroom/upload-answers", { method: "POST", body: form });
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    const { url } = await res.json();
    return url as string;
  }

  const handleSubmit = async () => {
    if (images.length === 0) { setError("Please upload at least one photo of your notes."); return; }
    setError(null);

    try {
      setPhase("uploading");
      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        setStatusMsg(`Uploading page ${i + 1} of ${images.length}…`);
        const url = await uploadImage(images[i]!);
        uploadedUrls.push(url);
      }

      setPhase("correcting");
      setStatusMsg("Checking your notes against the assignment…");

      const res = await fetch("/api/classroom/assignment-submit", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ assignment_id: assignment.id, image_urls: uploadedUrls }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Submission failed");
      }

      const { submission }: { submission: AssignmentSubmission } = await res.json();
      const next = [...submissions, submission];
      updateSubmissions(next);
      setSelected(submission);
      setView("result");

      // Reset upload state for any future resubmission
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);
      setPhase("upload");
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Please try again.");
      setPhase("upload");
    }
  };

  // ── Render: history list ────────────────────────────────────────────────────
  if (view === "history") {
    return (
      <div className="flex flex-col h-full"
        style={{ fontFamily: "var(--font-dm-sans,'DM Sans',sans-serif)" }}>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: `1px solid ${TEAL}22` }}>
          <button onClick={onBack}
            className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: NAVY }}>
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: TEAL }}>
              Assignment
            </p>
            <p className="text-sm font-bold truncate" style={{ color: NAVY }}>{assignment.title}</p>
          </div>
          <div className="text-xs px-2 py-1 rounded-lg font-semibold flex-shrink-0"
            style={{ background: `${TEAL}15`, color: TEAL }}>
            {chapter.subject}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "none" }}>

          {assignment.instructions && (
            <div className="rounded-2xl p-4 mb-4"
              style={{ background: `${TEAL}0D`, border: `1px solid ${TEAL}30` }}>
              <p className="text-sm font-bold mb-1" style={{ color: NAVY }}>📌 Instructions</p>
              <p className="text-xs leading-relaxed" style={{ color: `${NAVY}80` }}>
                {assignment.instructions}
              </p>
            </div>
          )}

          {hasPassed && (
            <div className="rounded-2xl p-4 mb-4 flex items-center gap-3"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <span className="text-xl">✅</span>
              <p className="text-sm font-bold" style={{ color: "#16a34a" }}>
                You've passed this assignment!
              </p>
            </div>
          )}

          <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: `${NAVY}50` }}>
            Submission History
          </p>

          {submissions.length === 0 && (
            <p className="text-xs" style={{ color: `${NAVY}60` }}>No submissions yet.</p>
          )}

          <div className="flex flex-col gap-2">
            {[...submissions].reverse().map(sub => {
              const chip = STATUS_CHIP[sub.status];
              return (
                <motion.button
                  key={sub.id}
                  onClick={() => { setSelected(sub); setView("result"); }}
                  className="flex items-center gap-3 rounded-xl p-3 text-left"
                  style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.06)" }}
                  whileHover={{ background: "rgba(0,0,0,0.04)" }}>
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
                    style={{ background: `${TEAL}15`, color: TEAL }}>
                    #{sub.attempt_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold" style={{ color: NAVY }}>
                        {sub.accuracy_score}/100
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: chip.bg, color: chip.text }}>
                        {chip.label}
                      </span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: `${NAVY}50` }}>
                      {timeAgo(sub.submitted_at)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: `${NAVY}40` }} />
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        {!hasPassed && (
          <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: `1px solid ${TEAL}22` }}>
            <motion.button
              onClick={() => setView("submit")}
              className="w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${TEAL}, #0891B2)`, color: "#fff",
                boxShadow: `0 4px 24px ${TEAL}50` }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}>
              {submissions.length === 0
                ? <><CheckCircle2 className="w-4 h-4" /> Submit Classwork</>
                : <><RotateCcw className="w-4 h-4" /> Resubmit</>
              }
            </motion.button>
          </div>
        )}
      </div>
    );
  }

  // ── Render: result (CorrectionReport with pass/fail banner) ──────────────────
  if (view === "result" && selected) {
    const result: CorrectionResult = {
      accuracy_score:       selected.accuracy_score,
      teacher_summary:      selected.teacher_summary,
      issues:               selected.issues,
      positives:            selected.positives,
      image_urls:           selected.image_urls,
      annotated_image_urls: selected.annotated_image_urls,
    };

    const passed = selected.status === "passed";

    const banner = (
      <div className="px-5 py-3 flex items-center justify-between gap-3"
        style={{
          background: passed ? "rgba(34,197,94,0.1)" : "rgba(220,38,38,0.08)",
          borderBottom: `1px solid ${passed ? "rgba(34,197,94,0.25)" : "rgba(220,38,38,0.2)"}`,
        }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{passed ? "✅" : "⚠️"}</span>
          <p className="text-sm font-bold" style={{ color: passed ? "#16a34a" : "#dc2626" }}>
            {passed
              ? "Passed! Great work."
              : `Needs resubmit — score below ${PASS_THRESHOLD}%`}
          </p>
        </div>
        {!passed && (
          <motion.button
            onClick={() => setView("submit")}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl"
            style={{ background: "#dc2626", color: "#fff" }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}>
            <RotateCcw className="w-3.5 h-3.5" /> Resubmit
          </motion.button>
        )}
      </div>
    );

    return (
      <CorrectionReport
        result={result}
        chapter={chapter.chapter_title}
        onBack={() => setView("history")}
        banner={banner}
      />
    );
  }

  // ── Render: submit (upload UI) ────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full relative"
      style={{ fontFamily: "var(--font-dm-sans,'DM Sans',sans-serif)" }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: `1px solid ${TEAL}22` }}>
        <button onClick={() => submissions.length > 0 ? setView("history") : onBack()}
          disabled={busy}
          className="flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: NAVY }}>
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: TEAL }}>
            {submissions.length === 0 ? "Submit Classwork" : "Resubmit Classwork"}
          </p>
          <p className="text-sm font-bold truncate" style={{ color: NAVY }}>{assignment.title}</p>
        </div>
        <div className="text-xs px-2 py-1 rounded-lg font-semibold flex-shrink-0"
          style={{ background: `${TEAL}15`, color: TEAL }}>
          {chapter.subject}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "none" }}>

        <div className="rounded-2xl p-4 mb-4 flex items-start gap-3"
          style={{ background: `${TEAL}0D`, border: `1px solid ${TEAL}30` }}>
          <span className="text-xl flex-shrink-0">✏️</span>
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: NAVY }}>
              Upload photos of your completed classwork
            </p>
            <p className="text-xs leading-relaxed" style={{ color: `${NAVY}80` }}>
              Take clear, well-lit photos of your handwritten notes for "{chapter.chapter_title}".
              You need at least {PASS_THRESHOLD}% accuracy to pass. Up to {MAX_IMAGES} pages.
            </p>
          </div>
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <AnimatePresence>
              {images.map((entry, i) => (
                <motion.div key={entry.preview}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.18 }}
                  className="relative rounded-xl overflow-hidden aspect-[3/4]"
                  style={{ border: `1.5px solid ${TEAL}40`, background: "#f0f0f0" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.preview} alt={`Page ${i + 1}`}
                    className="w-full h-full object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1"
                    style={{ background: "rgba(15,28,77,0.55)", backdropFilter: "blur(4px)" }}>
                    <span className="text-[10px] font-bold text-white">Page {i + 1}</span>
                  </div>
                  {!busy && (
                    <button onClick={() => removeImage(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-opacity hover:opacity-90"
                      style={{ background: "rgba(220,38,38,0.85)" }}>
                      <X className="w-3 h-3 text-white" />
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {images.length < MAX_IMAGES && !busy && (
          <motion.button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-2xl flex flex-col items-center justify-center gap-2 py-8 transition-colors"
            style={{ border: `2px dashed ${TEAL}50`, background: `${TEAL}06`, color: TEAL }}
            whileHover={{ background: `${TEAL}12`, borderColor: TEAL }}
            transition={{ duration: 0.15 }}>
            <ImagePlus className="w-6 h-6" />
            <span className="text-sm font-semibold">
              {images.length === 0 ? "Tap to add photos" : `Add more (${images.length}/${MAX_IMAGES})`}
            </span>
            <span className="text-xs opacity-60">JPG or PNG, max 10 MB each</span>
          </motion.button>
        )}

        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={e => handleFiles(e.target.files)} />

        {error && (
          <div className="mt-3 rounded-xl px-4 py-3 text-xs font-medium"
            style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}>
            {error}
          </div>
        )}
      </div>

      {/* Loading overlay */}
      <AnimatePresence>
        {busy && (
          <motion.div
            key="loading-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-3xl"
            style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", zIndex: 20 }}>
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${TEAL}22, ${TEAL}0A)`,
                  border: `1px solid ${TEAL}50`, boxShadow: `0 0 32px ${TEAL}30` }}>
                {phase === "correcting"
                  ? <span className="text-3xl">📝</span>
                  : <Upload className="w-7 h-7 animate-bounce" style={{ color: TEAL }} />
                }
              </div>
              <div className="absolute -inset-3 rounded-[28px] opacity-20 animate-pulse"
                style={{ background: `radial-gradient(circle, ${TEAL}60, transparent 70%)` }} />
            </div>
            <div className="text-center">
              <p className="font-bold text-sm" style={{ color: NAVY }}>
                {phase === "correcting" ? "Reviewing notes…" : "Uploading pages…"}
              </p>
              <p className="text-xs mt-1 font-mono" style={{ color: `${NAVY}55` }}>
                {statusMsg}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: `1px solid ${TEAL}22` }}>
        <motion.button
          onClick={handleSubmit}
          disabled={busy || images.length === 0}
          className="w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-opacity"
          style={{
            background: images.length === 0 || busy
              ? "rgba(0,0,0,0.08)"
              : `linear-gradient(135deg, ${TEAL}, #0891B2)`,
            color:   images.length === 0 || busy ? "rgba(0,0,0,0.3)" : "#fff",
            boxShadow: images.length > 0 && !busy ? `0 4px 24px ${TEAL}50` : "none",
          }}
          whileHover={images.length > 0 && !busy ? { scale: 1.01 } : {}}
          whileTap={images.length > 0 && !busy ? { scale: 0.98 } : {}}
          transition={{ duration: 0.12 }}>
          {busy
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</>
            : <><CheckCircle2 className="w-4 h-4" /> Submit ({images.length} {images.length === 1 ? "page" : "pages"})</>
          }
        </motion.button>
        {images.length === 0 && (
          <p className="text-center text-[10px] mt-2" style={{ color: `${NAVY}50` }}>
            Add at least one photo to continue
          </p>
        )}
      </div>
    </div>
  );
}
