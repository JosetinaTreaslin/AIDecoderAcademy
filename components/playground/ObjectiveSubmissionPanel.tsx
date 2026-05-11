"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { speakAsTeacher, type SpeakHandle } from "@/lib/teacherAudio";
import {
  type StagedRubric,
  type WorksheetUpload,
  type WhiteboardImageMessage,
  type FinalResult,
} from "@/lib/obj10Rubric";
import { useValidatorWriter } from "@/lib/chatChannels";
import { getObjectiveIntro, type ObjectiveIntroBeat } from "@/lib/objectiveIntros";

// SAGE — the validator's name. Replaces the bureaucratic "VALIDATOR" label.
// One syllable, gender-neutral, suggests insight without being old-timer.
const VALIDATOR_NAME = "SAGE";

// Pause between dialogue beats (ms). Short enough to feel like conversation,
// long enough that each line LANDS before the next starts. JRPG-paced.
const BEAT_PAUSE_MS = 600;

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────
// Validator panel — DIALOGUE-ONLY.
//
// All inputs (worksheet form, .docx/.pdf upload, comic/video upload, notes)
// live in WorksheetPopup. This panel does just three things:
//   1. INTRO   — first session open: warm-coach greeting + Got It.
//   2. READY   — kid taps teacher again: shows status + a single Validate
//                button. Clicking it pulls the saved pending payload + the
//                most-recent whiteboard output and hits the validator route.
//   3. RESULT  — tier badge, stage scores, feedback script, retry/done.
// ─────────────────────────────────────────────────────────────────────────

interface Props {
  open:             boolean;
  rubric:           StagedRubric;
  profile:          { id?: string; display_name?: string; age_group?: string } | null;
  whiteboardImages: WhiteboardImageMessage[];   // recent images from whiteboard chat
  // Worksheet docs the kid dropped into chat (priority: popup wins, this is fallback)
  whiteboardDocs?:  { url: string; filename: string; format: "pdf" | "docx" }[];
  onClose:          () => void;
  onComplete:       (composite: number, tier: FinalResult["tier"]) => Promise<void>;
}

// Funny SAGE one-liners for "no worksheet anywhere" — kid sees one at random.
// SAGE = Skeptical Mentor, but with a wry sense of humour. Never mean.
const FUNNY_NO_WORKSHEET = [
  "The worksheet is emptier than my patience right now. Fill it in, or drop the doc.",
  "I'm staring at a blank slate. Worksheet, please.",
  "No worksheet, no validation. The form's right there. The upload zone's right there. Pick one.",
  "You came to be graded… without the work. Bold. Now fill the worksheet.",
  "Help me help you. I need either the form filled in or a doc uploaded.",
] as const;

type Phase = "intro" | "ready" | "submitting" | "result";

// ── Context-aware ready-line picker ─────────────────────────────────────────
// On second+ opens (after the intro has been shown), Sage doesn't repeat the
// task brief. Instead Sage notices SOMETHING SPECIFIC about what the kid did —
// uploaded files, wrote thoughtful notes, generated whiteboard images — and
// reflects it back. This is the parasocial-bond mechanic: the kid feels SEEN.
// Generic random pools came across as a chatbot; this feels like a coach who
// looked at your work before you sat down.

const READY_LINES_EMPTY = [
  "No rush. Worksheet first… then come back.",
  "Take your time. Get the brief right and the rest follows.",
  "The worksheet is waiting whenever you are.",
];

const READY_LINES_GENERIC_PENDING = [
  "Right. Show me what you've got.",
  "Let me have a look.",
  "When you're ready, I am.",
];

interface ReadyContext {
  hasInlineForm:   boolean;
  hasFile:         boolean;
  mediaCount:      number;
  notesLen:        number;
  whiteboardCount: number;
  isObj6:          boolean;
}

function pickReadyLine(ctx: ReadyContext): string {
  const { hasInlineForm, hasFile, mediaCount, notesLen, whiteboardCount, isObj6 } = ctx;
  const hasWorksheet = hasInlineForm || hasFile;

  // Nothing yet — gentle, not pushy.
  if (!hasWorksheet && mediaCount === 0 && whiteboardCount === 0) {
    return pickRandom(READY_LINES_EMPTY);
  }

  // Specific notice patterns — Sage commenting on what the kid actually did.
  if (hasFile && mediaCount > 0 && notesLen > 50) {
    return "You filled this out properly. Let's see how it lands.";
  }
  if (mediaCount >= 3) {
    return `Three uploads? Confident move. Let me have a look.`;
  }
  if (notesLen > 100) {
    return "Your notes show you actually thought about it. Let's check the work.";
  }
  if (hasFile && !mediaCount) {
    return isObj6
      ? "Worksheet's in. Now I just need the video."
      : "Worksheet's in. Where's the comic?";
  }
  if (!hasWorksheet && mediaCount > 0) {
    return "I see the upload, but the worksheet first. Always.";
  }
  if (!hasWorksheet && whiteboardCount > 0 && !isObj6) {
    return "I notice you've been drawing in the whiteboard. Worksheet first, then we'll talk about it.";
  }

  // Default: pending exists, nothing remarkable about it — generic ready line.
  return pickRandom(READY_LINES_GENERIC_PENDING);
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TIER_META = {
  distinction: { label: "DISTINCTION", color: "#C8FF00", emoji: "🏆" },
  merit:       { label: "MERIT",       color: "#FFB020", emoji: "⭐" },
  pass:        { label: "PASS",        color: "#7BFFC4", emoji: "✅" },
  fail:        { label: "TRY AGAIN",   color: "#FF6B6B", emoji: "🔄" },
} as const;

// What the Worksheet popup writes to localStorage. Same shape as
// WorksheetSubmissionPayload — kept inline here to avoid a circular import.
interface PendingPayload {
  lmsId:           string;
  data:            Record<string, string | boolean>;
  worksheetFile?:  { url: string; format: "pdf" | "docx"; filename: string };
  mediaUrls?:      string[];
  notes?:          string;
}

function readPending(lmsId: string, profileId?: string): PendingPayload | null {
  if (typeof window === "undefined" || !profileId) return null;
  try {
    const raw = localStorage.getItem(`aida:worksheet:${lmsId}:${profileId}:pending`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.lmsId === lmsId) return parsed as PendingPayload;
    return null;
  } catch {
    return null;
  }
}

function clearPending(lmsId: string, profileId?: string) {
  if (typeof window === "undefined" || !profileId) return;
  localStorage.removeItem(`aida:worksheet:${lmsId}:${profileId}:pending`);
}

function clearDraft(lmsId: string, profileId?: string) {
  if (typeof window === "undefined" || !profileId) return;
  localStorage.removeItem(`aida:worksheet:${lmsId}:${profileId}:draft`);
}

export function ObjectiveSubmissionPanel({
  open, rubric, profile, whiteboardImages, whiteboardDocs = [], onClose, onComplete,
}: Props) {
  const isObj6        = rubric.lmsId === "l1-06";
  const validateUrl   = isObj6 ? "/api/aida/validate/obj6" : "/api/aida/validate/obj10";

  const [phase,   setPhase]   = useState<Phase>("intro");
  const [pending, setPending] = useState<PendingPayload | null>(null);
  const [result,  setResult]  = useState<FinalResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [text,    setText]    = useState("");
  const [revealed,setRevealed]= useState(0);

  const speakRef         = useRef<SpeakHandle | null>(null);
  const validateAbortRef = useRef<AbortController | null>(null);
  const { setLast: publishValidator } = useValidatorWriter();

  // ── Speak helpers ────────────────────────────────────────────────────────
  // We track an "active speech generation" id so that if a new speak* call
  // fires while a beat sequence is mid-flight, the in-flight loop bails out
  // before starting the next beat instead of stomping on the new line.
  const speechGenRef = useRef(0);

  function stopSpeaking() {
    speechGenRef.current++;
    if (speakRef.current) { speakRef.current.cancel(); speakRef.current = null; }
  }
  function speakLine(line: string) {
    stopSpeaking();
    const myGen = speechGenRef.current;
    setText(line);
    setRevealed(0);
    speakRef.current = null;
    speakAsTeacher(line).then(h => {
      if (speechGenRef.current !== myGen) { h?.cancel(); return; }
      speakRef.current = h;
    }).catch(() => {});
  }
  /**
   * Speak a sequence of dialogue beats with a pause between each. Each beat
   * gets its own typewriter reveal — a 60-word block becomes three short
   * statements that each LAND before the next starts. JRPG-paced.
   *
   * If a new speak* call interrupts mid-sequence, the loop exits cleanly.
   */
  async function speakBeats(beats: ObjectiveIntroBeat[]) {
    stopSpeaking();
    const myGen = speechGenRef.current;
    for (let i = 0; i < beats.length; i++) {
      if (speechGenRef.current !== myGen) return;
      const beat = beats[i];
      setText(beat.text);
      setRevealed(0);
      try {
        const handle = await speakAsTeacher(beat.text);
        if (speechGenRef.current !== myGen) { handle?.cancel(); return; }
        speakRef.current = handle;
        // Wait for this beat's audio to mostly finish before pausing
        // and moving on. We poll progress01 instead of awaiting a "done"
        // because speakAsTeacher returns before audio finishes.
        await waitForBeatFinish(handle, myGen);
        if (speechGenRef.current !== myGen) return;
        if (i < beats.length - 1) await sleep(BEAT_PAUSE_MS);
      } catch {
        // Single beat failure is non-fatal — continue to next.
      }
    }
  }
  async function waitForBeatFinish(handle: SpeakHandle | null, myGen: number) {
    if (!handle) return;
    // Bail out if interrupted, audio finished, or 8s safety cap hit.
    const startedAt = Date.now();
    while (speechGenRef.current === myGen && (Date.now() - startedAt) < 8000) {
      const p = handle.progress01();
      if (p >= 0.95) return;
      await sleep(80);
    }
  }

  // ── Greet on open. First open of the session = intro (3-beat reveal).
  //     Subsequent opens = ready, with a context-aware notice line. ─────────
  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);

    const fresh = readPending(rubric.lmsId, profile?.id);
    setPending(fresh);

    let isFirstOpen = false;
    if (typeof window !== "undefined") {
      // v2 key so a previously-poisoned "shown" flag from earlier crash
      // loops doesn't suppress the pep-talk we want to play.
      const introKey = `aida:intro-shown-v2:${rubric.lmsId}`;
      if (!sessionStorage.getItem(introKey)) {
        isFirstOpen = true;
        sessionStorage.setItem(introKey, "1");
      }
    }

    const intro = getObjectiveIntro(rubric.lmsId);
    if (isFirstOpen && intro) {
      // Three-beat reveal — each beat lands separately.
      setPhase("intro");
      void speakBeats(intro.beats);
    } else {
      // Second+ open: contextual notice line that reflects what's pending.
      setPhase("ready");
      const ctx: ReadyContext = {
        hasInlineForm:   !!(fresh?.data && Object.keys(fresh.data).length > 0),
        hasFile:         !!fresh?.worksheetFile,
        mediaCount:      fresh?.mediaUrls?.length ?? 0,
        notesLen:        fresh?.notes?.length ?? 0,
        whiteboardCount: whiteboardImages.length,
        isObj6:          isObj6,
      };
      speakLine(pickReadyLine(ctx));
    }

    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Esc closes ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Typewriter (synced to TTS audio progress) ────────────────────────────
  useEffect(() => {
    if (!open || text.length === 0) return;
    let raf = 0;
    let fallbackStart = 0;
    const tick = (now: number) => {
      const handle = speakRef.current;
      const audioProgress = handle?.progress01() ?? 0;
      let target: number;
      if (audioProgress > 0) {
        target = Math.floor(text.length * audioProgress);
      } else {
        if (fallbackStart === 0) fallbackStart = now;
        target = Math.min(text.length, Math.floor((now - fallbackStart) / 33));
      }
      setRevealed(prev => (target > prev ? target : prev));
      if (target < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, open]);

  // ── Validate ─────────────────────────────────────────────────────────────
  function buildWorksheetPayload(p: PendingPayload | null): WorksheetUpload | null {
    if (!p) return null;
    // File upload wins over inline form when both are present (kid uploaded
    // their hand-filled .docx — trust that over a partial inline form).
    if (p.worksheetFile) {
      return {
        kind:     "file",
        url:      p.worksheetFile.url,
        format:   p.worksheetFile.format,
        filename: p.worksheetFile.filename,
      };
    }
    if (p.data && Object.keys(p.data).length > 0) {
      return { kind: "inline-form", data: p.data, lmsId: p.lmsId };
    }
    return null;
  }

  async function handleValidate() {
    setError(null);

    const fresh = readPending(rubric.lmsId, profile?.id) ?? pending;
    setPending(fresh);
    // Priority order:
    //   1. Popup data (inline form OR file uploaded inside the worksheet popup)
    //   2. Chat doc fallback (kid dropped a .pdf/.docx into the whiteboard)
    //   3. Funny SAGE complaint → bail
    let worksheetPayload = buildWorksheetPayload(fresh);
    if (!worksheetPayload && whiteboardDocs.length > 0) {
      const latest = whiteboardDocs[whiteboardDocs.length - 1];
      worksheetPayload = {
        kind:     "file",
        url:      latest.url,
        format:   latest.format,
        filename: latest.filename,
      };
    }
    if (!worksheetPayload) {
      const funny = FUNNY_NO_WORKSHEET[Math.floor(Math.random() * FUNNY_NO_WORKSHEET.length)];
      setError(funny);
      speakLine(funny);
      return;
    }

    // Media: kid-uploaded (in popup) wins. Otherwise fall back to the most
    // recent whiteboard output of the matching type.
    const mediaFromPending = fresh?.mediaUrls ?? [];
    const fallbackMedia    = !isObj6 && whiteboardImages.length > 0
      ? [whiteboardImages[whiteboardImages.length - 1].url]
      : [];
    const mediaToUse = mediaFromPending.length > 0 ? mediaFromPending : fallbackMedia;

    if (isObj6 && mediaToUse.length === 0) {
      const msg = "I need the HeyGen MP4. Drop it in the worksheet, then come back. I don't grade vibes.";
      setError(msg);
      speakLine(msg);
      return;
    }
    if (!isObj6 && mediaToUse.length === 0) {
      const msg = "Worksheet — in. Comic — missing. I can read minds, not blank canvases. Generate the comic or upload it.";
      setError(msg);
      speakLine(msg);
      return;
    }

    setPhase("submitting");
    speakLine("Alright… let me look at this.");

    const ctrl = new AbortController();
    validateAbortRef.current = ctrl;

    try {
      const body = isObj6
        ? {
            worksheet: worksheetPayload,
            videoUrl:  mediaToUse[0],
            notes:     fresh?.notes ?? "",
            profile: {
              display_name: profile?.display_name ?? "Student",
              age_group:    profile?.age_group    ?? "11-13",
            },
          }
        : {
            worksheet:        worksheetPayload,
            comicImageUrls:   mediaToUse,
            notes:            fresh?.notes ?? "",
            whiteboardImages,
            profile: {
              display_name: profile?.display_name ?? "Student",
              age_group:    profile?.age_group    ?? "11-13",
            },
          };

      const res = await fetch(validateUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  ctrl.signal,
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const msg = await res.text();
        setError(`Validation failed: ${msg.slice(0, 160)}`);
        setPhase("ready");
        return;
      }
      const final = await res.json() as FinalResult;
      validateAbortRef.current = null;
      setResult(final);
      setPhase("result");
      speakLine(final.feedbackScript);

      // Publish to validator channel so AIDA can ground its replies.
      let attemptCount = 0;
      try {
        const cRes = await fetch(`/api/objective-attempts?objective_id=${rubric.lmsId === "l1-06" ? "a1-6" : "a1-10"}`);
        if (cRes.ok) attemptCount = (await cRes.json()).count ?? 0;
      } catch { /* non-fatal */ }
      publishValidator({
        lmsId:       rubric.lmsId,
        lastTier:    final.tier,
        lastMode:    final.canvas?.mode ?? null,
        lastSummary: final.feedbackScript,
        attempts:    { count: attemptCount, lastAt: new Date().toISOString() },
      });

      // Log + complete attempt.
      try {
        const objId = rubric.lmsId === "l1-06" ? "a1-6" : "a1-10";
        const aRes  = await fetch("/api/objective-attempts", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            objective_id: objId,
            lms_id:       rubric.lmsId,
            score:        final.composite,
            tier:         final.tier,
            passed:       final.passed,
            feedback: {
              summary:      final.feedbackScript,
              strengths:    [],
              improvements: [],
              hintForRetry: final.blockedAtStage,
              stages: { canvas: final.canvas, storyIt: final.storyIt, createIt: final.createIt },
            },
          }),
        });
        if (aRes.ok && final.passed) {
          const { attempt_id } = await aRes.json() as { attempt_id: string };
          await fetch("/api/objective-attempts", {
            method:  "PATCH",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ attempt_id }),
          });
          // Kid passed — clear pending + draft so future visits start fresh.
          clearPending(rubric.lmsId, profile?.id);
          clearDraft(rubric.lmsId, profile?.id);
          await onComplete(final.composite, final.tier);
        }
      } catch (err) {
        console.warn("[ObjectiveSubmissionPanel] log attempt failed:", err);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      console.error("[ObjectiveSubmissionPanel] submit failed:", err);
      setError("Something went wrong. Please try again.");
      setPhase("ready");
    }
  }

  function handleRetry() {
    setResult(null);
    setPhase("ready");
    speakLine("Fix what we talked about, then come back. I'll be here.");
  }

  function handleClose() {
    if (validateAbortRef.current) { validateAbortRef.current.abort(); validateAbortRef.current = null; }
    stopSpeaking();
    onClose();
  }

  function handleIntroAck() {
    setPhase("ready");
    const fresh = readPending(rubric.lmsId, profile?.id);
    setPending(fresh);
    const ctx: ReadyContext = {
      hasInlineForm:   !!(fresh?.data && Object.keys(fresh.data).length > 0),
      hasFile:         !!fresh?.worksheetFile,
      mediaCount:      fresh?.mediaUrls?.length ?? 0,
      notesLen:        fresh?.notes?.length ?? 0,
      whiteboardCount: whiteboardImages.length,
      isObj6:          isObj6,
    };
    speakLine(pickReadyLine(ctx));
  }

  function handleReExplain() {
    // Re-play the full intro brief without changing the intro-shown flag.
    const intro = getObjectiveIntro(rubric.lmsId);
    if (intro) {
      void speakBeats(intro.beats);
    } else {
      speakLine(`${rubric.title}. Check the worksheet for the full task details.`);
    }
  }

  if (!open) return null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        key="obj-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[60] pointer-events-auto"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), rgba(0,0,0,0.35) 40%)" }}
        onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      >
        {/* Portrait */}
        <motion.img
          key="obj-portrait"
          src="/assistant.png"
          alt="Validator"
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0,   opacity: 1 }}
          exit={{    x: -40, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="absolute pointer-events-none select-none"
          style={{
            bottom: "-2vh",
            left:   "1.5vw",
            height: "clamp(220px, 32vh, 420px)",
            width:  "auto",
            filter: "drop-shadow(0 0 28px rgba(0,212,255,0.55))",
          }}
        />

        {/* Dialogue box */}
        <motion.div
          key="obj-dialogue-box"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{    y: 40, opacity: 0 }}
          transition={{ duration: 0.28, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="absolute"
          style={{
            left:    "clamp(240px, 20vw, 340px)",
            right:   "clamp(20px, 3vw, 48px)",
            bottom:  "clamp(16px, 3vh, 28px)",
            height:  "clamp(240px, 44vh, 420px)",
            maxWidth: 880,
          }}
        >
          {/* Name plate — steel-and-cyan chrome chip */}
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 mb-2 rounded-md"
            style={{
              background: "linear-gradient(180deg, #7DD3FC 0%, #00D4FF 50%, #0284C7 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.4), " +
                "0 4px 18px rgba(0,212,255,0.45)",
            }}
          >
            <span
              className="text-[11px] font-display font-extrabold tracking-wider"
              style={{ color: "#031024" }}
            >
              {VALIDATOR_NAME} · {rubric.title.toUpperCase()}
            </span>
          </div>

          {/* Box — steel-and-cyan METALLIC, matches AIDA + upload modal */}
          <div
            className="rounded-xl px-5 py-4 flex flex-col"
            style={{
              background:
                "radial-gradient(ellipse 90% 55% at 25% 0%, rgba(0,212,255,0.18) 0%, rgba(8,12,28,0) 60%), " +
                "radial-gradient(ellipse 70% 50% at 100% 100%, rgba(125,211,252,0.08) 0%, rgba(8,12,28,0) 60%), " +
                "linear-gradient(180deg, " +
                  "rgba(58,98,158,0.55) 0%, " +
                  "rgba(20,38,72,0.95) 6%, " +
                  "rgba(10,18,38,0.97) 50%, " +
                  "rgba(18,32,62,0.96) 94%, " +
                  "rgba(58,98,158,0.45) 100%" +
                ")",
              border:    "1px solid rgba(0,212,255,0.55)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.22), " +
                "inset 0 -1px 0 rgba(255,255,255,0.06), " +
                "0 0 28px rgba(0,212,255,0.45), " +
                "0 0 80px rgba(0,212,255,0.18), " +
                "0 12px 40px rgba(0,0,0,0.7)",
              backdropFilter: "blur(22px)",
              height:    "calc(100% - 28px)",
              overflow:  "hidden",
            }}
          >
            {/* Teacher line — typewriter */}
            <p
              className="text-[15px] leading-relaxed mb-4"
              style={{ color: "rgba(255,255,255,0.95)", fontFamily: "'JetBrains Mono', monospace", minHeight: 60 }}
            >
              {text.slice(0, revealed)}
              {revealed < text.length && (
                <span
                  className="inline-block w-2 h-4 align-middle ml-0.5"
                  style={{ background: "#00D4FF", boxShadow: "0 0 6px #00D4FF", animation: "blink 0.9s steps(2,start) infinite" }}
                />
              )}
            </p>

            {/* Body — phase-driven */}
            <div className="flex-1 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
              {phase === "ready" && (
                <ReadyView pending={pending} isObj6={isObj6} whiteboardImageCount={whiteboardImages.length}/>
              )}
              {phase === "submitting" && <SubmittingPanel/>}
              {phase === "result" && result && (
                <ResultView result={result}/>
              )}
            </div>

            {/* Error banner */}
            {error && <div className="mt-2 text-[12px]" style={{ color: "#FF6B6B" }}>{error}</div>}

            {/* Action row */}
            <div
              className="flex justify-between items-center mt-3 pt-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
            >
              <button
                onClick={handleClose}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                style={{ background: "transparent", color: "rgba(255,255,255,0.6)" }}
              >
                Close
              </button>

              <div className="flex gap-2">
                {phase === "intro" && (
                  <ActionButton primary onClick={handleIntroAck}>Let&apos;s go</ActionButton>
                )}
                {phase === "ready" && (
                  <>
                    <ActionButton onClick={handleReExplain}>What was I doing?</ActionButton>
                    <ActionButton primary onClick={handleValidate}>Show my work</ActionButton>
                  </>
                )}
                {phase === "submitting" && <ActionButton disabled>Reading…</ActionButton>}
                {phase === "result" && result && (
                  result.passed
                    ? <ActionButton primary onClick={handleClose}>Done. Out.</ActionButton>
                    : <>
                        <ActionButton primary onClick={handleRetry}>I&apos;ll fix it</ActionButton>
                        <ActionButton onClick={handleClose}>Close</ActionButton>
                      </>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ActionButton({
  children, onClick, primary, disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-1.5 rounded-full text-[12px] font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      style={primary ? {
        background: "linear-gradient(180deg, #7DD3FC 0%, #00D4FF 50%, #0284C7 100%)",
        color:      "#031024",
        fontWeight: 700,
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.4), " +
          "0 0 14px rgba(0,212,255,0.55), " +
          "0 4px 14px rgba(0,212,255,0.35)",
      } : {
        background:
          "linear-gradient(180deg, rgba(58,98,158,0.32) 0%, rgba(20,38,72,0.55) 100%)",
        border:     "1px solid rgba(0,212,255,0.32)",
        color:      "rgba(232,244,255,0.92)",
        boxShadow:  "inset 0 1px 0 rgba(255,255,255,0.10)",
      }}
    >
      {children}
    </button>
  );
}

function ReadyView({
  pending, isObj6, whiteboardImageCount,
}: { pending: PendingPayload | null; isObj6: boolean; whiteboardImageCount: number }) {
  const hasInline   = pending?.data && Object.keys(pending.data).length > 0;
  const hasFile     = !!pending?.worksheetFile;
  const mediaCount  = pending?.mediaUrls?.length ?? 0;
  const usingWhiteboardFallback = !isObj6 && mediaCount === 0 && whiteboardImageCount > 0;

  return (
    <div className="space-y-2">
      <div className="text-[12px] font-display font-bold text-white/80">What I'll grade</div>
      <Row label="Worksheet"
           ok={!!(hasInline || hasFile)}
           detail={hasFile ? `📄 ${pending!.worksheetFile!.filename}` : hasInline ? "Filled in app" : "Not yet — open the worksheet"}/>
      <Row label={isObj6 ? "Avatar video" : "Comic image"}
           ok={mediaCount > 0 || usingWhiteboardFallback}
           detail={
             mediaCount > 0
               ? `${mediaCount} uploaded`
               : usingWhiteboardFallback
                 ? "Will use most recent whiteboard image"
                 : isObj6 ? "Upload your MP4 in the worksheet" : "Generate a comic in the whiteboard or upload one"
           }/>
      {pending?.notes && (
        <Row label="Your notes" ok detail={`"${pending.notes.slice(0, 80)}${pending.notes.length > 80 ? "…" : ""}"`}/>
      )}
    </div>
  );
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px]">
      <span style={{ color: ok ? "#7BFFC4" : "rgba(255,255,255,0.4)" }}>{ok ? "✓" : "○"}</span>
      <span className="font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>{label}:</span>
      <span style={{ color: "rgba(255,255,255,0.65)" }}>{detail}</span>
    </div>
  );
}

function SubmittingPanel() {
  return (
    <div className="flex flex-col items-center justify-center py-6 gap-3">
      <div
        className="w-12 h-12 rounded-full"
        style={{
          border: "3px solid rgba(0,212,255,0.18)",
          borderTopColor: "#00D4FF",
          animation: "spin 0.9s linear infinite",
        }}
      />
      <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.7)" }}>
        Reading the canvas… story… and the work itself.
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ResultView({ result }: { result: FinalResult }) {
  const meta = TIER_META[result.tier];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div
          className="text-[44px] font-display font-extrabold leading-none"
          style={{ color: meta.color, textShadow: `0 0 18px ${meta.color}55` }}
        >
          {result.composite}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
            COMPOSITE / 100
          </span>
          <span className="text-[13px] font-display font-extrabold tracking-wider" style={{ color: meta.color }}>
            {meta.emoji} {meta.label}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 text-[12px]" style={{ color: "rgba(255,255,255,0.85)" }}>
        <StageRow
          label="Think It Canvas (25%)"
          score={result.canvas.score}
          status={result.canvas.passed ? "pass" : "fail"}
          weight={25}
        />
        {result.storyIt && (
          <StageRow
            label="Story It (25%)"
            score={result.storyIt.passed ? 100 : 0}
            status={result.storyIt.passed ? "pass" : "fail"}
            weight={25}
          />
        )}
        {result.createIt && (
          <StageRow
            label="Create It (50%)"
            score={result.createIt.score}
            status={result.createIt.tier === "fail" ? "fail" : "pass"}
            weight={50}
          />
        )}
      </div>

      {!result.canvas.passed && (
        <div className="text-[11px] space-y-1 p-2 rounded-md" style={{ background: "rgba(255,107,107,0.05)", border: "1px solid rgba(255,107,107,0.2)" }}>
          <div className="font-display font-bold mb-1" style={{ color: "#FF6B6B" }}>Canvas feedback</div>
          {result.canvas.fieldFeedback.intent      && <div>• <b>Intent:</b> {result.canvas.fieldFeedback.intent}</div>}
          {result.canvas.fieldFeedback.assumptions && <div>• <b>Assumptions:</b> {result.canvas.fieldFeedback.assumptions}</div>}
          {result.canvas.fieldFeedback.audience    && <div>• <b>Audience:</b> {result.canvas.fieldFeedback.audience}</div>}
          {result.canvas.fieldFeedback.success     && <div>• <b>Success:</b> {result.canvas.fieldFeedback.success}</div>}
        </div>
      )}
      {result.storyIt && !result.storyIt.passed && !result.storyIt.funnyTestBlocked && (
        <div className="text-[11px] space-y-1 p-2 rounded-md" style={{ background: "rgba(255,107,107,0.05)", border: "1px solid rgba(255,107,107,0.2)" }}>
          <div className="font-display font-bold mb-1" style={{ color: "#FF6B6B" }}>Story It checks</div>
          {!result.storyIt.checks.setupTwistPayoff.passed    && <div>• {result.storyIt.checks.setupTwistPayoff.line}</div>}
          {!result.storyIt.checks.panel3IsPunchline.passed   && <div>• {result.storyIt.checks.panel3IsPunchline.line}</div>}
          {!result.storyIt.checks.characterConsistent.passed && <div>• {result.storyIt.checks.characterConsistent.line}</div>}
        </div>
      )}
    </div>
  );
}

function StageRow({ label, score, status, weight }: { label: string; score: number; status: "pass" | "fail"; weight: number }) {
  const color = status === "pass" ? "#7BFFC4" : "#FF6B6B";
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full transition-all" style={{ width: `${score}%`, background: color, opacity: 0.85 }}/>
      </div>
      <span className="font-display font-bold flex-shrink-0" style={{ color, minWidth: 56, textAlign: "right" }}>
        {Math.round((score / 100) * weight)} / {weight}
      </span>
    </div>
  );
}
