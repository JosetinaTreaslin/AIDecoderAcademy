"use client";

// Shared UI building blocks for the voice session panel.
// Used by VoiceAssistantPanel (classroom) and AidaAssistant (voice mode).

import { useRef, useEffect } from "react";
import { Radio } from "lucide-react";
import type { VoiceSessionState, VoiceMsg } from "./useVoiceSession";

const BTN_BG: Record<VoiceSessionState, string> = {
  idle:       "rgba(0,212,255,0.10)",
  connecting: "rgba(125,211,252,0.18)",
  listening:  "linear-gradient(135deg,#00D4FF,#0284C7)",
  thinking:   "linear-gradient(135deg,#7C3AED,#a78bfa)",
  speaking:   "linear-gradient(135deg,#10b981,#34d399)",
};

const BTN_GLOW: Record<VoiceSessionState, string> = {
  idle:       "none",
  connecting: "0 0 24px rgba(125,211,252,0.4)",
  listening:  "0 0 32px rgba(0,212,255,0.55),0 0 64px rgba(0,212,255,0.2)",
  thinking:   "0 0 28px rgba(167,139,250,0.5)",
  speaking:   "0 0 28px rgba(52,211,153,0.55)",
};

interface BodyProps {
  messages:   VoiceMsg[];
  streaming:  string;
  appState:   VoiceSessionState;
  emptyLabel: string;
}

export function VoiceSessionBody({ messages, streaming, appState, emptyLabel }: BodyProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5" style={{ scrollbarWidth: "none" }}>
      {messages.length === 0 && !streaming && (
        <div className="flex flex-col items-center justify-center h-full gap-3 pointer-events-none" style={{ opacity: 0.45 }}>
          <span style={{ fontSize: 30 }}>✦</span>
          <p className="text-xs text-white/50 text-center leading-relaxed" style={{ fontFamily: "'DM Sans',sans-serif" }}>
            {emptyLabel}
          </p>
        </div>
      )}

      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className="max-w-[82%] px-3 py-2 text-[12px] leading-relaxed"
            style={m.role === "user" ? {
              background:   "linear-gradient(135deg,rgba(0,212,255,0.45),rgba(125,211,252,0.28))",
              border:       "1px solid rgba(0,212,255,0.3)",
              color:        "#e8f4ff",
              borderRadius: "14px 14px 4px 14px",
            } : m.role === "error" ? {
              background:   "rgba(239,68,68,0.12)",
              border:       "1px solid rgba(239,68,68,0.28)",
              color:        "#fca5a5",
              borderRadius: "14px 14px 14px 4px",
            } : {
              background:   "rgba(255,255,255,0.05)",
              border:       "1px solid rgba(255,255,255,0.09)",
              color:        "rgba(232,244,255,0.88)",
              borderRadius: "14px 14px 14px 4px",
            }}
          >
            {m.text}
          </div>
        </div>
      ))}

      {streaming && (
        <div className="flex justify-start">
          <div
            className="max-w-[82%] px-3 py-2 text-[12px] leading-relaxed"
            style={{
              background:   "rgba(255,255,255,0.05)",
              border:       "1px solid rgba(0,212,255,0.18)",
              color:        "rgba(232,244,255,0.88)",
              borderRadius: "14px 14px 14px 4px",
            }}
          >
            {streaming}
            <span
              className="inline-block w-1 h-3 ml-0.5 rounded-sm animate-pulse"
              style={{ background: "rgba(0,212,255,0.7)", verticalAlign: "middle" }}
            />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

interface FooterProps {
  appState: VoiceSessionState;
  interim:  string;
  isActive: boolean;
  onToggle: () => void;
  onClear?: () => void;
}

export function VoiceSessionFooter({ appState, interim, isActive, onToggle, onClear }: FooterProps) {
  return (
    <div
      className="px-4 pt-3 pb-4 flex-shrink-0 flex flex-col items-center gap-2"
      style={{ borderTop: "1px solid rgba(0,212,255,0.12)" }}
    >
      {/* Interim transcript */}
      <div className="h-4 w-full text-center overflow-hidden">
        {interim && (
          <p className="text-[10px] italic truncate" style={{ color: "rgba(0,212,255,0.55)", fontFamily: "'DM Sans',sans-serif" }}>
            "{interim}"
          </p>
        )}
      </div>

      {/* Mic button */}
      <button
        onClick={onToggle}
        className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90"
        style={{
          background: BTN_BG[appState],
          border:     `2px solid ${isActive ? "rgba(0,212,255,0.6)" : "rgba(0,212,255,0.22)"}`,
          boxShadow:  BTN_GLOW[appState],
        }}
      >
        {isActive && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: "rgba(0,212,255,0.15)", animationDuration: appState === "listening" ? "1s" : "1.8s" }}
          />
        )}
        <Radio size={22} style={{ color: isActive ? "#fff" : "rgba(0,212,255,0.5)", position: "relative" }} />
      </button>

      <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.28)", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.1em" }}>
        {isActive ? "TAP TO STOP" : "TAP TO START"}
      </p>

      {onClear && (
        <button
          onClick={onClear}
          className="text-[9px] hover:text-white/45 transition-colors mt-0.5"
          style={{ color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.12em" }}
        >
          CLEAR
        </button>
      )}
    </div>
  );
}
