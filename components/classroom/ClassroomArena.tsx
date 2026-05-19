"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useChat }         from "@/components/playground/useChat";
import { CreationsRoom }   from "@/components/playground/CreationsRoom";
import { SaveCreationModal } from "@/components/playground/SaveCreationModal";
import type { Chapter, Profile, OutputType } from "@/types";

interface Props {
  chapter: Chapter;
  onBack:  () => void;
}

// ── Left toolbar tiles — hotspot positions over the background image ──────────
// Only Notes and Flashcards are active; others are inert.
const TILES = [
  { key:"notes",      label:"Notes",           active:true,  top:"11%" },
  { key:"flashcards", label:"Flashcards",       active:true,  top:"22%" },
  { key:"mindmap",    label:"Mind Map",         active:false, top:"33%" },
  { key:"comic",      label:"Comic Creations",  active:false, top:"44%" },
  { key:"explainer",  label:"Explainer Videos", active:false, top:"55%" },
  { key:"audio",      label:"Audio Overview",   active:false, top:"66%" },
  { key:"podcast",    label:"Audio Podcast",    active:false, top:"77%" },
] as const;

// Pre-built prompts injected when a tile is clicked
const TILE_PROMPTS: Record<string, (title: string) => string> = {
  notes:      (t) => `Generate comprehensive study notes for "${t}" — CBSE Class 10 Science. Structure them with headings for each major concept, important definitions, key chemical equations, and a quick-revision summary at the end.`,
  flashcards: (t) => `Generate 10 flashcards for "${t}" — CBSE Class 10 Science. Format each as:\n**Q:** [question]\n**A:** [answer]\n\nCover the most important definitions, reactions, and concepts a student needs to remember for exams.`,
};

// ── Main component ────────────────────────────────────────────────────────────
export function ClassroomArena({ chapter, onBack }: Props) {
  const [profile,      setProfile]      = useState<Profile | null>(null);
  const [saveOpen,     setSaveOpen]     = useState(false);
  const [saveOutType,  setSaveOutType]  = useState<OutputType>("text");
  const [saveContent,  setSaveContent]  = useState("");
  const [activeHint,   setActiveHint]   = useState<string | null>(null);

  // Fetch profile once
  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : { profile: null })
      .then(({ profile: p }) => setProfile(p))
      .catch(() => {});
  }, []);

  const {
    messages, isStreaming, sessionId,
    sendMessage, sendImage, sendAudio, sendSlides,
  } = useChat(profile, "free");

  // ── Send handler — only allow text output in classroom ─────────────────────
  const handleSend = useCallback(async (text: string, outType: OutputType) => {
    if (!profile || isStreaming) return;
    // Classroom is text-only for now
    await sendMessage(text, "text");
  }, [profile, isStreaming, sendMessage]);

  // ── Tile click — inject pre-built prompt ────────────────────────────────────
  const handleTileClick = useCallback((tileKey: string) => {
    if (!profile || isStreaming) return;
    const buildPrompt = TILE_PROMPTS[tileKey];
    if (!buildPrompt) return;
    const prompt = buildPrompt(chapter.chapter_title);
    setActiveHint(tileKey);
    setTimeout(() => setActiveHint(null), 1200);
    sendMessage(prompt, "text");
  }, [profile, isStreaming, sendMessage, chapter.chapter_title]);

  // ── Save handler ────────────────────────────────────────────────────────────
  // CreationsRoom calls onSave(content, outputType)
  const handleOpenSave = useCallback((content: string, outType: OutputType) => {
    setSaveOutType(outType);
    setSaveContent(content);
    setSaveOpen(true);
  }, []);

  if (!profile) {
    return (
      <div className="relative overflow-hidden flex items-center justify-center" style={{ height:"100dvh" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/classroom/classroom/background.png" alt="" aria-hidden
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"fill" }} />
        <div className="relative z-10 flex items-center gap-2" style={{ color:"rgba(255,255,255,0.6)" }}>
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading classroom…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" style={{ height:"100dvh" }}>

      {/* ── Background image ──────────────────────────────────────────────── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/classroom/classroom/background.png"
        alt="" aria-hidden draggable={false}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%",
          objectFit:"fill", zIndex:0 }}
      />

      {/* ── Back button ────────────────────────────────────────────────────── */}
      <button
        onClick={onBack}
        className="absolute flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all hover:opacity-80"
        style={{ top:12, left:14, zIndex:30,
          background:"rgba(0,0,0,0.45)", backdropFilter:"blur(10px)",
          color:"rgba(255,255,255,0.85)", border:"1px solid rgba(255,255,255,0.15)" }}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Back
      </button>

      {/* ── Chapter label ───────────────────────────────────────────────────── */}
      <div className="absolute px-3 py-1 rounded-full"
        style={{ top:12, left:"50%", transform:"translateX(-50%)", zIndex:25,
          background:"rgba(0,0,0,0.4)", backdropFilter:"blur(10px)",
          border:"1px solid rgba(255,255,255,0.15)" }}>
        <p className="text-[11px] font-mono whitespace-nowrap" style={{ color:"rgba(255,255,255,0.7)" }}>
          {chapter.chapter_title}
        </p>
      </div>

      {/* ── Left toolbar hotspot zones ──────────────────────────────────────── */}
      {TILES.map(tile => (
        <div key={tile.key} className="absolute"
          style={{ top:tile.top, left:"0.5%", width:"11.5%", height:"9%", zIndex:20 }}>
          {tile.active && (
            <motion.button
              onClick={() => handleTileClick(tile.key)}
              className="w-full h-full rounded-xl relative"
              style={{ cursor:"pointer", background:"transparent" }}
              whileHover={{ background:"rgba(255,255,255,0.08)" }}
              transition={{ duration:0.15 }}
            >
              {/* Active hint flash */}
              <AnimatePresence>
                {activeHint === tile.key && (
                  <motion.div
                    initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                    className="absolute inset-0 rounded-xl"
                    style={{ background:"rgba(255,255,255,0.2)", border:"1.5px solid rgba(255,255,255,0.5)" }}
                  />
                )}
              </AnimatePresence>
            </motion.button>
          )}
        </div>
      ))}

      {/* ── CreationsRoom overlaid on the whiteboard ────────────────────────── */}
      {/* Whiteboard bounds from background image: left≈24%, top≈12%, w≈52%, h≈80% */}
      <div
        className="absolute overflow-hidden"
        style={{ left:"24%", top:"12%", width:"52%", height:"80%",
          zIndex:15, borderRadius:16 }}
      >
        <CreationsRoom
          profile={profile}
          sessionId={sessionId}
          messages={messages}
          isStreaming={isStreaming}
          onSend={handleSend}
          onNewChat={() => {/* keep session */}}
          onSave={handleOpenSave}
          arenaId={1}
          arenaAccent="#2563eb"
          arenaAccentGlow="rgba(37,99,235,0.35)"
        />
      </div>

      {/* ── Save modal ──────────────────────────────────────────────────────── */}
      <SaveCreationModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        onSave={async (title, outputType, tags, projectId) => {
          await fetch("/api/creations", {
            method:  "POST",
            headers: { "Content-Type":"application/json" },
            body:    JSON.stringify({
              title,
              type:        "chat",
              output_type: outputType,
              content:     saveContent,
              tags:        [...tags, "classroom", chapter.chapter_title],
              project_id:  projectId,
            }),
          });
          setSaveOpen(false);
        }}
        defaultOutputType={saveOutType}
        suggestedTitle=""
      />
    </div>
  );
}
