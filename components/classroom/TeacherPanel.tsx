"use client";

// Classroom Teacher panel — left-side persistent character.
// Canon: ../../obsidian/AIDA/AIDA Dev/Adaptive Learner/references/teacher-persona.md
//
// Aesthetic direction:
//   Indian teacher's chamber meets sci-fi observatory.
//   Deep navy slab, warm-gold + violet jhumka/dupatta accents,
//   mandarin-collar SVG sprite. Visually warm; AIDA's right-side
//   panel stays cool steel-and-cyan, so the two characters never fight.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, ChevronDown } from "lucide-react";
import { useClassroomWriter } from "@/lib/chatChannels";
import { buildClassroomGreeting } from "@/lib/teacherPanelGreeting";
import type { Profile } from "@/types";

interface TeacherPanelProps {
  profile: Profile | null;
  /** Hide the panel entirely (e.g. during proctored tests). */
  hidden?: boolean;
  /** Optional override — useful for storybook / debugging. */
  initialOpen?: boolean;
}

// Brand palette — locked, do not reach for arena accents here.
const NAVY_DEEP   = "#0A1230";
const NAVY_MID    = "#15224E";
const GOLD        = "#E0B14C";
const GOLD_GLOW   = "rgba(224,177,76,0.45)";
const VIOLET      = "#9D6BFF";
const VIOLET_DEEP = "#5B2BCC";
const NEON        = "#7AD7FF";  // mandarin-collar piping highlight
const TEXT_HI     = "#F4ECD7";  // antique parchment
const TEXT_MID    = "rgba(244,236,215,0.72)";
const TEXT_LO     = "rgba(244,236,215,0.45)";

function TeacherSprite({ size = 64 }: { size?: number }) {
  // 64px stylized portrait — round-glasses + bindi + mandarin collar arc.
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <radialGradient id="tpSkin" cx="50%" cy="50%" r="60%">
          <stop offset="0%"  stopColor="#E9C7A4" />
          <stop offset="100%" stopColor="#A87E5A" />
        </radialGradient>
        <linearGradient id="tpDupatta" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"  stopColor={VIOLET} />
          <stop offset="50%" stopColor={VIOLET_DEEP} />
          <stop offset="100%" stopColor={GOLD} />
        </linearGradient>
        <linearGradient id="tpKurta" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#F4ECD7" />
          <stop offset="100%" stopColor="#BFB492" />
        </linearGradient>
      </defs>

      {/* Halo */}
      <circle cx="32" cy="32" r="30" fill={NAVY_DEEP} />
      <circle cx="32" cy="32" r="30" fill="none" stroke={GOLD} strokeWidth="0.8" opacity="0.55" />
      <circle cx="32" cy="32" r="28" fill="none" stroke={NEON} strokeWidth="0.4" opacity="0.35" />

      {/* Dupatta drape (back) */}
      <path d="M6 50 Q 32 38 58 50 L 58 64 L 6 64 Z" fill="url(#tpDupatta)" opacity="0.85" />

      {/* Mandarin-collar kurta */}
      <path d="M14 60 Q 32 36 50 60 Z" fill="url(#tpKurta)" />
      <path d="M28 42 L 32 38 L 36 42 L 36 48 L 28 48 Z" fill="#F4ECD7" stroke={NEON} strokeWidth="0.7" />
      {/* Triangular AIDA emblem */}
      <path d="M30 50 L 34 50 L 32 53 Z" fill={VIOLET_DEEP} />

      {/* Hair */}
      <path d="M18 22 Q 32 8 46 22 Q 48 30 46 36 L 18 36 Q 16 30 18 22 Z" fill="#1A1410" />

      {/* Face */}
      <circle cx="32" cy="30" r="11" fill="url(#tpSkin)" />

      {/* Glasses (round, gold rim) */}
      <circle cx="27.5" cy="30" r="3.4" fill="none" stroke={GOLD} strokeWidth="0.9" />
      <circle cx="36.5" cy="30" r="3.4" fill="none" stroke={GOLD} strokeWidth="0.9" />
      <line x1="31"   y1="30"   x2="33"   y2="30"   stroke={GOLD} strokeWidth="0.7" />

      {/* Bindi */}
      <circle cx="32" cy="22.5" r="0.9" fill={VIOLET_DEEP} />
      <circle cx="32" cy="22.5" r="0.4" fill={GOLD} />

      {/* Smile */}
      <path d="M29 35 Q 32 37 35 35" stroke="#5C3A24" strokeWidth="0.7" fill="none" strokeLinecap="round" />

      {/* Jhumka earrings — small bells */}
      <circle cx="21.5" cy="33" r="1.1" fill={GOLD} />
      <circle cx="42.5" cy="33" r="1.1" fill={GOLD} />
      <line x1="21.5" y1="34.2" x2="21.5" y2="36" stroke={GOLD} strokeWidth="0.5" />
      <line x1="42.5" y1="34.2" x2="42.5" y2="36" stroke={GOLD} strokeWidth="0.5" />
    </svg>
  );
}

export function TeacherPanel({ profile, hidden, initialOpen }: TeacherPanelProps) {
  const writer = useClassroomWriter();
  const [open, setOpen] = useState(initialOpen ?? true);
  const [playing, setPlaying] = useState(false);
  const [autoSpoken, setAutoSpoken] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Greeting is recomputed when profile / learner_model changes.
  const greeting = useMemo(() => {
    const lmRaw = (profile as (Profile & { learner_model?: Record<string, unknown> }) | null)
      ?.learner_model ?? null;
    return buildClassroomGreeting({
      displayName:     profile?.display_name ?? "Explorer",
      activeArena:     profile?.active_arena ?? null,
      isReturning:     ((profile as any)?.reflection_count ?? 0) > 0,
      learnerModelRaw: lmRaw,
    });
  }, [profile]);

  // Mark "in lesson" on mount so AIDA knows not to swallow the lesson context.
  useEffect(() => {
    writer.startLesson("classroom");
    return () => {
      // When user leaves classroom: emit a synthetic lesson_ended into the
      // channel so AIDA can reference it next time the student asks.
      writer.endLesson({
        topic:   "classroom_visit",
        summary: greeting.text.slice(0, 240),
        keyConcepts: [],
        studentResponses: [],
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(false);
  }, []);

  const speak = useCallback(async () => {
    if (playing) { stopAudio(); return; }
    setVoiceError(null);
    try {
      setPlaying(true);
      const res = await fetch("/api/aida/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text: greeting.spoken, role: "classroom" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const detail = `TTS ${res.status}${text ? ` · ${text.slice(0, 80)}` : ""}`;
        console.error("[TeacherPanel] tts failed:", detail);
        throw new Error(detail);
      }
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("TTS returned empty audio");
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => {
        setPlaying(false);
        setVoiceError("Audio failed to load. Try again.");
        URL.revokeObjectURL(url);
      };
      try {
        await audio.play();
      } catch (playErr) {
        console.error("[TeacherPanel] audio.play() rejected:", playErr);
        setVoiceError("Browser blocked autoplay — click again.");
        setPlaying(false);
      }
    } catch (e) {
      setPlaying(false);
      setVoiceError((e as Error)?.message ?? "Voice unavailable");
    }
  }, [greeting.spoken, playing, stopAudio]);

  // Auto-speak the welcome once per page mount (once profile loads).
  useEffect(() => {
    if (!profile || autoSpoken || hidden) return;
    setAutoSpoken(true);
    // Don't auto-speak — browser autoplay rules will block silently.
    // The voice chip stays prominent so the student can trigger it.
  }, [profile, autoSpoken, hidden]);

  if (hidden) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="fixed z-40 select-none"
      style={{
        left:   "16px",
        bottom: "20px",
        fontFamily: "var(--font-dm-sans,'DM Sans',sans-serif)",
        maxWidth: open ? 380 : 96,
      }}
    >
      <div
        className="relative rounded-[22px] overflow-hidden"
        style={{
          background: `
            radial-gradient(120% 80% at 0% 0%, ${VIOLET_DEEP}22 0%, transparent 60%),
            radial-gradient(120% 80% at 100% 100%, ${GOLD}1a 0%, transparent 55%),
            linear-gradient(170deg, ${NAVY_MID} 0%, ${NAVY_DEEP} 100%)
          `,
          border: `1px solid ${GOLD}55`,
          boxShadow: `
            0 1px 0 ${TEXT_HI}1a inset,
            0 0 0 1px ${VIOLET}22,
            0 24px 60px -20px rgba(2,4,14,0.6),
            0 0 36px -10px ${GOLD_GLOW}
          `,
        }}
      >
        {/* Top warm-gold hairline */}
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${GOLD}cc 32%, ${NEON}aa 68%, transparent 100%)`,
          }}
        />

        {/* Header row */}
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center gap-3 p-3 text-left"
          style={{ background: "transparent" }}
        >
          <div
            className="relative flex-shrink-0 rounded-full overflow-hidden"
            style={{
              width:  "clamp(48px, 3.6vw, 64px)",
              height: "clamp(48px, 3.6vw, 64px)",
              background: `radial-gradient(circle at 35% 30%, ${VIOLET}22, ${NAVY_DEEP})`,
              border: `1.5px solid ${GOLD}aa`,
              boxShadow: `inset 0 1px 0 ${TEXT_HI}33, 0 0 18px ${VIOLET_DEEP}55, 0 0 22px ${GOLD_GLOW}`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/classroom/teacher-bhavna.png"
              alt="Ms. Bhavna"
              draggable={false}
              className="w-full h-full object-cover select-none"
              style={{ objectPosition: "center 18%" }}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div
              className="uppercase tracking-[0.18em] font-bold mb-0.5"
              style={{
                color: GOLD,
                fontFamily: "var(--font-jetbrains-mono,'JetBrains Mono',monospace)",
                fontSize: 9,
              }}
            >
              Classroom · In Session
            </div>
            <div
              className="font-black truncate leading-tight"
              style={{
                color:      TEXT_HI,
                fontFamily: "var(--font-syne,'Syne',sans-serif)",
                fontSize:   open ? 16 : 13,
                letterSpacing: "-0.01em",
              }}
            >
              Ms. Bhavna
            </div>
            <div className="text-[10.5px] mt-0.5 truncate" style={{ color: TEXT_LO, fontStyle: "italic" }}>
              your structured guide
            </div>
          </div>

          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ color: TEXT_MID }}
          >
            <ChevronDown size={18} />
          </motion.div>
        </button>

        {/* Body */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              style={{ overflow: "hidden" }}
            >
              <div className="px-4 pb-4 pt-1">
                {/* Speech card */}
                <div
                  className="relative rounded-xl p-3.5"
                  style={{
                    background: `linear-gradient(180deg, ${TEXT_HI}10, ${TEXT_HI}05)`,
                    border:     `1px solid ${TEXT_HI}1a`,
                    boxShadow:  `inset 0 1px 0 ${TEXT_HI}14`,
                  }}
                >
                  {/* Gold corner mark */}
                  <div
                    className="absolute -top-px -left-px w-5 h-5 pointer-events-none"
                    style={{
                      borderTop:  `2px solid ${GOLD}`,
                      borderLeft: `2px solid ${GOLD}`,
                      borderTopLeftRadius: 10,
                    }}
                  />
                  <p
                    style={{
                      color:      TEXT_HI,
                      fontSize:   13.5,
                      lineHeight: 1.55,
                      letterSpacing: "0.005em",
                    }}
                  >
                    {greeting.text}
                  </p>
                </div>

                {/* Voice + handoff row */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={speak}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-transform active:scale-95"
                    style={{
                      background: playing
                        ? `linear-gradient(135deg, ${GOLD}, ${VIOLET})`
                        : `linear-gradient(135deg, ${VIOLET_DEEP}, ${NAVY_MID})`,
                      border:    `1px solid ${playing ? GOLD : VIOLET}66`,
                      boxShadow: playing
                        ? `0 0 18px ${GOLD_GLOW}`
                        : `inset 0 1px 0 ${TEXT_HI}1a`,
                      color: TEXT_HI,
                      fontSize: 11.5,
                      fontWeight: 700,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {playing ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    {playing ? "Stop voice" : "Hear welcome"}
                  </button>

                  <div
                    className="ml-auto text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: TEXT_LO, fontFamily: "var(--font-jetbrains-mono,'JetBrains Mono',monospace)" }}
                  >
                    AIDA stays on the right →
                  </div>
                </div>

                {voiceError && (
                  <div
                    className="mt-2 text-[11px] rounded-lg px-3 py-1.5"
                    style={{
                      color: "#FFC7CC",
                      background: "rgba(255,87,108,0.12)",
                      border: "1px solid rgba(255,87,108,0.35)",
                    }}
                  >
                    {voiceError}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sub-foot — tiny gold/violet ribbon to anchor the panel */}
      <div
        className="mx-3 mt-1 h-[3px] rounded-full"
        style={{
          background: `linear-gradient(90deg, ${GOLD} 0%, ${VIOLET} 100%)`,
          opacity: 0.55,
          filter: `blur(0.5px)`,
        }}
      />
    </motion.div>
  );
}

export default TeacherPanel;
