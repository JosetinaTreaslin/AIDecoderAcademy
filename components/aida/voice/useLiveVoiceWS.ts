"use client";

// WebSocket-based live voice hook — dual-mode.
//
// ── mode: 'full' (default, AIDA) ────────────────────────────────────────────
//   Full server-side pipeline (matches VoiceAssistant architecture):
//     MediaRecorder webm/opus
//       → binary WS → server Deepgram SDK (STT)
//         → server gpt-4o-mini (LLM, streamed)
//           → server ElevenLabs pcm_22050 (TTS, streamed)
//             → binary WS frames → Web Audio API (gapless 80 ms scheduling)
//
//   Server events handled:
//     { type: 'ready' }             → state: 'listening'
//     { type: 'interim', text }     → update interim; barge-in if 'ai-speaking'
//     { type: 'thinking', text }    → state: 'llm-thinking'; onUserMessage(text)
//     { type: 'speaking_start' }    → state: 'ai-speaking'
//     { type: 'text', text }        → onAssistantToken(token)
//     binary ArrayBuffer            → S16LE PCM → Web Audio gapless playback
//     { type: 'speaking_done' }     → drain audio buffer → state: 'listening'
//     { type: 'interrupted' }       → stopAudio(); state: 'listening'
//
// ── mode: 'stt' (Bhavna classroom) ──────────────────────────────────────────
//   Server does Deepgram STT only; client handles LLM + TTS.
//   Connects to /api/live-voice-ws?mode=stt.
//   Server sends:
//     { type: 'ready' }             → state: 'listening'
//     { type: 'interim', text }     → update interim; barge-in if 'ai-speaking'
//     { type: 'final-transcript' }  → state: 'llm-thinking'; onFinalTranscript(text)
//   Parent calls setAiSpeaking(true/false) to drive barge-in detection.

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveState =
  | "idle"
  | "arming"
  | "listening"
  | "user-speaking"
  | "awaiting-end"
  | "llm-thinking"
  | "ai-speaking";

export interface UseLiveVoiceWSOptions {
  /** 'full' = server does STT+LLM+TTS (default). 'stt' = server does STT only. */
  mode?: "full" | "stt";

  // ── full mode callbacks ─────────────────────────────────────────────────
  /** Called when user utterance ends — add user message bubble. */
  onUserMessage?:    (text: string) => void;
  /** Called for each LLM token — append to assistant bubble. */
  onAssistantToken?: (token: string) => void;
  /** Called after all audio has drained — AI finished speaking. */
  onSpeakingDone?:   () => void;

  // ── stt mode callback ────────────────────────────────────────────────────
  /** Called with final transcript (stt mode). Client handles LLM + TTS. */
  onFinalTranscript?: (text: string) => void;

  // ── common ───────────────────────────────────────────────────────────────
  /** Called when user barged in during AI speech. */
  onInterrupt?: () => void;
  onError?:     (err: Error) => void;
}

export interface UseLiveVoiceWSReturn {
  state:         LiveState;
  interim:       string;
  start:         () => Promise<void>;
  stop:          () => Promise<void>;
  /** In stt mode: parent tells hook when TTS starts/ends (for barge-in detection).
   *  In full mode: no-op — server drives speaking state via WS events. */
  setAiSpeaking: (speaking: boolean) => void;
}

// ── SAMPLE_RATE must match ElevenLabs output_format=pcm_22050 ───────────────
const SAMPLE_RATE     = 22050;
const SCHEDULE_AHEAD  = 0.08; // seconds — same as VoiceAssistant reference

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "audio/webm";
}

export function useLiveVoiceWS(opts: UseLiveVoiceWSOptions): UseLiveVoiceWSReturn {
  const mode = opts.mode ?? "full";

  const [state,   setState]   = useState<LiveState>("idle");
  const [interim, setInterim] = useState("");

  const stateRef         = useRef<LiveState>("idle");
  const wsRef            = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef     = useRef<MediaStream | null>(null);
  const keepAliveRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Web Audio API (full mode only) ───────────────────────────────────────
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const playbackTimeRef  = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const speakingDoneRef  = useRef(false); // got 'speaking_done' from server

  // ── Stable callback refs ─────────────────────────────────────────────────
  const onUserMsgRef      = useRef(opts.onUserMessage);
  const onAsstTokRef      = useRef(opts.onAssistantToken);
  const onSpkDoneRef      = useRef(opts.onSpeakingDone);
  const onFinalRef        = useRef(opts.onFinalTranscript);
  const onInterruptRef    = useRef(opts.onInterrupt);
  const onErrorRef        = useRef(opts.onError);

  useEffect(() => { onUserMsgRef.current   = opts.onUserMessage;    }, [opts.onUserMessage]);
  useEffect(() => { onAsstTokRef.current   = opts.onAssistantToken; }, [opts.onAssistantToken]);
  useEffect(() => { onSpkDoneRef.current   = opts.onSpeakingDone;   }, [opts.onSpeakingDone]);
  useEffect(() => { onFinalRef.current     = opts.onFinalTranscript;}, [opts.onFinalTranscript]);
  useEffect(() => { onInterruptRef.current = opts.onInterrupt;      }, [opts.onInterrupt]);
  useEffect(() => { onErrorRef.current     = opts.onError;          }, [opts.onError]);

  const setS = useCallback((s: LiveState) => {
    stateRef.current = s;
    setState(s);
    if (s === "listening" || s === "user-speaking") setInterim("");
  }, []);

  // ── Audio helpers (full mode) ─────────────────────────────────────────────

  // Stops all active AudioBufferSourceNodes immediately (barge-in).
  const stopAudio = useCallback(() => {
    activeSourcesRef.current.forEach(src => { try { src.stop(); } catch (_) {} });
    activeSourcesRef.current = [];
    playbackTimeRef.current  = 0;
    speakingDoneRef.current  = false;
  }, []);

  // Schedules a binary S16LE PCM chunk from ElevenLabs for gapless playback.
  // Converts Int16 → Float32 and schedules SCHEDULE_AHEAD seconds ahead of
  // the playback cursor, exactly like VoiceAssistant's playPCMChunk().
  const playPCMChunk = useCallback((ab: ArrayBuffer) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    // Cartesia pcm_f32le → already Float32, copy directly into Web Audio buffer.
    const f32 = new Float32Array(ab);
    const buf = ctx.createBuffer(1, f32.length, SAMPLE_RATE);
    buf.copyToChannel(f32, 0);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);

    const now     = ctx.currentTime;
    const startAt = Math.max(now + SCHEDULE_AHEAD, playbackTimeRef.current);
    src.start(startAt);
    playbackTimeRef.current = startAt + buf.duration;

    activeSourcesRef.current.push(src);

    src.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== src);
      // Once audio queue drains AND server already sent speaking_done → go back to listening.
      if (activeSourcesRef.current.length === 0 && speakingDoneRef.current) {
        speakingDoneRef.current = false;
        setS("listening");
        onSpkDoneRef.current?.();
      }
    };
  }, [setS]);

  // ── Teardown ─────────────────────────────────────────────────────────────
  const teardown = useCallback(() => {
    if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    try { mediaRecorderRef.current?.stop(); } catch (_) {}
    try { micStreamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    try { wsRef.current?.close(); } catch (_) {}
    mediaRecorderRef.current = null;
    micStreamRef.current     = null;
    wsRef.current            = null;
    stopAudio();
  }, [stopAudio]);

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (stateRef.current !== "idle") return;
    setS("arming");

    // ── AudioContext (full mode, created once after user gesture) ─────────
    if (mode === "full") {
      if (!audioCtxRef.current) {
        const ACtx = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext;
        audioCtxRef.current = new ACtx({ sampleRate: SAMPLE_RATE });
      }
      await audioCtxRef.current.resume().catch(() => {});
    }

    // Request mic before opening WS so we fail fast on permission denied.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch (err) {
      setS("idle");
      onErrorRef.current?.(err as Error);
      return;
    }
    micStreamRef.current = stream;

    const proto   = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsPath  = mode === "stt" ? "/api/live-voice-ws?mode=stt" : "/api/live-voice-ws";
    const ws      = new WebSocket(`${proto}//${window.location.host}${wsPath}`);
    ws.binaryType = "arraybuffer"; // receive PCM as ArrayBuffer (not Blob)
    wsRef.current = ws;

    ws.onopen = () => {
      // Don't start recording yet — wait for 'ready' (Deepgram connected).
      // Starting here would send audio before DG is open and drop the webm header.
    };

    ws.onmessage = (e) => {
      // ── Binary frame → PCM audio (full mode only) ────────────────────
      if (e.data instanceof ArrayBuffer) {
        if (mode === "full") playPCMChunk(e.data);
        return;
      }

      // ── JSON control messages ─────────────────────────────────────────
      let msg: { type: string; text?: string; message?: string };
      try { msg = JSON.parse(e.data as string); } catch (_) { return; }

      switch (msg.type) {
        // ── Common ──────────────────────────────────────────────────────
        case "ready": {
          // DG is connected — safe to start sending audio now.
          const mime = pickMime();
          const mr   = new MediaRecorder(stream, { mimeType: mime });
          mr.ondataavailable = (e) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
          };
          mr.start(100);
          mediaRecorderRef.current = mr;
          // Keep DG alive during AI speaking turns (no mic audio → DG times out).
          keepAliveRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "keep-alive" }));
          }, 8000);
          setS("listening");
          break;
        }

        case "interim": {
          const text = msg.text ?? "";
          setInterim(text);
          if (stateRef.current === "ai-speaking") {
            // Barge-in: user spoke while AI was playing audio.
            if (mode === "full") {
              stopAudio();
              // Tell server to abort LLM + TTS streams.
              if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "interrupt" }));
            }
            setS("user-speaking");
            onInterruptRef.current?.();
          } else if (stateRef.current === "listening") {
            setS("user-speaking");
          }
          break;
        }

        case "transcript":
          // Non-speech-final Deepgram segment; keep interim visible.
          setInterim(msg.text ?? "");
          break;

        // ── Full mode ────────────────────────────────────────────────────
        case "thinking":
          // User utterance confirmed; server starting LLM.
          setS("llm-thinking");
          onUserMsgRef.current?.(msg.text ?? "");
          break;

        case "speaking_start":
          setS("ai-speaking");
          break;

        case "text":
          // LLM token — stream into assistant bubble.
          onAsstTokRef.current?.(msg.text ?? "");
          break;

        case "tts_start":
        case "tts_end":
          // Internal sentence-level TTS events; no client action needed.
          break;

        case "speaking_done":
          // Server finished sending audio. If audio queue already drained → go to listening now.
          // Otherwise onended callback above will transition.
          speakingDoneRef.current = true;
          if (activeSourcesRef.current.length === 0) {
            speakingDoneRef.current = false;
            setS("listening");
            onSpkDoneRef.current?.();
          }
          break;

        case "interrupted":
          // Server acknowledged barge-in abort.
          stopAudio();
          setS("listening");
          break;

        // ── STT mode ─────────────────────────────────────────────────────
        case "final-transcript":
          setInterim("");
          setS("llm-thinking");
          onFinalRef.current?.(msg.text ?? "");
          break;

        case "error":
          onErrorRef.current?.(new Error(msg.message ?? "Live voice error"));
          break;
      }
    };

    ws.onerror = () => {
      onErrorRef.current?.(new Error("WebSocket connection error"));
    };

    ws.onclose = () => {
      if (stateRef.current !== "idle") {
        setS("idle");
        setInterim("");
      }
      if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }
    };
  }, [setS, mode, playPCMChunk, stopAudio]);

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    teardown();
    setS("idle");
    setInterim("");
  }, [teardown, setS]);

  // ── setAiSpeaking (stt mode only) ────────────────────────────────────────
  // Parent calls this when Bhavna TTS starts/ends. Mic is never paused —
  // browser AEC (echoCancellation: true) handles speaker bleed. DG interim
  // transcripts trigger barge-in naturally via the interim handler above.
  const setAiSpeaking = useCallback((speaking: boolean) => {
    if (mode === "full") return;
    if (speaking) {
      setS("ai-speaking");
    } else if (stateRef.current === "ai-speaking") {
      setS("listening");
    }
  }, [setS, mode]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      teardown();
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, [teardown]);

  return { state, interim, start, stop, setAiSpeaking };
}
