"use client";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { personaPortrait, GENERIC_PORTRAIT } from "@/lib/podcastPortraits";

export interface LoadProgress {
  stage: "persona" | "script" | "tts" | "done" | "error";
  persona?: { id?: string; name: string; archetype: string };
  done?: number;
  total?: number;
  message?: string;
}

// Matches the PodcastStage navy/gold signature so the loader → show transition
// feels continuous (visual continuity reduces perceived wait).
const NAVY_TOP = "#16244f";
const NAVY_BOT = "#050a1c";
const GOLD = "#E0B14C";
const GOLD_SOFT = "#F4D58D";
const GOLD_GLOW = "rgba(224,177,76,0.45)";
const CYAN = "#7dd3fc";

const STAGES = [
  { key: "persona", label: "Casting tonight's guest" },
  { key: "script", label: "Writing the conversation" },
  { key: "tts", label: "Recording the episode" },
  { key: "done", label: "Mixing your episode" },
] as const;
const ORDER = ["persona", "script", "tts", "done"];

// Kid-friendly filler content — research says meaningful "did you know" beats a
// dead spinner for a 30-60s wait.
const FACTS = [
  "Podcasts got their name in 2004 — a mash-up of 'iPod' and 'broadcast'.",
  "Your brain understands speech a bit slower than it reads — so good hosts pause.",
  "Recording standing up makes your voice sound more energetic.",
  "Sound travels about 4 times faster through water than through air.",
  "The best interviewers spend 80% of the time listening, 20% talking.",
  "A single 'whoa' fact is what most people remember from an episode.",
  "Your ears never switch off — they keep working even while you sleep.",
];

export function PodcastLoading({
  progress,
  onCancel,
  onRetry,
}: {
  progress: LoadProgress;
  onCancel?: () => void;
  onRetry?: () => void;
}) {
  const reduced = useReducedMotion();
  const isError = progress.stage === "error";

  // Esc cancels an in-flight recording (mirrors the top-right Cancel button).
  useEffect(() => {
    if (!onCancel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const curIdx = ORDER.indexOf(isError ? "persona" : progress.stage);
  const recording = progress.stage === "tts" && !!progress.total;
  const pct = recording
    ? Math.round(((progress.done ?? 0) / (progress.total || 1)) * 100)
    : 0;

  // Guest portrait with the same persona -> generic -> hide fallback chain.
  const [guestSrc, setGuestSrc] = useState<string | null>(null);
  const guestStage = useRef<0 | 1 | 2>(0);
  useEffect(() => {
    if (!progress.persona?.id) {
      guestStage.current = 0;
      setGuestSrc(null);
      return;
    }
    guestStage.current = 0;
    setGuestSrc(personaPortrait(progress.persona.id));
  }, [progress.persona?.id]);
  const onGuestError = () => {
    if (guestStage.current === 0) {
      guestStage.current = 1;
      setGuestSrc(GENERIC_PORTRAIT);
    } else {
      guestStage.current = 2;
      setGuestSrc(null);
    }
  };

  // Rotating fact card.
  const [factIdx, setFactIdx] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setFactIdx((i) => (i + 1) % FACTS.length), 4200);
    return () => clearInterval(t);
  }, [reduced]);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 p-8 text-center"
      style={{
        background: `radial-gradient(ellipse at 50% 32%, ${NAVY_TOP} 0%, ${NAVY_BOT} 72%)`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 200px 50px rgba(0,0,0,0.6)" }}
      />

      {/* Cancel — true-aborts the recording (Esc also triggers). Hidden on the
          error state, where the footer's Close handles dismissal. */}
      {!isError && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel podcast recording"
          className="group absolute top-4 right-4 z-10 grid place-items-center w-9 h-9 rounded-full border border-[rgba(255,255,255,0.14)] text-white/70 transition-all duration-200 hover:text-[#E0B14C] hover:border-[#E0B14C] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc]"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <X size={18} />
        </button>
      )}

      {/* ON AIR chip */}
      <div
        className="relative flex items-center gap-2 px-4 py-1.5 rounded-full"
        style={{
          background: "rgba(0,0,0,0.5)",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        <motion.span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: "#ff4d4d", boxShadow: "0 0 10px #ff4d4d" }}
          animate={reduced ? undefined : { opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="text-[11px] font-mono tracking-[0.22em] text-white/80">
          ON AIR
        </span>
      </div>

      {/* Stage: pulsing rings + guest portrait (or mic before casting) */}
      <div
        className="relative flex items-center justify-center"
        style={{ width: 260, height: 196 }}
      >
        {!reduced &&
          recording &&
          [0, 1, 2].map((r) => (
            <motion.span
              key={r}
              aria-hidden
              className="absolute rounded-full"
              style={{ border: `1px solid ${GOLD}`, width: 96, height: 96 }}
              initial={{ opacity: 0.5, scale: 1 }}
              animate={{ opacity: 0, scale: 2.4 }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                delay: r * 0.7,
                ease: "easeOut",
              }}
            />
          ))}

        {guestSrc ? (
          <motion.img
            src={guestSrc}
            alt=""
            onError={onGuestError}
            draggable={false}
            initial={{ y: 24, opacity: 0, scale: 0.92 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative object-contain"
            style={{
              height: 188,
              width: "auto",
              filter: `drop-shadow(0 10px 30px ${GOLD_GLOW})`,
            }}
          />
        ) : (
          <motion.div
            className="relative grid place-items-center rounded-full"
            style={{
              width: 92,
              height: 92,
              background: `radial-gradient(circle at 50% 38%, ${GOLD_SOFT}, ${GOLD})`,
              boxShadow: `0 0 42px ${GOLD_GLOW}`,
            }}
            animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex items-end gap-[3px]" style={{ height: 34 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span
                  key={i}
                  style={{ width: 5, borderRadius: 3, background: "#231803" }}
                  animate={reduced ? { height: 16 } : { height: [9, 30, 13, 26, 9] }}
                  transition={
                    reduced
                      ? undefined
                      : {
                          duration: 0.9 + i * 0.12,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.08,
                        }
                  }
                />
              ))}
            </div>
          </motion.div>
        )}

        <div
          aria-hidden
          className="absolute"
          style={{
            bottom: -4,
            width: 150,
            height: 22,
            borderRadius: "50%",
            background: `radial-gradient(ellipse, ${GOLD_GLOW}, transparent 70%)`,
            filter: "blur(3px)",
          }}
        />
      </div>

      {/* Guest name / casting copy */}
      {progress.persona ? (
        <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <div
            className="text-[11px] font-mono uppercase tracking-[0.18em]"
            style={{ color: CYAN }}
          >
            Tonight&apos;s guest
          </div>
          <div className="font-display text-white text-xl leading-tight">
            {progress.persona.name}
          </div>
          <div className="text-white/55 text-sm">
            the {progress.persona.archetype}
          </div>
        </motion.div>
      ) : (
        <div className="text-white/70 text-sm">
          Casting the perfect expert guest…
        </div>
      )}

      {/* Current stage + progress */}
      <div className="w-[min(420px,86vw)]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-white/90 text-sm font-medium">
            {recording
              ? "Recording the conversation…"
              : `${STAGES[Math.max(0, curIdx)]?.label ?? "Warming up"}…`}
          </span>
          {recording && (
            <span className="text-[11px] font-mono" style={{ color: GOLD_SOFT }}>
              line {progress.done}/{progress.total}
            </span>
          )}
        </div>

        <div
          className="h-2 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          {recording ? (
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }}
              animate={{ width: `${pct}%` }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          ) : (
            <motion.div
              className="h-full w-1/3 rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
              }}
              animate={reduced ? undefined : { x: ["-110%", "320%"] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-3">
          {STAGES.map((s, i) => (
            <span
              key={s.key}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === curIdx ? 26 : 14,
                background: i <= curIdx ? GOLD : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Did you know */}
      {!isError && (
        <motion.div
          key={factIdx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-[460px] rounded-xl px-4 py-2.5"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.09)",
          }}
        >
          <span className="mr-1.5">💡</span>
          <span className="text-white/70 text-[13px]">
            <span style={{ color: GOLD_SOFT }}>Did you know? </span>
            {FACTS[factIdx]}
          </span>
        </motion.div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-white/80 text-sm">
            {progress.message ?? "Something went wrong."}
          </div>
          <div className="flex items-center gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="px-5 py-2 rounded-full text-sm font-semibold text-[#231803] transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc]"
                style={{
                  background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})`,
                  boxShadow: `0 4px 18px ${GOLD_GLOW}`,
                }}
              >
                Try again
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-2 rounded-full text-sm font-medium text-white/80 border border-[rgba(255,255,255,0.16)] transition-all duration-200 hover:text-white hover:border-[rgba(255,255,255,0.32)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc]"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
