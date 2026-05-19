"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, X, Sparkles, Save, RotateCcw, ChevronLeft as Prev, ChevronRight as Next, FileText, Layers } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Chapter } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────
type ToolType = "notes" | "flashcards";

interface Flashcard { question: string; answer: string; }

interface ArenaItem {
  id:        string;
  type:      ToolType;
  title:     string;
  content:   string;                  // markdown for notes, JSON string for flashcards
  createdAt: number;
}

interface Props {
  chapter: Chapter;
  onBack:  () => void;
}

const MAX_PER_TYPE = 10;

// ── Left tile config — positions as % of viewport ────────────────────────────
const TILES = [
  { key: "notes",      label: "Notes",           icon: "📝", active: true,  color: "#2563eb", top: "11%" },
  { key: "flashcards", label: "Flashcards",       icon: "🃏", active: true,  color: "#7C3AED", top: "22%" },
  { key: "mindmap",    label: "Mind Map",         icon: "🕸️", active: false, color: "#6b7280", top: "33%" },
  { key: "comic",      label: "Comic Creations",  icon: "💬", active: false, color: "#6b7280", top: "44%" },
  { key: "explainer",  label: "Explainer Videos", icon: "🎥", active: false, color: "#6b7280", top: "55%" },
  { key: "audio",      label: "Audio Overview",   icon: "🎧", active: false, color: "#6b7280", top: "66%" },
  { key: "podcast",    label: "Audio Podcast",    icon: "🎙️", active: false, color: "#6b7280", top: "77%" },
] as const;

// ── FlashcardViewer ───────────────────────────────────────────────────────────
function FlashcardViewer({ cards }: { cards: Flashcard[] }) {
  const [idx,     setIdx]     = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[idx];
  if (!card) return null;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono" style={{ color: "rgba(15,28,77,0.45)" }}>
          {idx + 1} / {cards.length}
        </span>
        <span className="text-xs" style={{ color: "rgba(15,28,77,0.4)" }}>Click card to flip</span>
      </div>

      {/* Flip card */}
      <div className="flex-1 cursor-pointer" onClick={() => setFlipped(f => !f)}
        style={{ perspective: 800, minHeight: 160 }}>
        <motion.div className="relative w-full h-full"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformStyle: "preserve-3d" }}>
          {/* Front */}
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-5 text-center"
            style={{ backfaceVisibility: "hidden",
              background: "linear-gradient(135deg,#2563eb,#7C3AED)",
              boxShadow: "0 8px 24px rgba(37,99,235,0.3)" }}>
            <span className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>Question</span>
            <p className="font-bold text-sm leading-relaxed text-white">{card.question}</p>
          </div>
          {/* Back */}
          <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-5 text-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)",
              background: "rgba(255,255,255,0.95)", border: "2px solid rgba(37,99,235,0.2)" }}>
            <span className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "rgba(124,58,237,0.6)" }}>Answer</span>
            <p className="text-sm leading-relaxed" style={{ color: "#0f1c4d" }}>{card.answer}</p>
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => { setIdx(i => Math.max(0, i-1)); setFlipped(false); }}
          disabled={idx === 0}
          className="p-2 rounded-xl transition-all disabled:opacity-25"
          style={{ background: "rgba(15,28,77,0.07)" }}>
          <Prev className="w-4 h-4" style={{ color: "#0f1c4d" }} />
        </button>
        <div className="flex gap-1">
          {cards.map((_, i) => (
            <div key={i} onClick={() => { setIdx(i); setFlipped(false); }}
              className="w-2 h-2 rounded-full cursor-pointer transition-all"
              style={{ background: i === idx ? "#2563eb" : "rgba(15,28,77,0.15)" }} />
          ))}
        </div>
        <button onClick={() => { setIdx(i => Math.min(cards.length-1, i+1)); setFlipped(false); }}
          disabled={idx === cards.length - 1}
          className="p-2 rounded-xl transition-all disabled:opacity-25"
          style={{ background: "rgba(15,28,77,0.07)" }}>
          <Next className="w-4 h-4" style={{ color: "#0f1c4d" }} />
        </button>
      </div>
    </div>
  );
}

// ── WhiteboardCard — saved item thumbnail ─────────────────────────────────────
function WhiteboardCard({ item, onClick }: { item: ArenaItem; onClick: () => void }) {
  const isFlashcards = item.type === "flashcards";
  let cards: Flashcard[] = [];
  if (isFlashcards) { try { cards = JSON.parse(item.content); } catch {} }

  return (
    <motion.div onClick={onClick}
      initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
      whileHover={{ scale:1.03, boxShadow:"0 8px 24px rgba(15,28,77,0.15)" }}
      transition={{ duration:0.2 }}
      className="rounded-2xl p-3 cursor-pointer"
      style={{ background:"rgba(255,255,255,0.92)", border:"1px solid rgba(15,28,77,0.1)",
        boxShadow:"0 2px 10px rgba(15,28,77,0.07)" }}>

      {/* Type badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px]"
          style={{ background: isFlashcards ? "rgba(124,58,237,0.12)" : "rgba(37,99,235,0.12)" }}>
          {isFlashcards ? "🃏" : "📝"}
        </div>
        <span className="text-[10px] font-mono font-bold truncate"
          style={{ color: isFlashcards ? "#7C3AED" : "#2563eb" }}>
          {isFlashcards ? "FLASHCARDS" : "NOTES"}
        </span>
      </div>

      <p className="text-xs font-bold mb-1.5 truncate" style={{ color:"#0f1c4d" }}>{item.title}</p>

      {isFlashcards ? (
        <p className="text-[10px]" style={{ color:"rgba(15,28,77,0.45)" }}>
          {cards.length} cards
        </p>
      ) : (
        <p className="text-[10px] leading-relaxed line-clamp-2" style={{ color:"rgba(15,28,77,0.45)" }}>
          {item.content.replace(/[#*`]/g, "").slice(0, 80)}…
        </p>
      )}
    </motion.div>
  );
}

// ── Main ClassroomArena ───────────────────────────────────────────────────────
export function ClassroomArena({ chapter, onBack }: Props) {
  const [activeTool,   setActiveTool]   = useState<ToolType | null>(null);
  const [prompt,       setPrompt]       = useState("");
  const [generating,   setGenerating]   = useState(false);
  const [streamText,   setStreamText]   = useState("");
  const [flashcards,   setFlashcards]   = useState<Flashcard[]>([]);
  const [savedItems,   setSavedItems]   = useState<ArenaItem[]>([]);
  const [viewingItem,  setViewingItem]  = useState<ArenaItem | null>(null);
  const [saveMsg,      setSaveMsg]      = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const defaultPrompt = useCallback((tool: ToolType) =>
    tool === "notes"
      ? `Generate comprehensive study notes for "${chapter.chapter_title}" — CBSE Class 10 Science`
      : `Generate 10 flashcards for "${chapter.chapter_title}" — CBSE Class 10 Science`,
  [chapter.chapter_title]);

  const openTool = (tool: ToolType) => {
    setActiveTool(tool);
    setPrompt(defaultPrompt(tool));
    setStreamText("");
    setFlashcards([]);
    setViewingItem(null);
  };

  const closeTool = () => {
    abortRef.current?.abort();
    setActiveTool(null);
    setStreamText("");
    setFlashcards([]);
  };

  const generate = async () => {
    if (!activeTool || generating) return;
    setGenerating(true);
    setStreamText("");
    setFlashcards([]);
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/classroom/arena/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ type: activeTool, chapter_title: chapter.chapter_title, prompt }),
        signal:  abortRef.current.signal,
      });

      if (!res.ok) throw new Error(await res.text());

      if (activeTool === "flashcards") {
        const data = await res.json();
        setFlashcards(data.flashcards ?? []);
      } else {
        // SSE stream
        const reader = res.body!.getReader();
        const dec    = new TextDecoder();
        let   buf    = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") break;
            try { setStreamText(prev => prev + (JSON.parse(payload).text ?? "")); } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const saveItem = async () => {
    if (!activeTool) return;
    const content  = activeTool === "flashcards" ? JSON.stringify(flashcards) : streamText;
    const typeCount = savedItems.filter(i => i.type === activeTool).length;

    if (typeCount >= MAX_PER_TYPE) {
      setSaveMsg(`Max ${MAX_PER_TYPE} ${activeTool} reached`);
      setTimeout(() => setSaveMsg(null), 2500);
      return;
    }

    const title = activeTool === "notes"
      ? `Notes: ${chapter.chapter_title}`
      : `Flashcards: ${chapter.chapter_title} (${new Date().toLocaleTimeString()})`;

    const item: ArenaItem = { id: crypto.randomUUID(), type: activeTool, title, content, createdAt: Date.now() };
    setSavedItems(prev => [item, ...prev]);

    // Also persist to creations
    fetch("/api/creations", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        title,
        type:       "mixed",
        output_type: activeTool === "notes" ? "text" : "json",
        content,
        tags:       ["classroom", activeTool, chapter.chapter_title],
      }),
    }).catch(() => {});

    setSaveMsg("Saved to whiteboard!");
    setTimeout(() => setSaveMsg(null), 2000);
    closeTool();
  };

  const hasContent = activeTool === "flashcards" ? flashcards.length > 0 : streamText.length > 0;
  const notesCount     = savedItems.filter(i => i.type === "notes").length;
  const flashcardCount = savedItems.filter(i => i.type === "flashcards").length;

  return (
    <div className="relative overflow-hidden select-none"
      style={{ height: "100dvh", fontFamily: "var(--font-dm-sans,'DM Sans',sans-serif)" }}>

      {/* Background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/classroom/classroom/background.png" alt="" aria-hidden draggable={false}
        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"fill", zIndex:0 }}
      />

      {/* ── Back button ────────────────────────────────────────────────────── */}
      <button onClick={onBack}
        className="absolute flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-all hover:opacity-80"
        style={{ top:12, left:14, zIndex:30,
          background:"rgba(255,255,255,0.15)", backdropFilter:"blur(10px)",
          color:"rgba(255,255,255,0.85)", border:"1px solid rgba(255,255,255,0.2)" }}>
        <ChevronLeft className="w-3.5 h-3.5" />
        Back
      </button>

      {/* ── Chapter label ───────────────────────────────────────────────────── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full"
        style={{ zIndex:20, background:"rgba(255,255,255,0.12)", backdropFilter:"blur(10px)",
          border:"1px solid rgba(255,255,255,0.2)" }}>
        <p className="text-[11px] font-mono text-white/70 text-center">
          {chapter.chapter_title}
        </p>
      </div>

      {/* ── Left toolbar hotspot zones ──────────────────────────────────────── */}
      {TILES.map(tile => (
        <div key={tile.key}
          className="absolute"
          style={{ top: tile.top, left: "0.5%", width: "11%", height: "9%", zIndex: 20 }}>
          {tile.active ? (
            <motion.button
              onClick={() => openTool(tile.key as ToolType)}
              className="w-full h-full rounded-xl flex items-center justify-center"
              style={{ cursor: "pointer", background: "transparent" }}
              whileHover={{ background: `${tile.color}25`, boxShadow: `0 0 18px ${tile.color}40` }}
              transition={{ duration: 0.15 }}
            />
          ) : (
            /* locked — no interaction */
            <div className="w-full h-full rounded-xl" />
          )}
        </div>
      ))}

      {/* ── Whiteboard — saved items grid ──────────────────────────────────── */}
      <div className="absolute overflow-y-auto"
        style={{ left:"24%", top:"12%", width:"52%", height:"80%", zIndex:15, scrollbarWidth:"none" }}>

        {savedItems.length === 0 && !activeTool && (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
            <span className="text-3xl">✨</span>
            <p className="text-sm font-medium" style={{ color:"#0f1c4d" }}>
              Click Notes or Flashcards to generate
            </p>
          </div>
        )}

        {/* Counts */}
        {savedItems.length > 0 && (
          <div className="flex items-center gap-3 mb-3 px-1">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background:"rgba(37,99,235,0.1)", color:"#2563eb" }}>
              📝 {notesCount}/{MAX_PER_TYPE} notes
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
              style={{ background:"rgba(124,58,237,0.1)", color:"#7C3AED" }}>
              🃏 {flashcardCount}/{MAX_PER_TYPE} flashcards
            </span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5 p-1">
          {savedItems.map(item => (
            <WhiteboardCard key={item.id} item={item} onClick={() => setViewingItem(item)} />
          ))}
        </div>
      </div>

      {/* ── Generation panel (slides over whiteboard) ──────────────────────── */}
      <AnimatePresence>
        {activeTool && (
          <motion.div
            key="gen-panel"
            initial={{ opacity:0, y:20 }}
            animate={{ opacity:1, y:0 }}
            exit={{    opacity:0, y:20 }}
            transition={{ duration:0.25 }}
            className="absolute flex flex-col"
            style={{ left:"24%", top:"12%", width:"52%", height:"80%", zIndex:25,
              background:"rgba(255,255,255,0.97)", backdropFilter:"blur(24px)",
              borderRadius:20, boxShadow:"0 16px 48px rgba(15,28,77,0.18)",
              border:"1px solid rgba(255,255,255,0.8)" }}>

            {/* Panel header */}
            <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5"
              style={{ borderBottom:"1px solid rgba(15,28,77,0.08)" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                style={{ background: activeTool==="notes" ? "rgba(37,99,235,0.1)" : "rgba(124,58,237,0.1)" }}>
                {activeTool === "notes" ? "📝" : "🃏"}
              </div>
              <div className="flex-1">
                <p className="font-display font-bold text-sm" style={{ color:"#0f1c4d" }}>
                  {activeTool === "notes" ? "Generate Notes" : "Generate Flashcards"}
                </p>
                <p className="text-[10px] font-mono" style={{ color:"rgba(15,28,77,0.4)" }}>
                  {chapter.chapter_title}
                </p>
              </div>
              <button onClick={closeTool} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" style={{ color:"rgba(15,28,77,0.45)" }} />
              </button>
            </div>

            {/* Prompt input */}
            <div className="flex-shrink-0 px-5 py-3"
              style={{ borderBottom:"1px solid rgba(15,28,77,0.06)" }}>
              <div className="flex gap-2">
                <input
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && !generating && generate()}
                  placeholder="Describe what to generate…"
                  className="flex-1 text-sm px-3 py-2 rounded-xl outline-none"
                  style={{ background:"rgba(15,28,77,0.05)", color:"#0f1c4d",
                    border:"1px solid rgba(15,28,77,0.1)" }}
                />
                <button onClick={generate} disabled={generating}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: generating ? "rgba(15,28,77,0.08)" : (activeTool==="notes" ? "linear-gradient(135deg,#2563eb,#1a4db5)" : "linear-gradient(135deg,#7C3AED,#5b21b6)"),
                    color: generating ? "rgba(15,28,77,0.35)" : "#fff",
                    cursor: generating ? "not-allowed" : "pointer" }}>
                  {generating
                    ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />Generating</>
                    : <><Sparkles className="w-3.5 h-3.5" />Generate</>
                  }
                </button>
              </div>
            </div>

            {/* Content preview */}
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4" style={{ scrollbarWidth:"thin" }}>
              {!hasContent && !generating && (
                <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                  {activeTool === "notes"
                    ? <FileText className="w-10 h-10" style={{ color:"#2563eb" }} />
                    : <Layers    className="w-10 h-10" style={{ color:"#7C3AED" }} />
                  }
                  <p className="text-sm" style={{ color:"rgba(15,28,77,0.6)" }}>
                    Click Generate to create {activeTool}
                  </p>
                </div>
              )}

              {activeTool === "notes" && streamText && (
                <div className="prose prose-sm max-w-none" style={{ color:"#0f1c4d" }}>
                  <ReactMarkdown>{streamText}</ReactMarkdown>
                  {generating && <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse rounded-sm" />}
                </div>
              )}

              {activeTool === "flashcards" && flashcards.length > 0 && (
                <FlashcardViewer cards={flashcards} />
              )}
            </div>

            {/* Footer actions */}
            {hasContent && !generating && (
              <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
                style={{ borderTop:"1px solid rgba(15,28,77,0.07)" }}>
                <button onClick={generate}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl transition-all hover:bg-gray-50"
                  style={{ color:"rgba(15,28,77,0.5)" }}>
                  <RotateCcw className="w-3.5 h-3.5" /> Regenerate
                </button>

                {saveMsg ? (
                  <span className="text-sm font-bold px-4 py-2 rounded-xl"
                    style={{ background:"rgba(22,163,74,0.1)", color:"#16a34a" }}>
                    {saveMsg}
                  </span>
                ) : (
                  <button onClick={saveItem}
                    className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl transition-all"
                    style={{ background: activeTool==="notes" ? "linear-gradient(135deg,#2563eb,#1a4db5)" : "linear-gradient(135deg,#7C3AED,#5b21b6)",
                      color:"#fff", boxShadow: activeTool==="notes" ? "0 0 20px rgba(37,99,235,0.3)" : "0 0 20px rgba(124,58,237,0.3)" }}>
                    <Save className="w-3.5 h-3.5" /> Save to Whiteboard
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Viewing saved item ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {viewingItem && (
          <motion.div key="viewer"
            initial={{ opacity:0, scale:0.95 }} animate={{ opacity:1, scale:1 }}
            exit={{ opacity:0, scale:0.95 }} transition={{ duration:0.22 }}
            className="absolute flex flex-col"
            style={{ left:"24%", top:"12%", width:"52%", height:"80%", zIndex:26,
              background:"rgba(255,255,255,0.97)", backdropFilter:"blur(24px)",
              borderRadius:20, boxShadow:"0 16px 48px rgba(15,28,77,0.18)",
              border:"1px solid rgba(255,255,255,0.8)" }}>

            <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5"
              style={{ borderBottom:"1px solid rgba(15,28,77,0.08)" }}>
              <span className="text-lg">{viewingItem.type === "notes" ? "📝" : "🃏"}</span>
              <p className="flex-1 font-bold text-sm truncate" style={{ color:"#0f1c4d" }}>
                {viewingItem.title}
              </p>
              <button onClick={() => setViewingItem(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" style={{ color:"rgba(15,28,77,0.45)" }} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4" style={{ scrollbarWidth:"thin" }}>
              {viewingItem.type === "notes" ? (
                <div className="prose prose-sm max-w-none" style={{ color:"#0f1c4d" }}>
                  <ReactMarkdown>{viewingItem.content}</ReactMarkdown>
                </div>
              ) : (
                <FlashcardViewer cards={(() => {
                  try { return JSON.parse(viewingItem.content); } catch { return []; }
                })()} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save message toast */}
      <AnimatePresence>
        {saveMsg && !activeTool && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ zIndex:40, background:"rgba(22,163,74,0.9)", color:"#fff",
              boxShadow:"0 4px 16px rgba(22,163,74,0.3)" }}>
            {saveMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
