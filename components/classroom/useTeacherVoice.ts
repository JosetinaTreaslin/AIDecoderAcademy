"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLiveVoice } from "@/components/aida/voice/useLiveVoice";
import type { LiveState } from "@/components/aida/voice/LiveVoiceSession";

export type VoiceState   = "idle" | "listening" | "processing" | "speaking";
export type VoiceSubMode = "tap" | "live";

const MUTE_KEY = "bhavna:voiceMute";

// ── Module-level TTS playback state ─────────────────────────────────────────
// Only one teacher ever speaks at a time, so playback state lives at module
// scope — NOT inside the hook. This guarantees that ANY cleanup (even from a
// freshly remounted hook instance — HMR, or TeacherCharacter remounting as the
// classroom switches views) reliably halts audio an earlier instance started.
// A per-instance ref could only ever see its own audio; an orphaned instance's
// playback would run on forever.
let ttsGen = 0;
let activeAudio: HTMLAudioElement | null = null;
let activeQueue: { audio: HTMLAudioElement; url: string }[] = [];
let activeTtsAbort: AbortController | null = null;
// Word timings for the line currently being spoken (karaoke reveal).
let activeWords: { text: string; start: number; end: number }[] = [];
let activeDone = false;

/** Hard-stop all teacher TTS — current chunk, queued chunks, and the fetch. */
function haltTeacherTts() {
  ttsGen++;
  if (activeTtsAbort) { try { activeTtsAbort.abort(); } catch { /* noop */ } activeTtsAbort = null; }
  if (activeAudio) { try { activeAudio.pause(); } catch { /* noop */ } activeAudio = null; }
  for (const { audio, url } of activeQueue) {
    try { audio.pause(); } catch { /* noop */ }
    URL.revokeObjectURL(url);
  }
  activeQueue = [];
  activeWords = [];
  activeDone = false;
}

/** Char count to reveal, snapped to the last word whose audio timestamp has
 *  passed. Returns -1 when there are no word timings (caller shows full text).
 *  Reveals nothing until currentTime > 0 so text never leads the voice. */
function teacherSpokenChars(): number {
  if (activeWords.length === 0) return -1;
  const fullLen = activeWords.map(w => w.text).join(" ").length;
  if (activeDone) return fullLen;
  if (!activeAudio) return 0;
  const t = activeAudio.currentTime;
  if (t <= 0) return 0;
  let active = -1;
  for (let i = 0; i < activeWords.length; i++) {
    if (activeWords[i].start <= t) active = i; else break;
  }
  if (active < 0) return 0;
  let n = active; // spaces between revealed words
  for (let i = 0; i <= active; i++) n += activeWords[i].text.length;
  return n;
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

  // ── TTS: chunked-SSE playback (Bhavna voice via role "classroom") ────────
  const speak = useCallback(async (text: string) => {
    if (mutedRef.current || !text.trim()) return;
    haltTeacherTts();                       // stop anything already playing
    const myGen = ttsGen;                   // haltTeacherTts already bumped it
    activeTtsAbort = new AbortController();
    const mySignal = activeTtsAbort.signal;

    try {
      setVoiceState("speaking");
      // tts-timed returns the whole line's audio + per-word timings in one JSON
      // response — enables karaoke reveal (text tracks the voice, never leads).
      const res = await fetch("/api/aida/tts-timed", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, role: "classroom" }),
        signal:  mySignal,
      });
      if (ttsGen !== myGen) return;
      if (!res.ok) throw new Error("TTS failed");
      const data = await res.json() as {
        audioBase64?: string;
        words?: { text: string; start: number; end: number }[];
      };
      if (ttsGen !== myGen) return;
      if (!data.audioBase64) throw new Error("TTS empty");

      activeWords = data.words ?? [];
      activeDone = false;

      const bin = atob(data.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      activeAudio = audio;
      if (subModeRef.current === "live") liveSetSpeakingRef.current(true);

      let advanced = false;
      const advance = () => {
        if (advanced) return; advanced = true;
        activeDone = true; // keeps reveal at full text after playback ends
        URL.revokeObjectURL(url);
        if (activeAudio === audio) activeAudio = null;
        if (ttsGen === myGen && voiceStateRef.current === "speaking") {
          setVoiceState("idle");
          if (subModeRef.current === "live") liveSetSpeakingRef.current(false);
        }
      };
      audio.onended = advance;
      audio.onerror = advance;
      audio.play().catch(advance);
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
  const live = useLiveVoice({
    onFinalTranscript: t => onTranscriptRef.current(t),
    onInterrupt: () => {
      haltTeacherTts();
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
    spokenChars: teacherSpokenChars, cleanup,
  };
}
