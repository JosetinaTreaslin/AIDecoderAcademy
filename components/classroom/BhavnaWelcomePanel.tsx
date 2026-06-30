"use client";

// Bhavna's welcome panel — a one-shot greeting shown when the student enters
// the classroom. Deliberately uses the SAME stage layout as LecturePanel
// (full-body portrait bottom-left, dialogue box bottom-right, navy/gold
// palette) so the welcome feels like Bhavna stepping in to talk — not a
// generic centred modal card.
//
// - Greeting text comes from buildClassroomGreeting (learner-model aware).
// - The spoken line is prefetched + played on mount for an instant feel.
// - A speaker toggle (shared `bhavna:hintAudio` key) silences the voice.
// - Dispatches validator-panel-open/-close so AIDA + worksheet sprite hide.

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, X, ArrowRight, MessageSquare } from "lucide-react";
import { buildClassroomGreeting } from "@/lib/teacherPanelGreeting";
import { speakAsClassroomTimed, type SpeakHandle } from "@/lib/teacherAudio";
import type { Profile } from "@/types";

interface Props {
  profile:    Profile | null;
  onClose:    () => void;
  /** Opens the full TeacherChat (student wants to ask something now). */
  onOpenChat: () => void;
}

// ── Palette (matches LecturePanel) ──────────────────────────────────────────
const GOLD        = "#E0B14C";
const GOLD_GLOW   = "rgba(224,177,76,0.45)";
const VIOLET      = "#9D6BFF";
const VIOLET_DEEP = "#5B2BCC";
const TEXT_HI     = "#F4ECD7";
const TEXT_MID    = "rgba(244,236,215,0.78)";

const HINT_AUDIO_KEY = "bhavna:hintAudio";

export function BhavnaWelcomePanel({ profile, onClose, onOpenChat }: Props) {
  const [audioOn, setAudioOn] = useState(true);
  const [revealed, setRevealed] = useState(0);
  const speakRef = useRef<SpeakHandle | null>(null);

  // Greeting is built once — learner-model aware, returning-student framing.
  const greetingRef = useRef(
    buildClassroomGreeting({
      displayName:     profile?.display_name ?? "Explorer",
      activeArena:     profile?.active_arena ?? null,
      isReturning:     true,
      learnerModelRaw: (profile as { learner_model?: Record<string, unknown> } | null)?.learner_model ?? null,
    }),
  );
  const greeting = greetingRef.current;

  // ── Hide AIDA + worksheet sprite while the welcome panel is up ────────────
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("validator-panel-open"));
    return () => { window.dispatchEvent(new CustomEvent("validator-panel-close")); };
  }, []);

  // ── Play the spoken greeting on mount + reveal text word-by-word ──────────
  useEffect(() => {
    const muted = typeof window !== "undefined" && localStorage.getItem(HINT_AUDIO_KEY) === "off";
    if (muted) { setAudioOn(false); setRevealed(greeting.text.length); return; }
    setRevealed(0);
    speakRef.current = speakAsClassroomTimed(greeting.spoken);
    return () => { speakRef.current?.cancel(); speakRef.current = null; };
  }, [greeting.spoken, greeting.text.length]);

  // Typewriter — reveals greeting.text in sync with the spoken audio, then the
  // full text once audio ends. Text never appears ahead of the voice.
  useEffect(() => {
    if (!audioOn) return;
    const fullLen = greeting.text.length;
    let raf = 0;
    const tick = () => {
      const h = speakRef.current;
      const finished = (h?.failed?.() ?? false) || (h?.done?.() ?? false);
      let target: number;
      if (finished) {
        target = fullLen;
      } else {
        const sc = h?.spokenChars?.() ?? -1;
        target = sc >= 0 ? Math.min(fullLen, sc) : 0; // -1 → hold (loading)
      }
      setRevealed(prev => (target > prev ? target : prev));
      if (target < fullLen) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [audioOn, greeting.text]);

  const toggleAudio = useCallback(() => {
    setAudioOn(v => {
      const next = !v;
      if (typeof window !== "undefined") {
        localStorage.setItem(HINT_AUDIO_KEY, next ? "on" : "off");
      }
      if (!next) {
        speakRef.current?.cancel(); speakRef.current = null;
        setRevealed(greetingRef.current.text.length); // muted → show full text
      } else {
        setRevealed(0);
        speakRef.current = speakAsClassroomTimed(greetingRef.current.spoken);
      }
      return next;
    });
  }, []);

  const close = useCallback(() => {
    speakRef.current?.cancel(); speakRef.current = null;
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="welcome-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[60] pointer-events-auto"
        style={{ background: "linear-gradient(to top, rgba(10,18,48,0.88), rgba(0,0,0,0.45) 40%)" }}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      >
        {/* Bhavna portrait — bottom-left, same as LecturePanel */}
        <motion.img
          src="/classroom/teacher-bhavna.png"
          alt="Ms. Bhavna"
          initial={{ x: -40, opacity: 0 }}
          animate={{ x: 0,   opacity: 1 }}
          exit={{    x: -40, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="absolute pointer-events-none select-none"
          style={{
            bottom: "-3vh",
            left:   "1vw",
            height: "56vh",
            width:  "auto",
            filter: `drop-shadow(0 0 34px ${GOLD_GLOW})`,
          }}
        />

        {/* Dialogue box — bottom-right */}
        <motion.div
          key="welcome-box"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{    y: 40, opacity: 0 }}
          transition={{ duration: 0.28, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="absolute flex flex-col"
          style={{
            left:      "22vw",
            right:     "3vw",
            bottom:    "3vh",
            maxWidth:  "97.8vmin",
            gap:       "0.9vmin",
            fontFamily: "var(--font-dm-sans,'DM Sans',sans-serif)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Name plate + controls row */}
          <div className="flex items-center flex-wrap" style={{ gap: "0.9vmin" }}>
            <div
              className="inline-flex items-center"
              style={{
                gap: "0.7vmin", padding: "0.4vmin 1.3vmin", borderRadius: "0.7vmin",
                background: `linear-gradient(135deg, ${VIOLET_DEEP}, ${GOLD})`,
                boxShadow:  `0 4px 18px ${GOLD_GLOW}`,
              }}
            >
              <span style={{
                fontFamily: "var(--font-jetbrains-mono,'JetBrains Mono',monospace)",
                fontSize: "1vmin", fontWeight: 700, color: TEXT_HI,
                letterSpacing: "0.18em", textTransform: "uppercase",
              }}>
                Ms. Bhavna · Welcome
              </span>
            </div>

            <div className="ml-auto flex items-center" style={{ gap: "0.9vmin" }}>
              <button
                onClick={toggleAudio}
                title={audioOn ? "Mute Bhavna" : "Unmute Bhavna"}
                aria-label={audioOn ? "Mute Bhavna" : "Unmute Bhavna"}
                className="rounded-full flex items-center justify-center"
                style={{ width: "3.1vmin", height: "3.1vmin", background: "rgba(255,255,255,0.06)", border: `1px solid ${audioOn ? GOLD : "rgba(255,255,255,0.12)"}` }}
              >
                {audioOn ? <Volume2 size="1.3vmin" color={TEXT_HI} /> : <VolumeX size="1.3vmin" color={TEXT_HI} />}
              </button>
              <button
                onClick={close}
                aria-label="Close welcome"
                className="rounded-full flex items-center justify-center"
                style={{ width: "3.1vmin", height: "3.1vmin", background: "rgba(255,255,255,0.04)", color: TEXT_MID }}
              >
                <X size="1.6vmin" />
              </button>
            </div>
          </div>

          {/* Main dialogue box */}
          <div
            style={{
              borderRadius: "1.8vmin", padding: "1.8vmin 2.2vmin",
              background: `
                radial-gradient(120% 80% at 0% 0%, ${VIOLET_DEEP}22 0%, transparent 60%),
                radial-gradient(120% 80% at 100% 100%, ${GOLD}1a 0%, transparent 55%),
                rgba(8,8,15,0.97)
              `,
              border:    `1px solid ${GOLD}55`,
              boxShadow: `0 1px 0 ${TEXT_HI}1a inset, 0 0 40px rgba(0,0,0,0.5), 0 0 36px -10px ${GOLD_GLOW}`,
            }}
          >
            <div className="flex flex-col" style={{ gap: "1.8vmin", paddingTop: "0.4vmin", paddingBottom: "0.4vmin" }}>
              <p style={{
                color: GOLD, fontSize: "1.1vmin",
                fontFamily: "var(--font-jetbrains-mono,'JetBrains Mono',monospace)",
                fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase",
              }}>
                👩‍🏫 YOUR CLASSROOM TEACHER
              </p>
              <p style={{ color: TEXT_HI, fontSize: "1.6vmin", lineHeight: 1.65 }}>
                {greeting.text.slice(0, revealed)}
              </p>
              <div className="flex flex-wrap" style={{ gap: "0.9vmin" }}>
                <button
                  onClick={close}
                  className="rounded-full font-bold flex items-center"
                  style={{
                    gap: "0.7vmin", padding: "0.9vmin 1.8vmin", fontSize: "1.3vmin",
                    background: `linear-gradient(135deg, ${GOLD}, ${VIOLET})`,
                    color: TEXT_HI, boxShadow: `0 4px 14px ${GOLD_GLOW}`,
                  }}
                >
                  Let&rsquo;s begin <ArrowRight size="1.4vmin" />
                </button>
                <button
                  onClick={() => { speakRef.current?.cancel(); speakRef.current = null; onOpenChat(); }}
                  className="rounded-full font-semibold flex items-center"
                  style={{
                    gap: "0.7vmin", padding: "0.9vmin 1.8vmin", fontSize: "1.3vmin",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)", color: TEXT_MID,
                  }}
                >
                  <MessageSquare size="1.4vmin" /> Ask Ms. Bhavna a question
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default BhavnaWelcomePanel;
