"use client";

// PodcastStage — a full-screen JRPG / visual-novel "podcast stage".
//
// Two full-body character standees face each other across a deep-navy stage:
// host Bhavna on the left, the topic-matched guest on the right. The ACTIVE
// speaker is lit, slightly raised and saturated; the LISTENER dims to ~45%
// and recedes. A gold dialogue box spans the bottom showing the current line
// and a per-speaker name-plate (host = gold, guest = cyan-blue).
//
// Audio plays line-by-line off a single <audio> element. On each line's
// `ended`, the reducer advances the episode and the lit standee swaps. A mic
// lets the student interrupt: pause -> capture a question (voice via
// MediaRecorder -> /api/classroom/stt, OR a typed fallback) -> POST
// /api/classroom/podcast/interject -> play the guest's answer + bridge-back
// -> resume the held line.
//
// Visual language matches BhavnaWelcomePanel / LecturePanel: navy radial
// stage, gold (#E0B14C) accent + glow, JetBrains-mono uppercase name-plates,
// rounded glass dialogue box, standees slide in from the wings, subtle idle
// breathing (disabled under prefers-reduced-motion).

import type { JSX } from "react";
import { useEffect, useMemo, useReducer, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mic, X, Play, Pause, Send, Loader2, Radio, SkipBack, SkipForward } from "lucide-react";
import { createPortal } from "react-dom";
import {
  initialStage,
  stageReducer,
  currentSegment,
  type StageState,
} from "@/lib/podcastStageReducer";
import type { Segment } from "@/lib/podcastEpisode";
import { personaPortrait, GENERIC_PORTRAIT } from "@/lib/podcastPortraits";

// ── Palette ─────────────────────────────────────────────────────────────────
const GOLD       = "#E0B14C";
const GOLD_SOFT  = "#F0D38A";
const GOLD_GLOW  = "rgba(224,177,76,0.55)";
const GUEST_HUE  = "#9bd0ff";
const GUEST_GLOW = "rgba(155,208,255,0.55)";
const TEXT_HI    = "#F4ECD7";
const TEXT_MID   = "rgba(244,236,215,0.72)";
const EASE = [0.16, 1, 0.3, 1] as const;
// Fallback speaking rate for word-by-word caption reveal when the audio clip's
// duration is unknown (CDN-streamed MP3s report Infinity/NaN on Vercel). Tuned
// to typical TTS pace (~150 wpm) so words track the voice instead of dumping
// the whole line at once.
const WORDS_PER_SECOND = 2.5;
const BHAVNA_SRC = "/classroom/teacher-bhavna.png";

export interface PodcastStageResult {
  title: string;
  persona: { id: string; name: string; archetype: string };
  segments: Segment[];
  transcript: { speaker: "host" | "guest"; text: string }[];
}

interface Props {
  result: PodcastStageResult;
  onClose: () => void;
}

// ── Standee silhouette placeholder (shown if a PNG 404s entirely) ────────────
function Silhouette({ side }: { side: "host" | "guest" }) {
  const glow = side === "host" ? GOLD_GLOW : GUEST_GLOW;
  return (
    <div
      aria-hidden
      className="absolute inset-0 flex items-end justify-center"
      style={{ pointerEvents: "none" }}
    >
      <div
        style={{
          width: "46%",
          height: "82%",
          borderRadius: "50% 50% 14% 14% / 64% 64% 12% 12%",
          background: `radial-gradient(60% 50% at 50% 28%, ${glow}, transparent 72%)`,
          filter: "blur(6px)",
          opacity: 0.5,
        }}
      />
    </div>
  );
}

// ── A single full-body standee ───────────────────────────────────────────────
function Standee({
  side,
  src,
  active,
  reduced,
}: {
  side: "host" | "guest";
  src: string | null;
  active: boolean;
  reduced: boolean | null;
}) {
  const fromX = side === "host" ? -56 : 56;
  const glow = side === "host" ? GOLD_GLOW : GUEST_GLOW;

  // Idle breathing — gentle vertical bob + scale, disabled when reduced motion.
  const idle = reduced
    ? {}
    : {
        y: active ? [0, -8, 0] : [0, -3, 0],
        transition: {
          duration: active ? 4.2 : 6,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };

  return (
    <motion.div
      className="absolute bottom-0 h-full"
      style={{ [side === "host" ? "left" : "right"]: 0, width: "clamp(280px, 34vw, 560px)" }}
      initial={{ x: fromX, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE, delay: side === "host" ? 0.08 : 0.16 }}
    >
      {/* Floor pool of light beneath the active speaker */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: "2%", width: "70%", height: "16%", borderRadius: "50%" }}
        animate={{
          background: `radial-gradient(closest-side, ${glow}, transparent)`,
          opacity: active ? 0.85 : 0.18,
          filter: active ? "blur(10px)" : "blur(14px)",
        }}
        transition={{ duration: 0.55, ease: EASE }}
      />

      <motion.div
        className="absolute inset-0"
        animate={{
          opacity: active ? 1 : 0.45,
          scale: active ? 1 : 0.94,
          y: active ? 0 : 14,
          filter: active
            ? "saturate(1.08) brightness(1.04)"
            : "saturate(0.55) brightness(0.6)",
        }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <motion.div className="absolute inset-0" animate={idle}>
          {src ? (
            <img
              src={src}
              alt={side === "host" ? "Host" : "Guest"}
              draggable={false}
              className="absolute bottom-0 select-none"
              style={{
                [side === "host" ? "left" : "right"]: "2%",
                height: "100%",
                width: "auto",
                maxWidth: "100%",
                objectFit: "contain",
                objectPosition: "bottom",
                transform: side === "host" ? "none" : "scaleX(1)",
                filter: active ? `drop-shadow(0 6px 38px ${glow})` : "none",
                transition: "filter .5s ease",
              }}
            />
          ) : (
            <Silhouette side={side} />
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export function PodcastStage({ result, onClose }: Props): JSX.Element {
  const reduced = useReducedMotion();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [state, dispatch] = useReducer(
    stageReducer,
    result.segments,
    initialStage,
  );

  const [playing, setPlaying] = useState(false);
  // Pre-show gate: hold playback until the student taps "Start the show". This
  // both signposts that the episode is ready AND satisfies the browser autoplay
  // policy (the tap is the user gesture that unlocks <audio>.play()).
  const [armed, setArmed] = useState(true);
  const [micOpen, setMicOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [recording, setRecording] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // ── Visual-novel word reveal (voice-synced, tap-to-complete) ───────────────
  // Every word of the current line is rendered up front (stable layout); we only
  // control how many are VISIBLE via revealCount. revealAll snaps the whole line
  // in on tap WITHOUT touching the audio — the voice keeps talking, mirroring the
  // Ren'Py / Dialogic "skip text reveal" mechanic (minus their stop-voice step).
  const [revealCount, setRevealCount] = useState(0);
  const [revealAll, setRevealAll] = useState(false);

  // ── Guest portrait with onError fallback chain (persona -> generic -> hide) ─
  const [guestSrc, setGuestSrc] = useState<string | null>(
    personaPortrait(result.persona.id),
  );
  const guestStage = useRef<0 | 1 | 2>(0); // 0 persona, 1 generic, 2 hidden
  const onGuestError = useCallback(() => {
    if (guestStage.current === 0) {
      guestStage.current = 1;
      setGuestSrc(GENERIC_PORTRAIT);
    } else {
      guestStage.current = 2;
      setGuestSrc(null);
    }
  }, []);
  // Preload to drive the fallback chain even though the visible <img> is inside
  // Standee (which renders the resolved src; broken-image never shows).
  useEffect(() => {
    if (!guestSrc) return;
    const img = new Image();
    img.onerror = onGuestError;
    img.src = guestSrc;
  }, [guestSrc, onGuestError]);

  const [bhavnaSrc, setBhavnaSrc] = useState<string | null>(BHAVNA_SRC);
  useEffect(() => {
    const img = new Image();
    img.onerror = () => setBhavnaSrc(null);
    img.src = BHAVNA_SRC;
  }, []);

  const seg = currentSegment(state);
  const finished = state.phase === "finished";
  const interjecting =
    state.phase === "interjection" || state.phase === "interrupting";
  const activeSpeaker = seg?.speaker ?? null;

  // ── Mic recorder refs ─────────────────────────────────────────────────────
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // ── Drive the audio element off currentSegment ─────────────────────────────
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (!seg) {
      el.pause();
      return;
    }
    if (el.src !== seg.audioUrl) {
      el.src = seg.audioUrl;
    }
    if (playing) {
      el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg?.audioUrl, playing]);

  const onAudioEnded = useCallback(() => {
    dispatch({ type: "ended" });
  }, []);

  // ── Playback speed (YouTube-style), persisted across reloads ───────────────
  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const [speed, setSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const v = parseFloat(localStorage.getItem("podcast-playback-speed") ?? "1");
    return SPEEDS.includes(v) ? v : 1;
  });
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ right: number; bottom: number } | null>(null);
  const toggleSpeedMenu = useCallback(() => {
    setSpeedMenuOpen((o) => {
      const next = !o;
      if (next) {
        const r = speedBtnRef.current?.getBoundingClientRect();
        if (r) setMenuPos({ right: window.innerWidth - r.right, bottom: window.innerHeight - r.top + 8 });
      }
      return next;
    });
  }, []);
  const pickSpeed = useCallback((s: number) => {
    setSpeed(s);
    try { localStorage.setItem("podcast-playback-speed", String(s)); } catch { /* private mode */ }
    setSpeedMenuOpen(false);
  }, []);
  // Apply rate to the element on change and whenever a new segment loads.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, seg?.audioUrl]);

  // ── Line-based skip (fits the per-segment audio model) ─────────────────────
  const goToLine = useCallback((index: number) => {
    setPlaying(true);
    dispatch({ type: "seek", index });
  }, []);

  // Words of the current line. ALL render at once (no layout shift); the reveal
  // is purely visual via opacity, clipped by revealCount (Febucci/TMP model).
  const words = useMemo(
    () => (seg?.text ?? "").trim().split(/\s+/).filter(Boolean),
    [seg?.text],
  );

  // Reset the reveal whenever the spoken line changes. Reduced-motion users get
  // the whole line immediately (no per-word animation).
  useEffect(() => {
    setRevealCount(0);
    setRevealAll(Boolean(reduced));
  }, [seg?.audioUrl, reduced]);

  // Voice-synced reveal: match revealed words to audio progress. This is exactly
  // Dialogic's set_text_voice_synced (text finishes when the clip does) and is
  // PROVIDER-AGNOSTIC — it reads the <audio> element's own clock, so it works
  // identically whether the mp3 came from ElevenLabs (now) or AWS Polly (later).
  const onAudioTimeUpdate = useCallback(() => {
    if (revealAll) return;
    const el = audioRef.current;
    const total = words.length;
    if (!el || !total) return;
    // Reveal words in time with the voice off the audio's own clock. currentTime
    // always advances, even when a CDN-streamed MP3 reports duration as
    // Infinity/NaN (as on Vercel) — in that case we estimate the line length from
    // the word count so the karaoke still tracks speech instead of dumping the
    // whole line at once. currentTime/duration are both in media-time, so this
    // stays correct at any playback speed.
    const dur = isFinite(el.duration) && el.duration > 0
      ? el.duration
      : total / WORDS_PER_SECOND;
    const progress = el.currentTime / dur;
    setRevealCount(Math.min(total, Math.ceil(progress * total)));
  }, [revealAll, words.length]);

  // Tap the dialogue line: first tap snaps the full line in (audio keeps
  // playing); once fully shown, a tap advances to the next line ("move quicker").
  const onLineTap = useCallback(() => {
    if (finished || interjecting) return;
    const fullyShown = revealAll || revealCount >= words.length;
    if (!fullyShown) setRevealAll(true);
    else dispatch({ type: "ended" });
  }, [finished, interjecting, revealAll, revealCount, words.length]);

  const togglePlay = useCallback(() => {
    if (finished) return;
    setPlaying((p) => !p);
  }, [finished]);

  // ── Build recentTurns window (~5 around current index) ─────────────────────
  const recentTurns = useMemo(() => {
    const tx = result.transcript;
    const at = state.resumeIndex || state.index;
    const start = Math.max(0, at - 2);
    return tx.slice(start, start + 5).map((t) => ({ speaker: t.speaker, text: t.text }));
  }, [result.transcript, state.index, state.resumeIndex]);

  // ── Submit an interruption (voice or typed) ────────────────────────────────
  const submitQuestion = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q) return;
      setThinking(true);
      setMicError(null);
      setPlaying(false);
      dispatch({ type: "interrupt" });
      try {
        const res = await fetch("/api/classroom/podcast/interject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            topic: result.title,
            personaId: result.persona.id,
            recentTurns,
          }),
        });
        if (!res.ok) throw new Error(`interject ${res.status}`);
        const data = (await res.json()) as { segments?: Segment[] };
        if (!data.segments?.length) throw new Error("no segments");
        dispatch({ type: "interjection", segments: data.segments });
      } catch {
        setMicError("Couldn't reach the guest — resuming the show.");
        dispatch({ type: "cancelInterrupt" });
      } finally {
        setThinking(false);
        setTyped("");
        setMicOpen(false);
        setPlaying(true);
      }
    },
    [recentTurns, result.title, result.persona.id],
  );

  // ── Voice capture ──────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Mic unavailable — type your question instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 400) {
          setMicError("Didn't catch that — try again or type it.");
          return;
        }
        setThinking(true);
        try {
          const res = await fetch("/api/classroom/stt", {
            method: "POST",
            headers: { "Content-Type": blob.type },
            body: blob,
          });
          const data = (await res.json()) as { text?: string };
          const text = (data.text || "").trim();
          setThinking(false);
          if (text) await submitQuestion(text);
          else setMicError("Couldn't hear a question — type it instead.");
        } catch {
          setThinking(false);
          setMicError("Transcription failed — type your question.");
        }
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
      setPlaying(false);
    } catch {
      setMicError("Mic permission denied — type your question instead.");
    }
  }, [submitQuestion]);

  const stopRecording = useCallback(() => {
    setRecording(false);
    recRef.current?.stop();
  }, []);

  const openMic = useCallback(() => {
    if (state.phase !== "episode") return;
    setMicOpen(true);
    setPlaying(false);
  }, [state.phase]);

  const closeMic = useCallback(() => {
    if (recording) stopRecording();
    setMicOpen(false);
    setMicError(null);
    if (!interjecting) setPlaying(true);
  }, [recording, stopRecording, interjecting]);

  // ── Progress ───────────────────────────────────────────────────────────────
  const total = result.segments.length;
  const turnNo = Math.min(state.index + 1, total);
  const progress = interjecting
    ? null
    : finished
      ? 1
      : total > 0
        ? turnNo / total
        : 0;

  const speakerName =
    activeSpeaker === "host"
      ? "Ms. Bhavna"
      : activeSpeaker === "guest"
        ? result.persona.name
        : "";
  const speakerAccent = activeSpeaker === "guest" ? GUEST_HUE : GOLD;
  const speakerGlow = activeSpeaker === "guest" ? GUEST_GLOW : GOLD_GLOW;

  return (
    <motion.div
      className="fixed inset-0 z-[70] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        background:
          "radial-gradient(120% 90% at 50% 14%, #14224f 0%, #0a1230 46%, #050a1c 100%)",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
      }}
    >
      {/* Atmospheric vignette + grain */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(140% 100% at 50% 60%, transparent 50%, rgba(0,0,0,0.62) 100%)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-[0.045] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* Central spotlight beam between the two standees */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          top: 0,
          width: "46vw",
          height: "100%",
          background:
            "radial-gradient(60% 70% at 50% 0%, rgba(224,177,76,0.10), transparent 70%)",
        }}
      />

      {/* ── Top bar: ON-AIR + topic + close ─────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 sm:px-10 pt-5 z-30">
        <div className="flex items-center gap-3">
          <motion.div
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              background: "rgba(224,76,76,0.14)",
              border: "1px solid rgba(255,120,120,0.35)",
            }}
            animate={reduced ? {} : { opacity: [1, 0.55, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Radio size={13} color="#ff8a8a" />
            <span
              style={{
                fontFamily: "var(--font-jetbrains-mono, monospace)",
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "#ffb4b4",
                textTransform: "uppercase",
              }}
            >
              On Air
            </span>
          </motion.div>
          <div className="hidden sm:block">
            <div
              style={{
                fontFamily: "var(--font-jetbrains-mono, monospace)",
                fontSize: 9,
                letterSpacing: "0.22em",
                color: TEXT_MID,
                textTransform: "uppercase",
              }}
            >
              The Decoder Podcast
            </div>
            <div
              style={{
                fontFamily: "var(--font-syne, var(--font-dm-sans, sans-serif))",
                fontWeight: 800,
                fontSize: 15,
                color: TEXT_HI,
                lineHeight: 1.1,
                maxWidth: "40vw",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {result.title}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close podcast"
          className="grid place-items-center rounded-full transition-colors"
          style={{
            width: 38,
            height: 38,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
            color: TEXT_HI,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* ── Stage: two standees ─────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0" style={{ top: 0 }}>
        <div className="relative mx-auto h-full" style={{ maxWidth: 1400, paddingBottom: "clamp(190px, 26vh, 280px)" }}>
          <Standee side="host" src={bhavnaSrc} active={activeSpeaker === "host"} reduced={reduced} />
          <Standee side="guest" src={guestSrc} active={activeSpeaker === "guest"} reduced={reduced} />
        </div>
      </div>

      {/* ── Dialogue box (bottom) ───────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 z-30 px-4 sm:px-8 pb-5">
        <div className="mx-auto" style={{ maxWidth: 1080 }}>
          {/* Name-plate */}
          <AnimatePresence mode="wait">
            {(speakerName || interjecting) && (
              <motion.div
                key={interjecting ? "answering" : speakerName}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -6, opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE }}
                className="inline-flex items-center gap-2 rounded-t-xl px-4 py-1.5 -mb-px relative"
                style={{
                  background: "linear-gradient(180deg, rgba(16,26,60,0.96), rgba(10,18,44,0.96))",
                  borderTop: `1px solid ${speakerAccent}`,
                  borderLeft: `1px solid ${speakerAccent}`,
                  borderRight: `1px solid ${speakerAccent}`,
                  borderBottom: "none",
                  boxShadow: `0 -2px 22px ${speakerGlow}`,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: speakerAccent,
                    boxShadow: `0 0 10px ${speakerAccent}`,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono, monospace)",
                    fontSize: 11,
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: speakerAccent,
                    fontWeight: 600,
                  }}
                >
                  {interjecting ? "Answering…" : speakerName}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Box body */}
          <div
            className="rounded-2xl rounded-tl-none p-5 sm:p-6 relative overflow-hidden"
            style={{
              background: "linear-gradient(180deg, rgba(14,24,56,0.94), rgba(8,14,36,0.96))",
              border: "1px solid rgba(224,177,76,0.42)",
              boxShadow: `0 -8px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)`,
              backdropFilter: "blur(10px)",
            }}
          >
            {/* gold corner accents */}
            <span aria-hidden className="absolute left-3 top-3" style={{ width: 14, height: 14, borderLeft: `2px solid ${GOLD}`, borderTop: `2px solid ${GOLD}`, opacity: 0.7 }} />
            <span aria-hidden className="absolute right-3 bottom-3" style={{ width: 14, height: 14, borderRight: `2px solid ${GOLD}`, borderBottom: `2px solid ${GOLD}`, opacity: 0.7 }} />

            <div className="min-h-[68px] flex items-center">
              {/* No AnimatePresence "wait" here: a fast prev/next skip jumps the
                  line index mid-exit, the exit-complete callback races, and the
                  caption freezes on a stale line while audio + counter advance.
                  The keyed motion.p remounts per line and still fades in. */}
                <motion.p
                  key={`${state.phase}-${state.index}-${state.interIndex}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE }}
                  onClick={onLineTap}
                  title={
                    finished || interjecting
                      ? undefined
                      : revealAll || revealCount >= words.length
                        ? "Tap to skip to the next line"
                        : "Tap to show the whole line"
                  }
                  style={{
                    color: TEXT_HI,
                    fontSize: "clamp(16px, 2.1vw, 21px)",
                    lineHeight: 1.5,
                    fontWeight: 500,
                    cursor: finished || interjecting ? "default" : "pointer",
                  }}
                >
                  {thinking && interjecting && !seg
                    ? "The guest is thinking it over…"
                    : finished
                      ? "That's a wrap on today's episode. Tap a mic anytime to ask more!"
                      : words.map((w, i) => (
                          <span
                            key={i}
                            style={{
                              opacity: revealAll || i < revealCount ? 1 : 0,
                              transition: reduced ? undefined : "opacity 140ms ease",
                            }}
                          >
                            {w}
                            {i < words.length - 1 ? " " : ""}
                          </span>
                        ))}
                </motion.p>
            </div>

            {/* Controls row */}
            <div className="mt-4 flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => goToLine(state.index - 1)}
                disabled={interjecting || state.index <= 0}
                aria-label="Previous line"
                className="grid place-items-center rounded-full transition-all active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc]"
                style={{ width: 36, height: 36, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)", color: TEXT_HI }}
              >
                <SkipBack size={16} />
              </button>
              <button
                onClick={togglePlay}
                disabled={finished}
                aria-label={playing ? "Pause" : "Play"}
                className="grid place-items-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
                style={{
                  width: 44,
                  height: 44,
                  background: `linear-gradient(180deg, ${GOLD_SOFT}, ${GOLD})`,
                  color: "#1a1304",
                  boxShadow: `0 4px 18px ${GOLD_GLOW}`,
                }}
              >
                {playing ? <Pause size={19} /> : <Play size={19} style={{ marginLeft: 2 }} />}
              </button>

              <button
                onClick={() => goToLine(state.index + 1)}
                disabled={interjecting || state.index >= state.episode.length - 1}
                aria-label="Next line"
                className="grid place-items-center rounded-full transition-all active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc]"
                style={{ width: 36, height: 36, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)", color: TEXT_HI }}
              >
                <SkipForward size={16} />
              </button>

              {/* Progress / status */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    style={{
                      fontFamily: "var(--font-jetbrains-mono, monospace)",
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      color: TEXT_MID,
                      textTransform: "uppercase",
                    }}
                  >
                    {interjecting ? "Live Q&A" : `Turn ${turnNo} / ${total}`}
                  </span>
                  {interjecting && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: GUEST_HUE, fontSize: 11 }}>
                      <Loader2 size={12} className="animate-spin" /> answering…
                    </span>
                  )}
                </div>
                <div
                  className="h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  {interjecting ? (
                    <motion.div
                      className="h-full"
                      style={{ background: `linear-gradient(90deg, ${GUEST_HUE}, ${GOLD})`, width: "40%" }}
                      animate={reduced ? {} : { x: ["-40%", "260%"] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : (
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD_SOFT})` }}
                      animate={{ width: `${(progress ?? 0) * 100}%` }}
                      transition={{ duration: 0.5, ease: EASE }}
                    />
                  )}
                </div>
              </div>

              {/* Playback speed — menu portaled to <body> to escape the
                  dialogue box's overflow-hidden + backdrop-filter clip. */}
              <div className="relative">
                <button
                  ref={speedBtnRef}
                  onClick={toggleSpeedMenu}
                  aria-label={`Playback speed, currently ${speed}x`}
                  aria-haspopup="menu"
                  aria-expanded={speedMenuOpen}
                  className="grid place-items-center rounded-full transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc]"
                  style={{
                    height: 36,
                    minWidth: 48,
                    padding: "0 10px",
                    background: "rgba(255,255,255,0.06)",
                    border: `1px solid ${speedMenuOpen ? GOLD : "rgba(255,255,255,0.16)"}`,
                    color: speed !== 1 ? GOLD_SOFT : TEXT_HI,
                    fontFamily: "var(--font-jetbrains-mono, monospace)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {speed}×
                </button>
              </div>
              {speedMenuOpen && menuPos && typeof document !== "undefined" &&
                createPortal(
                  <>
                    <button
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setSpeedMenuOpen(false)}
                      className="fixed inset-0 z-[88] cursor-default"
                      style={{ background: "transparent" }}
                    />
                    <div
                      role="menu"
                      aria-label="Playback speed"
                      className="fixed z-[89] rounded-xl overflow-hidden"
                      style={{
                        bottom: menuPos.bottom,
                        right: menuPos.right,
                        minWidth: 96,
                        background: "#0b1226",
                        border: "1px solid rgba(255,255,255,0.14)",
                        boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
                      }}
                    >
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          role="menuitemradio"
                          aria-checked={s === speed}
                          onClick={() => pickSpeed(s)}
                          className="w-full text-left px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc]"
                          style={{
                            background: s === speed ? "rgba(224,177,76,0.16)" : "transparent",
                            color: s === speed ? GOLD_SOFT : TEXT_HI,
                            fontFamily: "var(--font-jetbrains-mono, monospace)",
                            fontSize: 12,
                          }}
                        >
                          {s}×{s === 1 ? "  Normal" : ""}
                        </button>
                      ))}
                    </div>
                  </>,
                  document.body,
                )}

              {/* Mic button */}
              <button
                onClick={micOpen ? closeMic : openMic}
                disabled={state.phase !== "episode"}
                aria-label="Ask a question"
                className="grid place-items-center rounded-full transition-all active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed"
                style={{
                  width: 44,
                  height: 44,
                  background: micOpen ? "rgba(155,208,255,0.18)" : "rgba(255,255,255,0.06)",
                  border: `1px solid ${micOpen ? GUEST_HUE : "rgba(255,255,255,0.16)"}`,
                  color: micOpen ? GUEST_HUE : TEXT_HI,
                }}
              >
                <Mic size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mic / question panel ────────────────────────────────────────── */}
      <AnimatePresence>
        {micOpen && (
          <motion.div
            className="absolute inset-0 z-40 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ background: "rgba(3,7,20,0.6)", backdropFilter: "blur(3px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) closeMic(); }}
          >
            <motion.div
              initial={{ y: 32, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 32, opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.34, ease: EASE }}
              className="w-full rounded-2xl p-6"
              style={{
                maxWidth: 520,
                background: "linear-gradient(180deg, rgba(18,28,64,0.98), rgba(9,15,38,0.98))",
                border: `1px solid ${GUEST_HUE}`,
                boxShadow: `0 0 40px ${GUEST_GLOW}, inset 0 1px 0 rgba(255,255,255,0.1)`,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-jetbrains-mono, monospace)",
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  color: GUEST_HUE,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Interrupt the show
              </div>
              <div
                style={{
                  fontFamily: "var(--font-syne, var(--font-dm-sans, sans-serif))",
                  fontWeight: 800,
                  fontSize: 20,
                  color: TEXT_HI,
                  marginBottom: 16,
                }}
              >
                Ask {result.persona.name} a question
              </div>

              {/* Voice capture */}
              <div className="flex flex-col items-center gap-3 mb-5">
                <motion.button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={thinking}
                  aria-label={recording ? "Stop recording" : "Record question"}
                  className="grid place-items-center rounded-full disabled:opacity-50"
                  style={{
                    width: 76,
                    height: 76,
                    background: recording
                      ? "linear-gradient(180deg, #ff7a7a, #e04c4c)"
                      : `linear-gradient(180deg, ${GOLD_SOFT}, ${GOLD})`,
                    color: recording ? "#fff" : "#1a1304",
                    boxShadow: recording ? "0 0 30px rgba(224,76,76,0.6)" : `0 0 26px ${GOLD_GLOW}`,
                  }}
                  animate={recording && !reduced ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={{ duration: 1, repeat: recording ? Infinity : 0, ease: "easeInOut" }}
                >
                  {thinking ? <Loader2 size={26} className="animate-spin" /> : <Mic size={28} />}
                </motion.button>
                <span style={{ fontSize: 13, color: TEXT_MID }}>
                  {thinking
                    ? "Working on it…"
                    : recording
                      ? "Listening — tap to send"
                      : "Tap to speak"}
                </span>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-4">
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
                <span style={{ fontSize: 10, letterSpacing: "0.18em", color: TEXT_MID, textTransform: "uppercase", fontFamily: "var(--font-jetbrains-mono, monospace)" }}>
                  or type
                </span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.12)" }} />
              </div>

              {/* Typed fallback */}
              <form
                onSubmit={(e) => { e.preventDefault(); if (!thinking) submitQuestion(typed); }}
                className="flex items-center gap-2"
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Type your question…"
                  disabled={thinking}
                  autoFocus
                  className="flex-1 rounded-xl px-4 py-3 outline-none disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    color: TEXT_HI,
                    fontSize: 15,
                  }}
                />
                <button
                  type="submit"
                  disabled={thinking || !typed.trim()}
                  aria-label="Send question"
                  className="grid place-items-center rounded-xl transition-transform active:scale-95 disabled:opacity-40"
                  style={{
                    width: 48,
                    height: 48,
                    background: `linear-gradient(180deg, ${GOLD_SOFT}, ${GOLD})`,
                    color: "#1a1304",
                  }}
                >
                  <Send size={18} />
                </button>
              </form>

              {micError && (
                <div style={{ marginTop: 12, fontSize: 13, color: "#ffb4b4" }}>{micError}</div>
              )}

              <button
                onClick={closeMic}
                className="mt-4 w-full rounded-xl py-2.5 transition-colors"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: TEXT_MID,
                  fontSize: 13,
                }}
              >
                Back to the show
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Single hidden audio element drives the whole episode */}
      {/* ── Pre-show "Start the show" gate (also satisfies autoplay policy) ─── */}
      <AnimatePresence>
        {armed && (
          <motion.div
            key="armed"
            className="absolute inset-0 z-[80] flex flex-col items-center justify-center gap-5 p-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              background:
                "radial-gradient(ellipse at 50% 34%, #16244f 0%, #050a1c 74%)",
            }}
          >
            <div
              className="text-[11px] font-mono uppercase tracking-[0.18em]"
              style={{ color: GUEST_HUE }}
            >
              Tonight&apos;s guest
            </div>
            {guestSrc && (
              <motion.img
                src={guestSrc}
                alt=""
                draggable={false}
                initial={reduced ? undefined : { y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="object-contain"
                style={{
                  height: 200,
                  width: "auto",
                  filter: `drop-shadow(0 10px 30px ${GOLD_GLOW})`,
                }}
              />
            )}
            <div>
              <div className="font-display text-white text-2xl leading-tight">
                {result.persona.name}
              </div>
              <div className="text-white/55 text-sm">
                the {result.persona.archetype}
              </div>
            </div>
            <button
              onClick={() => {
                setArmed(false);
                setPlaying(true);
                audioRef.current?.play().catch(() => {});
              }}
              className="flex items-center gap-3 rounded-full px-7 py-3.5 active:scale-95 transition-transform"
              style={{
                background: `linear-gradient(180deg, ${GOLD_SOFT}, ${GOLD})`,
                color: "#1a1304",
                boxShadow: `0 6px 28px ${GOLD_GLOW}`,
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              <Play size={20} style={{ marginLeft: 1 }} />
              Start the show
            </button>
            <div className="text-white/45 text-xs">
              Tap to begin · {total} lines
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <audio ref={audioRef} onEnded={onAudioEnded} onTimeUpdate={onAudioTimeUpdate} preload="auto" />
    </motion.div>
  );
}
