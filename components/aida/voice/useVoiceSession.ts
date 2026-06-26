"use client";

// Shared WebSocket voice session hook.
// Used by VoiceAssistantPanel (classroom) and AidaAssistant (voice mode).
// Connects to /voice-assistant-ws — server runs: Deepgram → Claude Haiku → Cartesia.

import { useState, useRef, useCallback, useEffect } from "react";

export type VoiceSessionState = "idle" | "connecting" | "listening" | "thinking" | "speaking";

export interface VoiceMsg { role: "user" | "assistant" | "error"; text: string; }

const SAMPLE_RATE   = 22050;
const SCHEDULE_AHEAD = 0.08;

export interface VoiceSessionContext {
  chapter?: string;
  subject?: string;
}

export function useVoiceSession(sessionCtx?: VoiceSessionContext) {
  const [appState,  setAppStateUI] = useState<VoiceSessionState>("idle");
  const [messages,  setMessages]   = useState<VoiceMsg[]>([]);
  const [interim,   setInterim]    = useState("");
  const [streaming, setStreaming]  = useState("");

  const sessionCtxRef = useRef<VoiceSessionContext | undefined>(sessionCtx);
  useEffect(() => { sessionCtxRef.current = sessionCtx; }, [sessionCtx]);

  const stateRef      = useRef<VoiceSessionState>("idle");
  const wsRef         = useRef<WebSocket | null>(null);
  const mrRef         = useRef<MediaRecorder | null>(null);
  const micRef        = useRef<MediaStream | null>(null);
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const playbackRef   = useRef(0);
  const sourcesRef    = useRef<AudioBufferSourceNode[]>([]);
  const onDrainRef    = useRef<(() => void) | null>(null);
  const streamingRef  = useRef("");

  function setS(s: VoiceSessionState) { stateRef.current = s; setAppStateUI(s); }

  function getCtx(): AudioContext {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      const AC = (window.AudioContext ?? (window as any).webkitAudioContext) as typeof AudioContext;
      audioCtxRef.current = new AC({ sampleRate: SAMPLE_RATE });
    }
    return audioCtxRef.current;
  }

  function playChunk(ab: ArrayBuffer) {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const f32 = new Float32Array(ab);
    const buf = ctx.createBuffer(1, f32.length, SAMPLE_RATE);
    buf.copyToChannel(f32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime + SCHEDULE_AHEAD, playbackRef.current);
    src.start(startAt);
    playbackRef.current = startAt + buf.duration;
    sourcesRef.current.push(src);
    src.onended = () => {
      sourcesRef.current = sourcesRef.current.filter(s => s !== src);
      if (sourcesRef.current.length === 0 && onDrainRef.current) {
        onDrainRef.current();
        onDrainRef.current = null;
      }
    };
  }

  function haltAudio() {
    sourcesRef.current.forEach(s => { try { s.stop(); } catch (_) {} });
    sourcesRef.current  = [];
    playbackRef.current = 0;
    onDrainRef.current  = null;
  }

  const stopSession = useCallback(() => {
    try { mrRef.current?.stop(); }  catch (_) {}
    micRef.current?.getTracks().forEach(t => t.stop());
    try { wsRef.current?.close(); } catch (_) {}
    haltAudio();
    mrRef.current = null;
    micRef.current = null;
    wsRef.current  = null;
    setInterim("");
    setS("idle");
  }, []);

  // Stable handler ref — avoids stale-closure bugs on fast state transitions.
  const handleMsg = useRef<(e: MessageEvent) => void>(() => {});
  handleMsg.current = (e: MessageEvent) => {
    if (e.data instanceof ArrayBuffer) { playChunk(e.data); return; }

    let msg: { type: string; text?: string; final?: boolean };
    try { msg = JSON.parse(e.data as string); } catch { return; }

    switch (msg.type) {
      case "ready":
        setS("listening");
        if (micRef.current) {
          const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus" : "audio/webm";
          const mr = new MediaRecorder(micRef.current, { mimeType: mime });
          mr.ondataavailable = ev => {
            if (ev.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN)
              wsRef.current.send(ev.data);
          };
          mr.start(100);
          mrRef.current = mr;
        }
        break;

      case "interim":
        setInterim(msg.text ?? "");
        if (stateRef.current === "speaking") {
          haltAudio();
          wsRef.current?.send(JSON.stringify({ type: "interrupt" }));
          setS("listening");
        }
        break;

      case "transcript":
        setInterim("");
        if (msg.final && msg.text?.trim())
          setMessages(p => [...p, { role: "user", text: msg.text! }]);
        break;

      case "thinking":
        setS("thinking");
        streamingRef.current = "";
        setStreaming("");
        break;

      case "speaking_start":
        setS("speaking");
        break;

      case "text":
        streamingRef.current += msg.text ?? "";
        setStreaming(streamingRef.current);
        break;

      case "tts_start":
      case "tts_end":
        break;

      case "speaking_done": {
        const done = streamingRef.current;
        if (done) {
          setMessages(p => [...p, { role: "assistant", text: done }]);
          streamingRef.current = "";
          setStreaming("");
        }
        const goListen = () => { if (stateRef.current !== "idle") setS("listening"); };
        if (sourcesRef.current.length === 0) goListen();
        else onDrainRef.current = goListen;
        break;
      }

      case "interrupted":
        haltAudio();
        setS("listening");
        break;

      case "error":
        setMessages(p => [...p, { role: "error", text: msg.text ?? "Error" }]);
        if (stateRef.current !== "idle") setS("listening");
        break;
    }
  };

  const startSession = useCallback(async () => {
    setS("connecting");
    const ctx = getCtx();
    await ctx.resume().catch(() => {});

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setS("idle");
      setMessages(p => [...p, { role: "error", text: "Microphone access required." }]);
      return;
    }
    micRef.current = stream;

    const proto  = window.location.protocol === "https:" ? "wss:" : "ws:";
    const params = new URLSearchParams();
    if (sessionCtxRef.current?.chapter) params.set("chapter", sessionCtxRef.current.chapter);
    if (sessionCtxRef.current?.subject) params.set("subject", sessionCtxRef.current.subject);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const ws = new WebSocket(`${proto}//${window.location.host}/voice-assistant-ws${qs}`);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onmessage = e => handleMsg.current(e);
    ws.onerror   = () => stopSession();
    ws.onclose   = () => { if (stateRef.current !== "idle") stopSession(); };
  }, [stopSession]);

  const toggle = useCallback(async () => {
    if (stateRef.current === "idle") await startSession();
    else stopSession();
  }, [startSession, stopSession]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setStreaming(""); streamingRef.current = "";
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: "clear" }));
  }, []);

  useEffect(() => () => stopSession(), [stopSession]);

  return {
    appState,
    messages,
    interim,
    streaming,
    toggle,
    stopSession,
    clearChat,
    isActive: appState !== "idle",
  };
}
