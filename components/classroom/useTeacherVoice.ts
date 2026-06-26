"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveVoiceWS } from "@/components/aida/voice/useLiveVoiceWS";
import type { LiveState } from "@/components/aida/voice/useLiveVoiceWS";

export type VoiceState   = "idle" | "listening" | "processing" | "speaking";
export type VoiceSubMode = "tap" | "live";

const MUTE_KEY = "bhavna:voiceMute";

// ── Module-level TTS playback state ─────────────────────────────────────────
// Playback state lives at module scope so any remount of the hook reliably
// halts audio from a previous instance. Uses Web Audio API for gapless PCM
// playback (Cartesia pcm_f32le at 22050 Hz — same pipeline as AIDA live voice).
const TTS_SAMPLE_RATE = 22050;
let ttsGen = 0;
let activeTtsAbort: AbortController | null = null;
let audioCtx: AudioContext | null = null;
let activeSources: AudioBufferSourceNode[] = [];
let playbackTime = 0;

function getOrCreateCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    const ACtx = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext;
    audioCtx = new ACtx({ sampleRate: TTS_SAMPLE_RATE });
  }
  return audioCtx;
}

/** Hard-stop all teacher TTS — active sources and the fetch. */
function haltTeacherTts() {
  ttsGen++;
  if (activeTtsAbort) { try { activeTtsAbort.abort(); } catch { /* noop */ } activeTtsAbort = null; }
  activeSources.forEach(s => { try { s.stop(); } catch { /* noop */ } });
  activeSources = [];
  playbackTime = 0;
}

interface Options {
  /** Called with a final transcript (tap or live). Caller sends it to chat. */
  onTranscript: (text: string) => void;
  /** Called when the user barges in during live mode — caller aborts streams. */
  onInterrupt?: () => void;
}

export interface UseTeacherVoiceReturn {
  voiceState:   VoiceState;
  subMode:      VoiceSubMode;
  setSubMode:   (s: VoiceSubMode) => void;
  voiceOK:      boolean;
  voiceError:   string | null;
  muted:        boolean;
  toggleMute:   () => void;
  micStream:    MediaStream | null;
  liveState:    LiveState;
  toggleTap:    () => void;
  toggleLive:   () => void;
  speak:        (text: string) => Promise<void>;
  /** Char count to reveal for the line being spoken (word-boundary, audio-synced).
   *  Returns -1 when no word timings are available. */
  spokenChars:  () => number;
  cleanup:      () => void;
}

export function useTeacherVoice(opts: Options): UseTeacherVoiceReturn {
  const [voiceState, setVoiceStateRaw] = useState<VoiceState>("idle");
  const [subMode,    setSubMode]       = useState<VoiceSubMode>("tap");
  const [voiceOK,    setVoiceOK]       = useState(false);
  const [voiceError, setVoiceError]    = useState<string | null>(null);
  const [muted,      setMuted]         = useState(false);
  const [micStream,  setMicStream]     = useState<MediaStream | null>(null);

  const voiceStateRef = useRef<VoiceState>("idle");
  const subModeRef    = useRef<VoiceSubMode>("tap");
  const mutedRef      = useRef(false);
  const mrRef         = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const micRef        = useRef<MediaStream | null>(null);
  const cancelledRef  = useRef(false);
  const sttAbortRef   = useRef<AbortController | null>(null);
  const liveSetSpeakingRef = useRef<(s: boolean) => void>(() => {});
  const onTranscriptRef = useRef(opts.onTranscript);
  const onInterruptRef  = useRef(opts.onInterrupt);
  useEffect(() => { onTranscriptRef.current = opts.onTranscript; }, [opts.onTranscript]);
  useEffect(() => { onInterruptRef.current  = opts.onInterrupt;  }, [opts.onInterrupt]);

  function setVoiceState(s: VoiceState) { voiceStateRef.current = s; setVoiceStateRaw(s); }
  useEffect(() => { subModeRef.current = subMode; }, [subMode]);

  // ── Capability detection + mute persistence ──────────────────────────────
  useEffect(() => {
    setVoiceOK(typeof window !== "undefined"
      && typeof window.MediaRecorder !== "undefined"
      && typeof navigator?.mediaDevices?.getUserMedia === "function");
    if (typeof window !== "undefined" && localStorage.getItem(MUTE_KEY) === "on") {
      setMuted(true); mutedRef.current = true;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(v => {
      const next = !v;
      mutedRef.current = next;
      if (typeof window !== "undefined") localStorage.setItem(MUTE_KEY, next ? "on" : "off");
      if (next) {
        // Muting now → kill any in-flight playback immediately.
        haltTeacherTts();
        if (voiceStateRef.current === "speaking") setVoiceState("idle");
      }
      return next;
    });
  }, []);

  const flashError = useCallback((m: string) => {
    setVoiceError(m);
    setTimeout(() => setVoiceError(null), 3500);
  }, []);

  function stopMic() {
    micRef.current?.getTracks().forEach(t => t.stop());
    micRef.current = null;
    setMicStream(null);
  }

  // ── TTS: Cartesia pcm_f32le via Web Audio API (gapless, low-latency) ────
  const speak = useCallback(async (text: string) => {
    if (mutedRef.current || !text.trim()) return;
    haltTeacherTts();
    const myGen = ttsGen; // haltTeacherTts already bumped it
    activeTtsAbort = new AbortController();
    const mySignal = activeTtsAbort.signal;

    try {
      setVoiceState("speaking");
      const ctx = getOrCreateCtx();
      await ctx.resume();

      const res = await fetch("/api/aida/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, role: "classroom" }),
        signal:  mySignal,
      });
      if (ttsGen !== myGen) return;
      if (!res.ok || !res.body) throw new Error("TTS failed");

      // Signal ai-speaking so DG interim can trigger barge-in.
      if (subModeRef.current === "live") liveSetSpeakingRef.current(true);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let streamDone = false;

      function scheduleChunk(ab: ArrayBuffer) {
        if (ttsGen !== myGen) return;
        const f32     = new Float32Array(ab);
        const audioBuf = ctx.createBuffer(1, f32.length, TTS_SAMPLE_RATE);
        audioBuf.copyToChannel(f32, 0);
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(ctx.destination);
        const startAt = Math.max(ctx.currentTime + 0.08, playbackTime);
        src.start(startAt);
        playbackTime = startAt + audioBuf.duration;
        activeSources.push(src);
        src.onended = () => {
          activeSources = activeSources.filter(s => s !== src);
          if (activeSources.length === 0 && streamDone && ttsGen === myGen) {
            setVoiceState("idle");
            if (subModeRef.current === "live") liveSetSpeakingRef.current(false);
          }
        };
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (ttsGen !== myGen) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "chunk" && evt.data) {
              const bin   = atob(evt.data);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              scheduleChunk(bytes.buffer);
            }
            if (evt.type === "done") streamDone = true;
          } catch { /* malformed SSE line */ }
        }
      }

      streamDone = true;
      if (ttsGen !== myGen) return;
      if (activeSources.length === 0) {
        setVoiceState("idle");
        if (subModeRef.current === "live") liveSetSpeakingRef.current(false);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      if (ttsGen === myGen) {
        flashError("Voice playback failed.");
        if (voiceStateRef.current === "speaking") setVoiceState("idle");
        if (subModeRef.current === "live") liveSetSpeakingRef.current(false);
      }
    }
  }, [flashError]);

  // ── Tap STT ──────────────────────────────────────────────────────────────
  function pickMime(): string {
    const c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    for (const m of c) if (MediaRecorder.isTypeSupported(m)) return m;
    return "audio/webm";
  }

  const startTap = useCallback(async () => {
    cancelledRef.current = false;
    chunksRef.current = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
      });
    } catch {
      flashError("Mic permission denied or unavailable.");
      setVoiceState("idle");
      return;
    }
    if (voiceStateRef.current !== "listening") { stream.getTracks().forEach(t => t.stop()); return; }
    micRef.current = stream;
    setMicStream(stream);
    const mime = pickMime();
    let mr: MediaRecorder;
    try { mr = new MediaRecorder(stream, { mimeType: mime }); }
    catch { stopMic(); setVoiceState("idle"); flashError("Recorder unavailable."); return; }

    mr.ondataavailable = e => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const cancelled = cancelledRef.current;
      cancelledRef.current = false;
      const chunks = chunksRef.current;
      chunksRef.current = [];
      stopMic();
      if (cancelled) return;
      const blob = new Blob(chunks, { type: mime });
      if (blob.size === 0) { flashError("No audio captured — try again."); setVoiceState("idle"); return; }
      const ctrl = new AbortController();
      sttAbortRef.current = ctrl;
      try {
        const res = await fetch("/api/aida/stt", {
          method: "POST", headers: { "Content-Type": mime }, body: blob, signal: ctrl.signal,
        });
        if (sttAbortRef.current === ctrl) sttAbortRef.current = null;
        if (!res.ok) { flashError("Voice recognition failed — try again."); setVoiceState("idle"); return; }
        const { transcript } = await res.json();
        const t = (transcript ?? "").trim();
        if (t) { setVoiceState("idle"); onTranscriptRef.current(t); }
        else { flashError("Didn't catch that — try again."); setVoiceState("idle"); }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        flashError("Voice recognition failed — try again.");
        setVoiceState("idle");
      }
    };
    mrRef.current = mr;
    mr.start(100);
  }, [flashError]);

  // ── Live call (reuses the persona-agnostic AIDA live engine) ─────────────
  const live = useLiveVoiceWS({
    // STT-only: server does Deepgram; Bhavna classroom handles LLM + TTS client-side.
    mode: "stt",
    onFinalTranscript: t => onTranscriptRef.current(t),
    onInterrupt: () => {
      haltTeacherTts();
      if (voiceStateRef.current === "speaking") setVoiceState("idle");
      onInterruptRef.current?.();
    },
    onError: err => flashError(err.message || "Live voice error."),
  });
  liveSetSpeakingRef.current = live.setAiSpeaking;

  // ── Teardown — defined after `live` because it calls live.stop() ─────────
  const cleanup = useCallback(() => {
    if (mrRef.current && mrRef.current.state !== "inactive") {
      cancelledRef.current = true;
      try { mrRef.current.stop(); } catch { /* noop */ }
    }
    mrRef.current = null;
    chunksRef.current = [];
    stopMic();
    sttAbortRef.current?.abort(); sttAbortRef.current = null;
    haltTeacherTts();
    void live.stop();
    setVoiceState("idle");
  }, [live]);

  const toggleTap = useCallback(() => {
    if (voiceStateRef.current === "idle") { setVoiceState("listening"); startTap(); }
    else if (voiceStateRef.current === "listening") {
      setVoiceState("processing");
      cancelledRef.current = false;
      if (mrRef.current && mrRef.current.state !== "inactive") mrRef.current.stop();
      else setVoiceState("idle");
    } else {
      cleanup();
    }
  }, [startTap, cleanup]);

  const toggleLive = useCallback(() => {
    if (live.state === "idle") void live.start();
    else void live.stop();
  }, [live]);

  // Tear down on unmount ONLY. `cleanup`'s identity changes every render (it
  // depends on `live`, whose return object is a fresh literal each render), so
  // depending on it directly would re-run this effect every render and fire
  // the teardown constantly — instantly killing a just-started recording.
  // Ref indirection keeps the deps empty while still calling the latest cleanup.
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;
  useEffect(() => () => cleanupRef.current(), []);

  return {
    voiceState, subMode, setSubMode, voiceOK, voiceError, muted, toggleMute,
    micStream, liveState: live.state, toggleTap, toggleLive, speak,
    spokenChars: () => -1, cleanup,
  };
}
