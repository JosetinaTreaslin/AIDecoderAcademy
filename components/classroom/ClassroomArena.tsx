"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useChat }       from "@/components/playground/useChat";
import { MessageBubble } from "@/components/playground/MessageBubble";
import type { Chapter, Profile, OutputType } from "@/types";

interface Props {
  chapter: Chapter;
  onBack:  () => void;
}

// Left toolbar tile hotspot positions (% of viewport)
const TILES = [
  { key:"notes",      label:"Notes",           active:true,  top:"11%" },
  { key:"flashcards", label:"Flashcards",       active:true,  top:"22%" },
  { key:"mindmap",    label:"Mind Map",         active:false, top:"33%" },
  { key:"comic",      label:"Comic Creations",  active:false, top:"44%" },
  { key:"explainer",  label:"Explainer Videos", active:false, top:"55%" },
  { key:"audio",      label:"Audio Overview",   active:false, top:"66%" },
  { key:"podcast",    label:"Audio Podcast",    active:false, top:"77%" },
] as const;

const TILE_PROMPTS: Record<string, (t: string) => string> = {
  notes:      (t) => `Generate comprehensive study notes for "${t}" — CBSE Class 10 Science. Use clear headings, bullet points, key definitions, important equations, and a quick-revision summary.`,
  flashcards: (t) => `Generate 10 flashcards for "${t}" — CBSE Class 10 Science. Format each as:\n**Q:** [question]\n**A:** [answer]\n\nCover the most important definitions, reactions, and concepts for board exams.`,
};

const ACCENT     = "#2563eb";
const ACCENT_GLO = "rgba(37,99,235,0.35)";

export function ClassroomArena({ chapter, onBack }: Props) {
  const [profile,     setProfile]     = useState<Profile | null>(null);
  const [input,       setInput]       = useState("");
  const [activeHint,  setActiveHint]  = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef     = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : { profile: null })
      .then(({ profile: p }) => setProfile(p))
      .catch(() => {});
  }, []);

  const { messages, isStreaming, sendMessage } = useChat(profile, "free");

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || !profile || isStreaming) return;
    setInput("");
    if (taRef.current) { taRef.current.style.height = "auto"; }
    await sendMessage(t, "text");
  }, [profile, isStreaming, sendMessage]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const handleTileClick = useCallback((key: string) => {
    if (!profile || isStreaming) return;
    const buildPrompt = TILE_PROMPTS[key];
    if (!buildPrompt) return;
    setActiveHint(key);
    setTimeout(() => setActiveHint(null), 900);
    sendMessage(buildPrompt(chapter.chapter_title), "text");
  }, [profile, isStreaming, sendMessage, chapter.chapter_title]);

  const canSend = input.trim().length > 0 && !isStreaming && !!profile;

  if (!profile) {
    return (
      <div className="relative flex items-center justify-center" style={{ height:"100dvh" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/classroom/classroom/background.png" alt="" aria-hidden
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"fill" }} />
        <div className="relative z-10 flex items-center gap-2" style={{ color:"rgba(255,255,255,0.55)" }}>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ height:"100dvh" }}>

      {/* Background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/classroom/classroom/background.png" alt="" aria-hidden draggable={false}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"fill", zIndex:0 }} />

      {/* Back */}
      <button onClick={onBack}
        className="absolute flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl hover:opacity-80 transition-opacity"
        style={{ top:12, left:14, zIndex:30,
          background:"rgba(0,0,0,0.5)", backdropFilter:"blur(10px)",
          color:"rgba(255,255,255,0.8)", border:"1px solid rgba(255,255,255,0.15)" }}>
        <ChevronLeft className="w-3.5 h-3.5" /> Back
      </button>

      {/* Chapter label */}
      <div className="absolute px-3 py-1 rounded-full"
        style={{ top:12, left:"50%", transform:"translateX(-50%)", zIndex:25,
          background:"rgba(0,0,0,0.45)", backdropFilter:"blur(10px)",
          border:"1px solid rgba(255,255,255,0.12)" }}>
        <p className="text-[11px] font-mono whitespace-nowrap" style={{ color:"rgba(255,255,255,0.65)" }}>
          {chapter.chapter_title}
        </p>
      </div>

      {/* Left toolbar hotspots */}
      {TILES.map(tile => (
        <div key={tile.key} className="absolute"
          style={{ top:tile.top, left:"0.5%", width:"11.5%", height:"9%", zIndex:20 }}>
          {tile.active && (
            <motion.button
              onClick={() => handleTileClick(tile.key)}
              className="w-full h-full rounded-xl relative"
              style={{ cursor:"pointer", background:"transparent" }}
              whileHover={{ background:"rgba(255,255,255,0.07)" }}
              transition={{ duration:0.15 }}>
              <AnimatePresence>
                {activeHint === tile.key && (
                  <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    className="absolute inset-0 rounded-xl"
                    style={{ background:"rgba(255,255,255,0.15)", border:"1.5px solid rgba(255,255,255,0.4)" }} />
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </div>
      ))}

      {/* ── Chat overlay on whiteboard ──────────────────────────────────────── */}
      {/* Positioned over the white rectangle in the background image         */}
      <div className="absolute flex flex-col overflow-hidden"
        style={{ left:"24.5%", top:"13%", width:"51%", height:"79%", zIndex:15,
          borderRadius:14,
          background:"rgba(8,8,20,0.92)",
          backdropFilter:"blur(12px)" }}>

        {/* Message list */}
        <div className="flex-1 min-h-0 overflow-y-auto"
          style={{ padding:"12px 14px 6px", display:"flex", flexDirection:"column",
            gap:8, scrollbarWidth:"none" }}>

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40 pointer-events-none">
              <span style={{ fontSize:28 }}>✏️</span>
              <p className="text-xs text-center font-medium" style={{ color:ACCENT, lineHeight:1.6 }}>
                Click <strong>Notes</strong> or <strong>Flashcards</strong> on the left,<br/>
                or type a question below
              </p>
            </div>
          )}

          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              avatarEmoji={profile.avatar_emoji}
              isStreaming={isStreaming && msg === messages[messages.length - 1]}
              arenaAccent={ACCENT}
              arenaAccentGlow={ACCENT_GLO}
              arenaId={1}
            />
          ))}

          {/* Streaming dots */}
          {isStreaming && (
            <div style={{ display:"flex", gap:4, padding:"2px 0 2px 28px" }}>
              {[0,1,2].map(i => (
                <span key={i} className="dot"
                  style={{ width:6, height:6, borderRadius:"50%", display:"inline-block",
                    background:ACCENT, opacity:0.7, animationDelay:`${i*0.15}s` }} />
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Divider */}
        <div style={{ height:1, background:"rgba(255,255,255,0.07)", flexShrink:0 }} />

        {/* Input bar */}
        <div style={{ flexShrink:0, padding:"10px 12px",
          display:"flex", alignItems:"flex-end", gap:10 }}>

          <textarea
            ref={taRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              const t = e.target;
              t.style.height = "auto";
              t.style.height = Math.min(t.scrollHeight, 80) + "px";
            }}
            onKeyDown={handleKey}
            placeholder="Ask anything about this chapter…"
            rows={1}
            disabled={!profile}
            style={{ flex:1, resize:"none", border:"none", outline:"none",
              background:"transparent", fontSize:13, fontWeight:500,
              color:"rgba(255,255,255,0.9)", fontFamily:"inherit",
              lineHeight:1.5, overflowY:"hidden",
              caretColor:ACCENT, userSelect:"text" }}
          />

          <button onClick={() => send(input)} disabled={!canSend}
            style={{ width:34, height:34, borderRadius:"50%", flexShrink:0,
              background: canSend ? `rgba(37,99,235,0.9)` : "rgba(255,255,255,0.1)",
              border:"none", cursor: canSend ? "pointer" : "not-allowed",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all 0.2s",
              boxShadow: canSend ? `0 0 16px rgba(37,99,235,0.6)` : "none" }}>
            <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
              <path d="M2 9h14M9 2l7 7-7 7"
                stroke={canSend ? "#fff" : "rgba(255,255,255,0.25)"}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

    </div>
  );
}
