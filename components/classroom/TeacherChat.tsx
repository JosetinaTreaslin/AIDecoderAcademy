"use client";

// Classroom Teacher chat panel — Ms. Bhavna.
// Mirrors AIDA's interaction patterns (streaming text, mic STT, TTS playback,
// message history) but with the teacher's warm navy/gold/violet palette
// and a "Guided Lesson" mode (one-bubble-at-a-time walkthrough).
//
// Backend: POST /api/classroom/chat (SSE streaming, existing route).
// STT:     POST /api/aida/stt
// TTS:     POST /api/aida/tts  body: { text, role: "classroom" }

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Send, Mic, MicOff, Volume2, VolumeX, X, BookOpen, MessageSquare, ArrowRight } from "lucide-react";
import { buildClassroomGreeting } from "@/lib/teacherPanelGreeting";
import type { Profile } from "@/types";

interface Props {
  profile: Profile | null;
  chapterTitle?: string;
  onClose: () => void;
}

type Mode = "chat" | "lecture";
type Role = "user" | "assistant";

interface Msg {
  role: Role;
  content: string;
  streaming?: boolean;
}

// ── Teacher palette (warm, not AIDA's steel) ───────────────────────────────
const NAVY_DEEP   = "#0A1230";
const NAVY_MID    = "#15224E";
const GOLD        = "#E0B14C";
const GOLD_GLOW   = "rgba(224,177,76,0.45)";
const VIOLET      = "#9D6BFF";
const VIOLET_DEEP = "#5B2BCC";
const TEXT_HI     = "#F4ECD7";
const TEXT_MID    = "rgba(244,236,215,0.78)";
const TEXT_LO     = "rgba(244,236,215,0.50)";

export function TeacherChat({ profile, chapterTitle, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [recording, setRecording] = useState(false);

  const audioRef    = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const scrollRef   = useRef<HTMLDivElement>(null);

  // ── Initial greeting from learner-aware builder ─────────────────────────
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

  // Seed with greeting on mount.
  useEffect(() => {
    setMessages([{ role: "assistant", content: greeting.text }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new content.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Reflection on close (fire-and-forget) ───────────────────────────────
  const fireReflection = useCallback(async () => {
    if (messages.length < 2) return;
    try {
      // We need profile.id for the API; if absent, skip.
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
    void fireReflection();
    audioRef.current?.pause();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    onClose();
  }, [fireReflection, onClose]);

  // ── Send a text message (used by both modes) ────────────────────────────
  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || streaming) return;
    setInput("");
    setVoiceError(null);

    const history = messages.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: "", streaming: true }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/classroom/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message:      text,
          chapterTitle: chapterTitle || "General Study",
          history,
        }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`Chat ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
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
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: full, streaming: true };
                return copy;
              });
            }
          } catch { /* ignore malformed frames */ }
        }
      }

      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: full, streaming: false };
        return copy;
      });
    } catch (e) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `(Couldn't reach the teacher: ${(e as Error).message})`, streaming: false };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, chapterTitle]);

  // ── TTS — play the last assistant message ───────────────────────────────
  const speakLast = useCallback(async () => {
    if (ttsPlaying) {
      audioRef.current?.pause();
      audioRef.current = null;
      setTtsPlaying(false);
      return;
    }
    const last = [...messages].reverse().find(m => m.role === "assistant" && !m.streaming);
    if (!last) return;
    setVoiceError(null);
    setTtsPlaying(true);
    try {
      const res = await fetch("/api/aida/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: last.content.slice(0, 1500), role: "classroom" }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`TTS ${res.status}${t ? ` · ${t.slice(0, 80)}` : ""}`);
      }
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("Empty audio");
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setTtsPlaying(false); setVoiceError("Audio failed to load."); URL.revokeObjectURL(url); };
      await audio.play();
    } catch (e) {
      setTtsPlaying(false);
      setVoiceError((e as Error).message ?? "Voice unavailable");
    }
  }, [messages, ttsPlaying]);

  // ── STT — record mic, upload to deepgram, populate input ─────────────────
  const startRecording = useCallback(async () => {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) { setRecording(false); return; }
        try {
          const r = await fetch("/api/aida/stt", {
            method:  "POST",
            headers: { "Content-Type": "audio/webm" },
            body:    blob,
          });
          if (r.ok) {
            const { transcript } = await r.json();
            if (transcript?.trim()) {
              setInput(transcript.trim());
            }
          } else {
            setVoiceError(`Transcription failed (${r.status})`);
          }
        } catch (e) {
          setVoiceError((e as Error).message ?? "Mic transcription failed");
        } finally {
          setRecording(false);
        }
      };
      recorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (e) {
      setVoiceError("Mic permission denied or unavailable");
      setRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  // ── Lecture mode: simple driver — sends a "give me a guided lesson" prompt ─
  const startLecture = useCallback(() => {
    setMode("lecture");
    const prompt = chapterTitle
      ? `Give me a clear, structured guided lesson on "${chapterTitle}". Cover the key concepts in order, with definitions, examples, and a quick revision summary.`
      : "Give me a clear, structured guided lesson on the current chapter. Cover the key concepts in order, with definitions, examples, and a quick revision summary.";
    void send(prompt);
  }, [chapterTitle, send]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed z-50 flex flex-col"
      style={{
        left:   "calc(clamp(280px, 38vh, 460px) - 24px)",
        bottom: "20px",
        width:  "min(440px, calc(100vw - 32px))",
        height: "min(620px, calc(100vh - 40px))",
        fontFamily: "var(--font-dm-sans,'DM Sans',sans-serif)",
        borderRadius: 20,
        overflow: "hidden",
        background: `
          radial-gradient(120% 80% at 0% 0%, ${VIOLET_DEEP}22 0%, transparent 60%),
          radial-gradient(120% 80% at 100% 100%, ${GOLD}1a 0%, transparent 55%),
          linear-gradient(170deg, ${NAVY_MID} 0%, ${NAVY_DEEP} 100%)
        `,
        border: `1px solid ${GOLD}55`,
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

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.08] flex-shrink-0">
        <div className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
          style={{ border: `1.5px solid ${GOLD}aa`, boxShadow: `0 0 12px ${GOLD_GLOW}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/classroom/teacher-bhavna.png" alt="" className="w-full h-full"
            style={{ objectFit: "cover", objectPosition: "center 18%" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="uppercase tracking-[0.18em] font-bold"
            style={{ color: GOLD, fontFamily: "var(--font-jetbrains-mono,'JetBrains Mono',monospace)", fontSize: 9 }}>
            {mode === "lecture" ? "Guided Lesson" : "Classroom · In Session"}
          </div>
          <div className="font-black leading-tight" style={{ color: TEXT_HI, fontFamily: "var(--font-syne,'Syne',sans-serif)", fontSize: 15 }}>
            Ms. Bhavna
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => mode === "lecture" ? setMode("chat") : startLecture()}
            disabled={streaming}
            title={mode === "lecture" ? "Switch to free chat" : "Start a guided lesson"}
            className="px-2.5 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-colors"
            style={{
              background: mode === "lecture" ? `linear-gradient(135deg, ${GOLD}, ${VIOLET})` : "rgba(255,255,255,0.06)",
              border: `1px solid ${mode === "lecture" ? GOLD : "rgba(255,255,255,0.12)"}`,
              color: TEXT_HI,
              opacity: streaming ? 0.5 : 1,
            }}
          >
            {mode === "lecture" ? <MessageSquare size={12} /> : <BookOpen size={12} />}
            {mode === "lecture" ? "Chat" : "Lesson"}
          </button>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", color: TEXT_MID }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: "thin" }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="rounded-2xl px-3.5 py-2.5 max-w-[85%]"
              style={{
                background: m.role === "user"
                  ? `linear-gradient(135deg, ${VIOLET_DEEP}, ${VIOLET})`
                  : `linear-gradient(180deg, ${TEXT_HI}10, ${TEXT_HI}05)`,
                border: `1px solid ${m.role === "user" ? `${VIOLET}aa` : `${TEXT_HI}1a`}`,
                color: TEXT_HI,
                fontSize: 13.5,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {m.content || (m.streaming ? "…" : "")}
              {m.streaming && m.content && (
                <span className="inline-block w-1 h-3 ml-0.5 align-middle"
                  style={{ background: GOLD, animation: "tcblink 1s steps(2) infinite" }} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Voice error chip */}
      {voiceError && (
        <div className="mx-4 mb-2 text-[11px] rounded-lg px-3 py-1.5"
          style={{ color: "#FFC7CC", background: "rgba(255,87,108,0.12)", border: "1px solid rgba(255,87,108,0.35)" }}>
          {voiceError}
        </div>
      )}

      {/* Input row */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-white/[0.08] flex-shrink-0"
        style={{ background: "rgba(0,0,0,0.18)" }}>
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={streaming}
          title={recording ? "Stop recording" : "Hold mic to speak"}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            background: recording ? `linear-gradient(135deg, ${GOLD}, ${VIOLET})` : "rgba(255,255,255,0.06)",
            border: `1px solid ${recording ? GOLD : "rgba(255,255,255,0.12)"}`,
            color: TEXT_HI,
            opacity: streaming ? 0.4 : 1,
          }}
        >
          {recording ? <MicOff size={15} /> : <Mic size={15} />}
        </button>

        <button
          onClick={speakLast}
          disabled={streaming}
          title="Hear last response"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            background: ttsPlaying ? `linear-gradient(135deg, ${GOLD}, ${VIOLET})` : "rgba(255,255,255,0.06)",
            border: `1px solid ${ttsPlaying ? GOLD : "rgba(255,255,255,0.12)"}`,
            color: TEXT_HI,
            opacity: streaming ? 0.4 : 1,
          }}
        >
          {ttsPlaying ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>

        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={streaming ? "Bhavna is typing…" : mode === "lecture" ? "Ask a question about the lesson…" : "Ask Ms. Bhavna anything…"}
          disabled={streaming}
          className="flex-1 bg-transparent outline-none text-[13.5px] px-2"
          style={{ color: TEXT_HI }}
        />

        <button
          onClick={() => send()}
          disabled={streaming || !input.trim()}
          aria-label="Send"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
          style={{
            background: input.trim() && !streaming
              ? `linear-gradient(135deg, ${GOLD}, ${VIOLET})`
              : "rgba(255,255,255,0.06)",
            border: `1px solid ${input.trim() && !streaming ? GOLD : "rgba(255,255,255,0.12)"}`,
            color: TEXT_HI,
            opacity: streaming || !input.trim() ? 0.5 : 1,
            cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
          }}
        >
          <Send size={15} />
        </button>
      </div>

      <style jsx>{`
        @keyframes tcblink { from { opacity: 1; } to { opacity: 0; } }
      `}</style>
    </motion.div>
  );
}

export default TeacherChat;
