"use client";

// Classroom Teacher chat panel — Ms. Bhavna.
// Text + Voice modes (tap-to-talk and live call).
// Lecture mode lives in LecturePanel — the "Lesson" button here opens it.
//
// Fixes applied:
//   • Toggle label = current state (Text/Voice pill; "Lesson" button always says Lesson)
//   • X button has generous spacing from the toggles (fat-finger safe)
//   • Voice panel includes "or type" textarea fallback
//   • Space bar triggers tap-to-talk when voice panel is focused
//   • abortStream clears the streaming flag on message bubbles too

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Send, Mic, Square, Volume2, VolumeX, X, BookOpen, MessageSquare } from "lucide-react";
import { buildClassroomGreeting } from "@/lib/teacherPanelGreeting";
import { useTeacherVoice } from "./useTeacherVoice";
import ReactMarkdown from "react-markdown";
import type { Profile } from "@/types";

interface Props {
  profile:            Profile | null;
  chapterTitle?:      string;
  onClose:            () => void;
  /** Lifts Bhavna's speaking state up so the standee can pulse while she talks. */
  onSpeakingChange?:  (speaking: boolean) => void;
  /** Called when the student taps the "Lesson" button. */
  onOpenLecture?:     () => void;
}

type Role = "user" | "assistant";

interface Msg {
  role:      Role;
  content:   string;
  streaming?: boolean;
}

// Compact markdown styling for Bhavna's chat bubbles — keeps headings/lists/code
// readable inside a narrow panel instead of dumping raw ## / ** / ``` symbols.
const TC_MD_CSS = `
.tc-md > :first-child { margin-top: 0; }
.tc-md > :last-child  { margin-bottom: 0; }
.tc-md p              { margin: 0 0 0.7vmin; }
.tc-md ul, .tc-md ol  { margin: 0 0 0.7vmin; padding-left: 2vmin; }
.tc-md li             { margin: 0.2vmin 0; }
.tc-md h1, .tc-md h2, .tc-md h3 { font-weight: 700; margin: 1vmin 0 0.4vmin; line-height: 1.3; font-family: inherit; letter-spacing: normal; }
.tc-md h1 { font-size: 1.6vmin; }
.tc-md h2 { font-size: 1.6vmin; }
.tc-md h3 { font-size: 1.5vmin; }
.tc-md strong { font-weight: 800; }
.tc-md code   { background: rgba(255,255,255,0.12); border-radius: 0.4vmin; padding: 0.1vmin 0.4vmin; font-size: 1.3vmin; }
.tc-md pre    { background: rgba(0,0,0,0.4); border-radius: 0.9vmin; padding: 0.9vmin 1.1vmin; overflow-x: auto; margin: 0 0 0.7vmin; }
.tc-md pre code { background: transparent; padding: 0; }
.tc-md a { color: #E0B14C; text-decoration: underline; }
`;

// Bullets sometimes arrive as the U+2212 minus sign / en-dash, which markdown
// won't parse as a list. Normalise them to real "- " bullets before rendering.
const normalizeMd = (s: string) => s.replace(/^[−–]\s/gm, "- ");

// ── Teacher palette ───────────────────────────────────────────────────────────
const NAVY_DEEP   = "#0A1230";
const NAVY_MID    = "#15224E";
const GOLD        = "#E0B14C";
const GOLD_GLOW   = "rgba(224,177,76,0.45)";
const VIOLET      = "#9D6BFF";
const VIOLET_DEEP = "#5B2BCC";
const TEXT_HI     = "#F4ECD7";
const TEXT_MID    = "rgba(244,236,215,0.78)";
const TEXT_LO     = "rgba(244,236,215,0.50)";

export function TeacherChat({ profile, chapterTitle, onClose, onSpeakingChange, onOpenLecture }: Props) {
  const [io,        setIo]        = useState<"text" | "voice">("text");
  const [messages,  setMessages]  = useState<Msg[]>([]);
  const [input,     setInput]     = useState("");
  const [streaming, setStreaming] = useState(false);

  const scrollRef     = useRef<HTMLDivElement>(null);
  const ioRef         = useRef<"text" | "voice">("text");
  const messagesRef   = useRef<Msg[]>([]);
  const streamingRef  = useRef(false);
  const streamGenRef  = useRef(0);
  const sendAbortRef  = useRef<AbortController | null>(null);
  const sendRef       = useRef<(t?: string) => void>(() => {});

  useEffect(() => { ioRef.current = io; }, [io]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── Greeting ─────────────────────────────────────────────────────────────
  const greeting = useMemo(() => {
    const lmRaw = (profile as (Profile & { learner_model?: Record<string, unknown> }) | null)
      ?.learner_model ?? null;
    return buildClassroomGreeting({
      displayName:     profile?.display_name ?? "Explorer",
      activeArena:     profile?.active_arena ?? null,
      isReturning:     ((profile as unknown as { reflection_count?: number })?.reflection_count ?? 0) > 0,
      learnerModelRaw: lmRaw,
    });
  }, [profile]);

  useEffect(() => {
    setMessages([{ role: "assistant", content: greeting.text }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Voice ─────────────────────────────────────────────────────────────────
  const handleTranscript = useCallback((t: string) => {
    sendRef.current(t);
  }, []);

  const voice = useTeacherVoice({
    onTranscript: handleTranscript,
    onInterrupt: () => {
      streamGenRef.current++;
      sendAbortRef.current?.abort();
      setStreaming(false); streamingRef.current = false;
      setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
    },
  });

  // Stable speak ref — lets `send` drop `voice` from its deps
  const speakRef = useRef(voice.speak);
  speakRef.current = voice.speak;
  // Live refs for the karaoke reveal in voice mode.
  const spokenCharsRef = useRef(voice.spokenChars);
  spokenCharsRef.current = voice.spokenChars;
  const vsRef = useRef(voice.voiceState);
  vsRef.current = voice.voiceState;
  const mutedRef = useRef(voice.muted);
  mutedRef.current = voice.muted;

  useEffect(() => {
    onSpeakingChange?.(voice.voiceState === "speaking");
  }, [voice.voiceState, onSpeakingChange]);

  // ── Stream abort ──────────────────────────────────────────────────────────
  const abortStream = useCallback(() => {
    streamGenRef.current++;
    sendAbortRef.current?.abort();
    setStreaming(false); streamingRef.current = false;
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
  }, []);

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || streamingRef.current) return;
    setInput("");

    const myGen  = ++streamGenRef.current;
    const history = messagesRef.current
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role, content: m.content }));

    setMessages(prev => [
      ...prev,
      { role: "user",      content: text },
      { role: "assistant", content: "", streaming: true },
    ]);
    setStreaming(true); streamingRef.current = true;

    const ctrl = new AbortController();
    sendAbortRef.current = ctrl;
    try {
      const res = await fetch("/api/classroom/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        signal:  ctrl.signal,
        body: JSON.stringify({
          message:      text,
          chapterTitle: chapterTitle || "General Study",
          history,
          isVoiceMode:  ioRef.current === "voice",
        }),
      });
      if (!res.ok || !res.body) throw new Error(`Chat ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", full = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (streamGenRef.current !== myGen) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.content) {
              full += parsed.content;
              // Voice mode: hold the bubble (shows "…") and reveal word-by-word
              // synced to Bhavna's audio after the stream finishes. Text mode:
              // stream straight into the bubble as it arrives.
              if (ioRef.current !== "voice") {
                setMessages(prev => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { role: "assistant", content: full, streaming: true };
                  return copy;
                });
              }
            }
          } catch { /* ignore malformed frame */ }
        }
      }
      if (streamGenRef.current !== myGen) return;

      const setBubble = (content: string, streaming: boolean) => {
        setMessages(prev => {
          const copy = [...prev];
          if (copy[copy.length - 1]?.role === "assistant") {
            copy[copy.length - 1] = { role: "assistant", content, streaming };
          }
          return copy;
        });
      };

      if (ioRef.current === "voice" && full.trim() && !mutedRef.current) {
        // Start audio (sets word timings) and reveal text word-by-word in sync.
        void speakRef.current(full);
        let everSpoke = false;
        const startT = performance.now();
        const revealTick = () => {
          if (streamGenRef.current !== myGen) return;
          const speaking = vsRef.current === "speaking";
          if (speaking) everSpoke = true;
          const sc = spokenCharsRef.current();
          // sc === -1 (timings not loaded yet) → hold at 0 so text never leads.
          const target = sc >= 0 ? Math.min(full.length, sc) : 0;
          // Finalize once audio has started then ended, or if it never started
          // within 1.5s (autoplay blocked / failed) so text isn't stuck hidden.
          const finalize = (everSpoke && !speaking) ||
                           (!everSpoke && performance.now() - startT > 1500);
          setBubble(finalize ? full : full.slice(0, target), !finalize);
          if (!finalize) requestAnimationFrame(revealTick);
        };
        requestAnimationFrame(revealTick);
      } else {
        // Text mode (or muted): show the full reply immediately.
        setBubble(full, false);
      }
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      if (streamGenRef.current !== myGen) return;
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `(Couldn't reach the teacher: ${(e as Error).message})`,
          streaming: false,
        };
        return copy;
      });
    } finally {
      if (streamGenRef.current === myGen) { setStreaming(false); streamingRef.current = false; }
    }
  }, [input, chapterTitle]);

  // Keep ref fresh every render
  sendRef.current = send;

  // ── Close + mode switch ───────────────────────────────────────────────────
  const fireReflection = useCallback(async () => {
    if (messages.length < 2) return;
    try {
      const pid = (profile as { id?: string } | null)?.id;
      if (!pid) return;
      await fetch("/api/learner-model/reflect", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id:         pid,
          session_id:         null,
          surface:            "classroom_teacher",
          messages:           messages.map(m => ({ role: m.role, content: m.content })),
          metrics:            { message_count: messages.length, user_message_count: messages.filter(m => m.role === "user").length },
          session_started_at: new Date(Date.now() - 60_000).toISOString(),
          session_ended_at:   new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch { /* non-blocking */ }
  }, [messages, profile]);

  const handleClose = useCallback(() => {
    abortStream();
    void fireReflection();
    voice.cleanup();
    onClose();
  }, [abortStream, fireReflection, voice, onClose]);

  const switchIo = useCallback((next: "text" | "voice") => {
    if (next === io) return;
    abortStream();
    voice.cleanup();
    setIo(next);
  }, [io, voice, abortStream]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed z-50 flex flex-col"
      style={{
        left:   "calc(38vh - 2.7vmin)",
        bottom: "2.2vmin",
        width:  "min(48.9vmin, calc(100vw - 3.6vmin))",
        height: "min(68.9vmin, calc(100vh - 4.4vmin))",
        fontFamily:   "var(--font-dm-sans,'DM Sans',sans-serif)",
        borderRadius: "2.2vmin",
        overflow:     "hidden",
        background: `
          radial-gradient(120% 80% at 0% 0%, ${VIOLET_DEEP}22 0%, transparent 60%),
          radial-gradient(120% 80% at 100% 100%, ${GOLD}1a 0%, transparent 55%),
          linear-gradient(170deg, ${NAVY_MID} 0%, ${NAVY_DEEP} 100%)
        `,
        border:    `1px solid ${GOLD}55`,
        boxShadow: `
          0 1px 0 ${TEXT_HI}1a inset,
          0 24px 60px -20px rgba(2,4,14,0.6),
          0 0 36px -10px ${GOLD_GLOW}
        `,
      }}
    >
      {/* Top hairline */}
      <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${GOLD}cc 32%, ${VIOLET}aa 68%, transparent 100%)` }}
      />

      {/* ── Header ── */}
      <div className="flex items-center border-b border-white/[0.08] flex-shrink-0"
        style={{ gap: "0.9vmin", padding: "1.3vmin 1.8vmin" }}>
        {/* Avatar */}
        <div className="relative rounded-full overflow-hidden flex-shrink-0"
          style={{ width: "4vmin", height: "4vmin", border: `0.2vmin solid ${GOLD}aa`, boxShadow: `0 0 1.3vmin ${GOLD_GLOW}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/classroom/teacher-bhavna.png" alt="" className="w-full h-full"
            style={{ objectFit: "cover", objectPosition: "center 18%" }} />
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="uppercase tracking-[0.18em] font-bold"
            style={{ color: GOLD, fontFamily: "var(--font-jetbrains-mono,'JetBrains Mono',monospace)", fontSize: "1vmin" }}>
            Classroom · In Session
          </div>
          <div className="font-black leading-tight"
            style={{ color: TEXT_HI, fontFamily: "var(--font-syne,'Syne',sans-serif)", fontSize: "1.7vmin" }}>
            Ms. Bhavna
          </div>
        </div>

        {/* Text / Voice toggle — shows current state highlighted */}
        {voice.voiceOK && (
          <div className="flex items-center rounded-full"
            style={{ gap: "0.2vmin", padding: "0.2vmin", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
            {(["text", "voice"] as const).map(opt => (
              <button key={opt}
                onClick={() => switchIo(opt)}
                className="rounded-full font-bold flex items-center transition-colors"
                style={{ padding: "0.4vmin 1.1vmin", fontSize: "1.1vmin", gap: "0.4vmin",
                  ...(io === opt
                  ? { background: `linear-gradient(135deg, ${GOLD}, ${VIOLET})`, color: TEXT_HI }
                  : { color: TEXT_LO }) }}>
                {opt === "text" ? <MessageSquare size="1.2vmin" /> : <Mic size="1.2vmin" />}
                {opt === "text" ? "Text" : "Voice"}
              </button>
            ))}
          </div>
        )}

        {/* Lesson button — opens LecturePanel, not a mode toggle */}
        <button
          onClick={onOpenLecture}
          disabled={streaming}
          title="Start a guided lesson"
          className="rounded-full font-bold flex items-center transition-colors flex-shrink-0"
          style={{
            padding: "0.7vmin 1.1vmin", fontSize: "1.2vmin", gap: "0.4vmin",
            background: "rgba(255,255,255,0.06)",
            border: `1px solid rgba(255,255,255,0.12)`,
            color:   TEXT_HI,
            opacity: streaming ? 0.5 : 1,
          }}
        >
          <BookOpen size="1.3vmin" /> Lesson
        </button>

        {/* Close — separated with extra left margin so it's not misclick-able */}
        <button
          onClick={handleClose}
          aria-label="Close"
          className="rounded-full flex items-center justify-center transition-colors flex-shrink-0"
          style={{ marginLeft: "0.9vmin", width: "3.6vmin", height: "3.6vmin", background: "rgba(255,255,255,0.04)", color: TEXT_MID }}
        >
          <X size="1.8vmin" />
        </button>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col"
        style={{ scrollbarWidth: "thin", padding: "1.3vmin 1.8vmin", gap: "1.3vmin" }}>
        <style>{TC_MD_CSS}</style>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%]"
              style={{
                borderRadius: "1.8vmin", padding: "1.1vmin 1.6vmin",
                background: m.role === "user"
                  ? `linear-gradient(135deg, ${VIOLET_DEEP}, ${VIOLET})`
                  : `linear-gradient(180deg, ${TEXT_HI}10, ${TEXT_HI}05)`,
                border:     `1px solid ${m.role === "user" ? `${VIOLET}aa` : `${TEXT_HI}1a`}`,
                color:      TEXT_HI,
                fontSize:   "1.5vmin",
                lineHeight: 1.55,
                whiteSpace: m.role === "user" ? "pre-wrap" : "normal",
                wordBreak:  "break-word",
              }}
            >
              {m.role === "assistant"
                ? <div className="tc-md"><ReactMarkdown>{normalizeMd(m.content || (m.streaming ? "…" : ""))}</ReactMarkdown></div>
                : (m.content || (m.streaming ? "…" : ""))}
              {m.streaming && m.content && (
                <span className="inline-block align-middle"
                  style={{ width: "0.4vmin", height: "1.3vmin", marginLeft: "0.2vmin", background: GOLD, animation: "tcblink 1s steps(2) infinite" }} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Voice error chip */}
      {voice.voiceError && (
        <div style={{ margin: "0 1.8vmin 0.9vmin", fontSize: "1.2vmin", borderRadius: "0.9vmin", padding: "0.7vmin 1.3vmin",
          color: "#FFC7CC", background: "rgba(255,87,108,0.12)", border: "1px solid rgba(255,87,108,0.35)" }}>
          {voice.voiceError}
        </div>
      )}

      {/* ── Text input row ── */}
      {io === "text" && (
        <div className="flex items-center border-t border-white/[0.08] flex-shrink-0"
          style={{ gap: "0.9vmin", padding: "1.3vmin", background: "rgba(0,0,0,0.18)" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={streaming ? "Bhavna is typing…" : "Ask Ms. Bhavna anything…"}
            disabled={streaming}
            className="flex-1 bg-transparent outline-none"
            style={{ color: TEXT_HI, fontSize: "1.5vmin", padding: "0 0.9vmin" }}
          />
          <button
            onClick={() => void send()}
            disabled={streaming || !input.trim()}
            aria-label="Send"
            className="rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
            style={{
              width: "4vmin", height: "4vmin",
              background: input.trim() && !streaming
                ? `linear-gradient(135deg, ${GOLD}, ${VIOLET})`
                : "rgba(255,255,255,0.06)",
              border:  `1px solid ${input.trim() && !streaming ? GOLD : "rgba(255,255,255,0.12)"}`,
              color:   TEXT_HI,
              opacity: streaming || !input.trim() ? 0.5 : 1,
              cursor:  streaming || !input.trim() ? "not-allowed" : "pointer",
            }}
          >
            <Send size="1.7vmin" />
          </button>
        </div>
      )}

      {/* ── Voice panel ── */}
      {io === "voice" && <VoicePanel voice={voice} streaming={streaming} onSend={send} />}

      <style jsx>{`
        @keyframes tcblink { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
    </motion.div>
  );
}

// ── VoicePanel ────────────────────────────────────────────────────────────────
// tap + live sub-modes, mic visualizer, mute, and an "or type" fallback textarea.
function VoicePanel({
  voice,
  streaming,
  onSend,
}: {
  voice:    ReturnType<typeof useTeacherVoice>;
  streaming: boolean;
  onSend:   (text?: string) => void;
}) {
  const { voiceState, subMode, setSubMode, liveState, muted, toggleMute,
          toggleTap, toggleLive, micStream, cleanup } = voice;
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const [typeOpen,  setTypeOpen]  = useState(false);
  const [typeInput, setTypeInput] = useState("");

  // Space bar = tap-to-talk toggle (when focus is not in an input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      e.preventDefault();
      if (subMode === "tap") toggleTap();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subMode, toggleTap]);

  // Mic visualizer — runs while recording
  useEffect(() => {
    if (voiceState !== "listening" || !micStream) return;
    let raf = 0, ctx: AudioContext | null = null;
    try {
      const ACtx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      ctx = new ACtx();
      const src      = ctx.createMediaStreamSource(micStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const cv   = canvasRef.current!;
      const c2   = cv.getContext("2d")!;
      const draw = () => {
        raf = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(data);
        c2.clearRect(0, 0, cv.width, cv.height);
        const BAR = 26, W = 3, GAP = 2;
        const startX = (cv.width - (BAR * (W + GAP) - GAP)) / 2;
        for (let i = 0; i < BAR; i++) {
          const amp = data[Math.floor((i / BAR) * data.length * 0.55)] / 255;
          const h   = Math.max(2, amp * cv.height);
          c2.fillStyle = `rgba(224,177,76,${0.45 + amp * 0.55})`;
          c2.fillRect(startX + i * (W + GAP), (cv.height - h) / 2, W, h);
        }
      };
      draw();
    } catch { /* visualizer is optional */ }
    return () => { cancelAnimationFrame(raf); ctx?.close().catch(() => {}); };
  }, [voiceState, micStream]);

  const tapLabel: Record<string, string> = {
    idle: "Tap mic to talk", listening: "Recording… tap to send",
    processing: "Processing…", speaking: "Speaking…",
  };
  const liveLabel: Record<string, string> = {
    idle: "Tap to start a live call", arming: "Connecting…",
    listening: "Listening… just talk", "user-speaking": "Heard you — keep going",
    "awaiting-end": "Catching the rest…", "llm-thinking": "Thinking…",
    "ai-speaking": "Speaking… (talk to interrupt)",
  };
  const label  = subMode === "live" ? (liveLabel[liveState] ?? "") : (tapLabel[voiceState] ?? "");
  const active = subMode === "tap"  ? voiceState !== "idle"         : liveState  !== "idle";

  const GOLD   = "#E0B14C";
  const GOLD_GLOW = "rgba(224,177,76,0.45)";
  const VIOLET = "#9D6BFF";
  const TEXT_HI = "#F4ECD7";
  const TEXT_MID = "rgba(244,236,215,0.78)";
  const TEXT_LO  = "rgba(244,236,215,0.50)";

  return (
    <div className="flex flex-col items-center border-t border-white/[0.08] flex-shrink-0"
      style={{ padding: "1.3vmin", gap: "0.9vmin", background: "rgba(0,0,0,0.18)" }}>

      {/* Tap / Live sub-mode toggle */}
      <div className="flex rounded-full" style={{ gap: "0.2vmin", padding: "0.2vmin", background: "rgba(255,255,255,0.06)" }}>
        {(["tap", "live"] as const).map(s => (
          <button key={s}
            onClick={() => { if (s !== subMode) { cleanup(); setSubMode(s); } }}
            disabled={streaming}
            className="rounded-full font-bold transition-colors"
            style={{ padding: "0.4vmin 1.3vmin", fontSize: "1.1vmin",
              ...(subMode === s
              ? { background: `linear-gradient(135deg, ${GOLD}, ${VIOLET})`, color: TEXT_HI }
              : { color: TEXT_LO, opacity: streaming ? 0.5 : 1 }) }}>
            {s === "tap" ? "Tap to talk" : "Live call"}
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} width={120} height={28} style={{ width: "13.3vmin", height: "3.1vmin" }} />
      <p style={{ color: TEXT_MID, fontSize: "1.2vmin" }}>{label}</p>

      <div className="flex items-center" style={{ gap: "1.3vmin" }}>
        <button
          onClick={subMode === "tap" ? toggleTap : toggleLive}
          aria-label={active ? "Stop" : "Start"}
          className="rounded-full flex items-center justify-center transition-transform active:scale-95"
          style={{
            width: "6.2vmin", height: "6.2vmin",
            background: `linear-gradient(135deg, ${GOLD}, ${VIOLET})`,
            boxShadow:  `0 0 2vmin ${GOLD_GLOW}`,
          }}>
          {active ? <Square size="2.2vmin" color="#fff" /> : <Mic size="2.4vmin" color="#fff" />}
        </button>
        <button
          onClick={toggleMute}
          title={muted ? "Unmute Bhavna" : "Mute Bhavna"}
          aria-label={muted ? "Unmute Bhavna" : "Mute Bhavna"}
          className="rounded-full flex items-center justify-center transition-colors"
          style={{ width: "4vmin", height: "4vmin", background: "rgba(255,255,255,0.06)", border: `1px solid ${muted ? GOLD : "rgba(255,255,255,0.12)"}` }}>
          {muted ? <VolumeX size="1.7vmin" color={TEXT_HI} /> : <Volume2 size="1.7vmin" color={TEXT_HI} />}
        </button>
      </div>

      {/* "or type" fallback — expands a textarea so STT failures don't brick input */}
      <button
        onClick={() => setTypeOpen(v => !v)}
        className="underline underline-offset-2 transition-colors"
        style={{ color: TEXT_LO, fontSize: "1.1vmin" }}>
        {typeOpen ? "hide keyboard" : "or type instead"}
      </button>
      {typeOpen && (
        <div className="w-full flex items-center" style={{ gap: "0.9vmin" }}>
          <input
            value={typeInput}
            onChange={e => setTypeInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && typeInput.trim() && !streaming) {
                onSend(typeInput.trim());
                setTypeInput("");
              }
            }}
            placeholder="Type your message…"
            disabled={streaming}
            className="flex-1 bg-transparent outline-none"
            style={{ border: `1px solid rgba(255,255,255,0.12)`, color: TEXT_HI, background: "rgba(255,255,255,0.04)",
              fontSize: "1.4vmin", padding: "0.7vmin 1.3vmin", borderRadius: "0.9vmin" }}
          />
          <button
            onClick={() => { if (typeInput.trim()) { onSend(typeInput.trim()); setTypeInput(""); } }}
            disabled={streaming || !typeInput.trim()}
            className="rounded-full flex items-center justify-center flex-shrink-0"
            style={{
              width: "3.6vmin", height: "3.6vmin",
              background: typeInput.trim() && !streaming ? `linear-gradient(135deg, ${GOLD}, ${VIOLET})` : "rgba(255,255,255,0.06)",
              opacity: (streaming || !typeInput.trim()) ? 0.5 : 1,
            }}>
            <Send size="1.4vmin" color={TEXT_HI} />
          </button>
        </div>
      )}
    </div>
  );
}

export default TeacherChat;
