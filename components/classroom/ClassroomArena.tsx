"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { parseFlashcards } from "./FlashcardDeck";
import type { FlashCard } from "./FlashcardDeck";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, X, Download, BookmarkPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageBubble } from "@/components/playground/MessageBubble";
import type { Message }  from "@/components/playground/useChat";
import ReactMarkdown from "react-markdown";
import type { Chapter, Profile, OutputType } from "@/types";

interface Props {
  chapter: Chapter;
  onBack:  () => void;
}

interface SavedItem  { id: string; title: string; preview: string; content: string; createdAt: number; tags: string[]; }
interface VideoItem  {
  title:     string;
  embedUrl:  string;   // iframe src (Google Drive preview URL)
  thumbUrl:  string;   // thumbnail image src
}

function driveEmbed(fileId: string)  { return `https://drive.google.com/file/d/${fileId}/preview`; }
function driveThumb(fileId: string)  { return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`; }

const MATHS_VIDEO_ID = "1tTJkw13HqGbkTUoxypgtBGlAXkdoiE1Y";

// Map subject → available explainer videos
function getVideos(subject: string): VideoItem[] {
  if (subject === "Mathematics") {
    return [{
      title:    "Mathematics Explainer",
      embedUrl: driveEmbed(MATHS_VIDEO_ID),
      thumbUrl: driveThumb(MATHS_VIDEO_ID),
    }];
  }
  return [{
    title:    "Physics Explainer",
    embedUrl: "/explainer_videos/physics/physics.mp4",
    thumbUrl: "",
  }];
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

// ── Flashcard mode helpers ────────────────────────────────────────────────────
/** What output format the user is explicitly asking for. "auto" = they didn't specify. */
function getRequestedOutput(text: string): "qa" | "visual" | "auto" {
  if (/\bQ\.?&\.?A\b|question.*answer|quiz\b/i.test(text)) return "qa";
  if (/\bpoint|bullet|visual|image|diagram|picture|figure\b/i.test(text)) return "visual";
  return "auto";
}

/** What format the user's INPUT content is already in. */
function getInputFormat(content: string): "qa" | "points" {
  // Q markers: "Q:", "Q1:", "**Q1:**", "Question:", "Question 1:"
  if (/(?:^|\n)\s*(?:Q\d*\s*[:.!]|\*\*Q\d*[:.!]|Question\s*\d*\s*[:.!])/i.test(content)) return "qa";
  // A / Answer markers: "A:", "A1:", "**A:**", "Answer:", "Ans:", "Answer 1:"
  if (/(?:^|\n)\s*(?:A\d*\s*[:.!]|\*\*A\d*[:.!]|Ans(?:wer)?\s*\d*\s*[:.!])/i.test(content)) return "qa";
  // Question followed by a line that starts with Answer (common paste format)
  if (/\?\s*\n+\s*(?:Answer|Ans)\s*[:.!]/i.test(content)) return "qa";
  // Otherwise treat as points / paragraph / numbered list
  return "points";
}

/** Extracts an explicit count: "5 points", "3 questions", "give me 7" → number. */
function extractPointCount(text: string): number | null {
  const m = text.match(/\b(\d+)\s*(?:points?|cards?|flashcards?|questions?)\b/i)
         ?? text.match(/\b(?:give|create|make|generate)\s+(\d+)\b/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 30 ? n : null;
}

function hasQAContent(content: string): boolean {
  return /^\s*(?:Q\d*:|Question\d*:|\*\*Q\d*:)/im.test(content);
}

function buildQAFlashcardPrompt(chapterTitle: string, content: string, count?: number | null): string {
  const n = count ? `exactly ${count}` : "one card per key point or concept in the content — do not pad or invent extra cards";
  const strict = count ? ` Produce EXACTLY ${count} cards — no more, no less.` : " Produce only as many cards as there are distinct points — if the content has 4 points, produce 4 cards.";
  return `Convert the student's content below into Q&A flashcards. Do NOT add any new information — only use what is provided.${strict}\n\nChapter: "${chapterTitle}"\n\nContent:\n"""\n${content}\n"""\n\nProduce ${n}. Only the label is bold:\n**Q1:** [question taken directly from the content]\n**A:** [answer taken directly from the content]\n\n**Q2:** [question]\n**A:** [answer]\n\nNo preamble. No invented content. Plain text only.`;
}

function buildVisualFlashcardPrompt(chapterTitle: string, content: string, count?: number | null): string {
  const n = count ? `exactly ${count}` : "one card per key point or concept in the content — do not pad or invent extra cards";
  const strict = count ? ` Produce EXACTLY ${count} cards — no more, no less.` : " Produce only as many cards as there are distinct points — if the content has 4 points, produce 4 cards.";
  return `Convert the student's content below into visual point cards. Do NOT add any new information — only use what is provided.${strict}\n\nChapter: "${chapterTitle}"\n\nContent:\n"""\n${content}\n"""\n\nProduce ${n}. Only the label is bold:\n**IMG1:** [short concept title — 3–6 words from the content]\n**PTS:**\n- [key point from the content]\n- [key point from the content]\n\n**IMG2:** [short concept title]\n**PTS:**\n- [key point]\n\nNo preamble. No invented content. Plain text only.`;
}

function buildAutoFlashcardPrompt(chapterTitle: string, content: string, count?: number | null): string {
  // Match the format of what the user gave — Q&A in → Q&A out, points in → points out
  // count = null means "match the content length exactly"
  return getInputFormat(content) === "qa"
    ? buildQAFlashcardPrompt(chapterTitle, content, count)
    : buildVisualFlashcardPrompt(chapterTitle, content, count);
}

// ── Visual card back — generates image lazily on first view, retries on error ──
function VisualCardBack({
  imagePrompt, imageKey, cardImages, setCardImages,
}: {
  imagePrompt: string;
  imageKey: string;
  cardImages: Record<string, string>;
  setCardImages: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const imgState = cardImages[imageKey];
  const [retryCount, setRetryCount] = useState(0);

  const generate = useCallback(() => {
    setCardImages(prev => ({ ...prev, [imageKey]: "loading" }));
    // Prompt style: title at top in fun bubble letters + cute cartoon characters
    // interacting with the actual educational content (formulas, shapes, symbols).
    const uniquePrompt = `Educational cartoon poster about "${imagePrompt}". Large fun bubble-letter title "${imagePrompt}" at the very top of the image in bold colourful letters. Below the title: cute cartoon characters (round-eyed stick figures or simple characters) interacting with the key educational content — show actual maths symbols, formulas, labelled shapes, or relevant objects specific to "${imagePrompt}". Bold ink outlines, vivid bright colours, clean white background, no scenery or landscape. The content must visually teach "${imagePrompt}". Style: flat 2D educational poster illustration for school students aged 11–16.`;
    fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: uniquePrompt, conversationHistory: `card:${imageKey}` }),
    })
      .then(r => r.json())
      .then(d => {
        if (d?.url) setCardImages(prev => ({ ...prev, [imageKey]: d.url }));
        else setCardImages(prev => ({ ...prev, [imageKey]: "retry" }));
      })
      .catch(() => setCardImages(prev => ({ ...prev, [imageKey]: "retry" })));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);

  // Reset retry counter whenever the card changes so each card gets its own 1 retry
  useEffect(() => {
    setRetryCount(0);
  }, [imageKey]);

  // First load — fire when card first appears and no image is cached yet
  useEffect(() => {
    if (!imgState) generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageKey]);

  // Auto-retry once on failure; after 2 total attempts show the error state
  useEffect(() => {
    if (imgState !== "retry") return;
    if (retryCount >= 1) return; // already retried once — show failed state
    const t = setTimeout(() => { setRetryCount(n => n + 1); generate(); }, 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgState, imageKey]);

  // Permanently failed after 1 retry — show error with a manual retry button
  if (imgState === "retry" && retryCount >= 1) return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0F0F1A] px-8 text-center">
      <div className="absolute inset-0" style={{ background:"radial-gradient(ellipse at 50% 45%, rgba(239,68,68,0.08), transparent 60%)" }}/>
      <p className="text-2xl relative z-[1]">🖼️</p>
      <p className="text-sm font-display font-bold text-white/70 leading-snug relative z-[1]">
        Couldn't load the image
      </p>
      <button
        onClick={() => { setRetryCount(0); setCardImages(prev => { const n = { ...prev }; delete n[imageKey]; return n; }); }}
        className="relative z-[1] px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
        style={{ background:"rgba(200,255,0,0.15)", border:"1px solid rgba(200,255,0,0.4)", color:"#C8FF00" }}>
        Try Again
      </button>
    </div>
  );

  // Loading or first retry — show spinner + topic name
  if (!imgState || imgState === "loading" || imgState === "retry") return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0F0F1A]">
      <div className="absolute inset-0" style={{ background:"radial-gradient(ellipse at 50% 45%, rgba(124,58,237,0.15), transparent 60%)" }}/>
      <div className="w-9 h-9 border-2 border-[#C8FF00]/25 border-t-[#C8FF00] rounded-full animate-spin relative z-[1]" />
      <div className="flex flex-col items-center gap-1 relative z-[1]">
        <p className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Loading image…</p>
        <p className="text-sm font-display font-bold text-white/70 text-center px-8 leading-snug">{imagePrompt}</p>
      </div>
    </div>
  );

  // Loaded — full background image (topic is embedded in the image itself)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={imgState} alt={imagePrompt} className="absolute inset-0 w-full h-full object-contain bg-white" />
  );
}

function buildContentFlashcardPrompt(chapterTitle: string, content: string): string {
  return `You are generating flashcards STRICTLY from the student's pasted content below. Do NOT use any outside knowledge. Every question and answer must come directly from the text provided.\n\nChapter context: "${chapterTitle}"\n\nStudent content:\n"""\n${content}\n"""\n\nCreate as many flashcards as needed to cover all the key points in the content (aim for 5–10).\n\nRules:\n- The label is bold; only the label. Answer text is plain.\n- Answers can be a sentence, bullet points, or an image reference — whatever best fits the content.\n- For lists/points in the content: make each key point a bullet under **A:**\n- For image URLs in the content: include them as ![label](url) in the answer\n\nFormat:\n**Q1:** [question from the content]\n**A:** [answer — sentence, bullets, or image]\n\n**Q2:** [question from the content]\n**A:** [answer]\n\nNo preamble, no commentary, just the cards.`;
}

const TILE_PROMPTS: Record<string, (t: string, count?: number) => string> = {
  notes: (t) => `Generate comprehensive study notes for "${t}" — CBSE Class 10 Science. Use clear headings, bullet points, key definitions, important equations, and a quick-revision summary. For equations, use plain text format only — no LaTeX. Write fractions as a/b or a ÷ b, use characters like θ, π, °, ±. Examples: sin(90° - θ) = cos(θ), csc(θ) = 1/sin(θ).`,

  // Q&A auto-generate — topic based, no content restriction
  flashcards: (t, count = 10) => {
    const focuses = [
      "Focus on key definitions and terminology.",
      "Focus on important formulas and how to apply them.",
      "Focus on worked examples and step-by-step problem solving.",
      "Focus on comparing and contrasting related concepts.",
      "Focus on real-world applications and practical examples.",
      "Focus on common mistakes students make and the correct approach.",
      "Focus on quick-recall facts, values, and identities.",
    ];
    const focus = focuses[Math.floor(Math.random() * focuses.length)];
    return `Generate exactly ${count} Q&A flashcards for "${t}" — CBSE Class 10. ${focus}\n\nOnly the label is bold. Plain text only.\n\n**Q1:** [question]\n**A:** [answer — sentence or short bullets]\n\n**Q2:** [question]\n**A:** [answer]\n\nContinue up to Q${count}. No preamble.`;
  },

  // Visual auto-generate — topic based, no content restriction
  visualFlashcards: (t, count = 10) => `Generate exactly ${count} visual point cards for "${t}" — CBSE Class 10.\n\nEach card: FRONT = short concept title (3–6 words), BACK = 2–3 key bullet points.\nOnly the label is bold.\n\n**IMG1:** [short concept title]\n**PTS:**\n- key point\n- key point\n\n**IMG2:** [short concept title]\n**PTS:**\n- key point\n\nContinue up to IMG${count}. Cover the most important concepts. No preamble. Plain text only.`,
};

const ACCENT     = "#2563eb";
const ACCENT_GLO = "rgba(37,99,235,0.35)";

export function ClassroomArena({ chapter, onBack }: Props) {
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [input,      setInput]      = useState("");
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [savedItems,   setSavedItems]   = useState<SavedItem[]>([]);
  const [viewingItem,  setViewingItem]  = useState<SavedItem | null>(null);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [isStreaming,  setIsStreaming]  = useState(false);
  const [mode,           setMode]           = useState<"notes" | "videos">("notes");
  const [playingVideo,   setPlayingVideo]   = useState<VideoItem | null>(null);
  const [flashcardRaw,           setFlashcardRaw]           = useState("");
  const [awaitingFlashcardInput, setAwaitingFlashcardInput] = useState(false);
  // Inline flashcard viewer — map so multiple decks persist independently
  const [fcMap,    setFcMap]    = useState<Record<string, FlashCard[]>>({}); // msgId → cards
  const [fcState,  setFcState]  = useState<{ msgId: string; idx: number; flipped: boolean } | null>(null);
  // Modal flashcard viewer for saved decks (SlideCarousel-style)
  const [modalFC,  setModalFC]  = useState<{ cards: FlashCard[]; raw: string; idx: number; flipped: boolean } | null>(null);
  const flashcardMsgIdRef  = useRef<string | null>(null);
  const [flashcardLoading, setFlashcardLoading] = useState(false);
  const [binDragOver,      setBinDragOver]      = useState(false);
  // Cache for generated images: key = `${msgId}-${cardIndex}`, value = image URL | "loading" | "error"
  const [cardImages, setCardImages] = useState<Record<string, string>>({});
  const bottomRef           = useRef<HTMLDivElement>(null);
  const taRef               = useRef<HTMLTextAreaElement>(null);
  const pendingFlashcardRef = useRef(false);
  const wasStreamingRef     = useRef(false);
  const messagesRef         = useRef<Message[]>([]);

  useEffect(() => {
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : { profile: null })
      .then(({ profile: p }) => setProfile(p))
      .catch(() => {});
  }, []);

  // Load persisted classroom creations for this chapter on mount
  useEffect(() => {
    fetch("/api/creations?type=chat&limit=10")
      .then(r => r.ok ? r.json() : { creations: [] })
      .then(({ creations }: { creations: any[] }) => {
        const filtered = creations.filter(
          (c: any) => Array.isArray(c.tags) && c.tags.includes("classroom") && c.tags.includes(chapter.chapter_title)
        ).slice(0, 10);
        setSavedItems(
          filtered.map((c: any) => ({
            id:        c.id,
            title:     c.title,
            preview:   (c.content as string).replace(/^#{1,3}\s+.+$/m, "").replace(/[#*`_]/g, "").trim().slice(0, 60),
            content:   c.content,
            tags:      Array.isArray(c.tags) ? c.tags : [],
            createdAt: new Date(c.created_at).getTime(),
          }))
        );
      })
      .catch(() => {});
  }, [chapter.chapter_title]);

  // Sends to the dedicated classroom chat route (NOT /api/chat)
  // displayText = what to show in the chat; defaults to text (the API prompt)
  const sendMessage = useCallback(async (text: string, displayText?: string): Promise<string> => {
    if (!profile || isStreaming || !text.trim()) return "";

    const userMsg: Message = { id: crypto.randomUUID(), role: "user",      content: displayText ?? text, outputType: "text", createdAt: new Date() };
    const asstId = crypto.randomUUID();
    const asstMsg: Message = { id: asstId,             role: "assistant", content: "",   outputType: "text", isLoading: true, createdAt: new Date() };

    setMessages(prev => [...prev, userMsg, asstMsg]);
    setIsStreaming(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/classroom/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: text, chapterTitle: chapter.chapter_title, history }),
      });

      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") break;
          try {
            const { content } = JSON.parse(data);
            if (content) {
              setMessages(prev => prev.map(m =>
                m.id === asstId ? { ...m, content: m.content + content, isLoading: false } : m
              ));
            }
          } catch { /* partial chunk */ }
        }
      }
    } catch (e) {
      console.error("[classroom/chat]", e);
      setMessages(prev => prev.map(m =>
        m.id === asstId ? { ...m, content: "Sorry, something went wrong. Please try again.", isLoading: false } : m
      ));
    } finally {
      setIsStreaming(false);
    }
    return asstId;
  }, [profile, isStreaming, messages, chapter.chapter_title]);

  // Keep messagesRef in sync for streaming completion detection
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // When flashcard stream finishes, show cards inline in the chat
  useEffect(() => {
    if (wasStreamingRef.current && !isStreaming && pendingFlashcardRef.current) {
      pendingFlashcardRef.current = false;
      const lastAssistant = [...messagesRef.current].reverse().find(m => m.role === "assistant");
      if (lastAssistant?.content) {
        const parsed = parseFlashcards(lastAssistant.content);
        setFlashcardLoading(false);
        if (parsed.length > 0) {
          setFlashcardRaw(lastAssistant.content);
          setFcMap(prev => ({ ...prev, [lastAssistant.id]: parsed }));
          setFcState({ msgId: lastAssistant.id, idx: 0, flipped: false });
          // Pre-generate the first visual card's image immediately so it's ready when shown
          const firstVisualIdx = parsed.findIndex(c => c.mode === "visual");
          if (firstVisualIdx !== -1) {
            const firstCard = parsed[firstVisualIdx];
            const imgKey = `${lastAssistant.id}-${firstVisualIdx}`;
            setCardImages(prev => ({ ...prev, [imgKey]: "loading" }));
            fetch("/api/generate-image", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: `Educational cartoon illustration specifically about: "${firstCard.question}". Draw a scene or diagram that clearly represents "${firstCard.question}". Colorful friendly cartoon style, bold outlines. Title text "${firstCard.question}" written large and bold at the top of the image. White background. For school students aged 11-16.`,
                conversationHistory: `card:${imgKey}`,
              }),
            })
              .then(r => r.json())
              .then(d => setCardImages(prev => ({ ...prev, [imgKey]: d?.url ?? "error" })))
              .catch(() => setCardImages(prev => ({ ...prev, [imgKey]: "error" })));
          }
          // Re-prompt so the user can generate another deck immediately
          const followUp: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Paste your notes, questions, points to study — or type **generate** to auto-create flashcards for **${chapter.chapter_title}**. 📚`,
            outputType: "text",
            createdAt: new Date(),
          };
          setMessages(prev => [...prev, followUp]);
          setAwaitingFlashcardInput(true);
        }
      }
    }
    wasStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || !profile || isStreaming) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

    // True when the user typed a short keyword/count with no actual content to use as source.
    // Covers: "generate", "Q&A", "points", "10 Q&A", "5 points", "question and answer", etc.
    const hasRealContent = t.includes("\n") || t.split(/[.!?]/).filter(s => s.trim().length > 10).length > 1;
    const isGenerateCommand = !hasRealContent && (
      /^(generate|auto|yes|ok|go|create|make)(\s+(cards?|flashcards?))?$/i.test(t) ||
      /^(Q\.?&\.?A\.?|qa|question.*answer|points?|visual|flashcard)s?(\s+\d+)?$/i.test(t) ||
      /^\d+\s+(Q\.?&\.?A\.?|points?|cards?|flashcard|question|visual)s?$/i.test(t)
    );

    // Detect flashcard intent from any chat message (e.g. "make flashcards for X")
    const flashcardIntent = !awaitingFlashcardInput &&
      /flashcard|flash\s*card|generate.*card|create.*card|make.*card/i.test(t) && t.length < 200;
    if (flashcardIntent) {
      setAwaitingFlashcardInput(false);
      pendingFlashcardRef.current = true;
      const fcCount   = extractPointCount(t);
      const requested = getRequestedOutput(t);
      const prompt = isGenerateCommand
        // Generate command → use topic-based tile prompts (no content restriction)
        ? (requested === "visual"
            ? TILE_PROMPTS.visualFlashcards(chapter.chapter_title, fcCount ?? 10)
            : TILE_PROMPTS.flashcards(chapter.chapter_title, fcCount ?? 10))
        // Content provided → convert that content to the requested format
        : (() => {
            if (requested === "qa")     return buildQAFlashcardPrompt(chapter.chapter_title, t, fcCount);
            if (requested === "visual") return buildVisualFlashcardPrompt(chapter.chapter_title, t, fcCount);
            return buildAutoFlashcardPrompt(chapter.chapter_title, t);
          })();
      flashcardMsgIdRef.current = null;
      setFlashcardLoading(true);
      const aid = await sendMessage(prompt, t);
      flashcardMsgIdRef.current = aid;
      return;
    }

    if (awaitingFlashcardInput) {
      setAwaitingFlashcardInput(false);
      pendingFlashcardRef.current = true;
      // "generate" / "yes" / "ok" → auto-generate from topic; anything else → route by mode
      const fcCount   = extractPointCount(t);
      const requested = getRequestedOutput(t);
      const prompt = isGenerateCommand
        // Generate command → use topic-based tile prompts (no content restriction)
        ? (requested === "visual"
            ? TILE_PROMPTS.visualFlashcards(chapter.chapter_title, fcCount ?? 10)
            : TILE_PROMPTS.flashcards(chapter.chapter_title, fcCount ?? 10))
        // Content provided → convert that content to the requested format
        : (() => {
            if (requested === "qa")     return buildQAFlashcardPrompt(chapter.chapter_title, t, fcCount);
            if (requested === "visual") return buildVisualFlashcardPrompt(chapter.chapter_title, t, fcCount);
            return buildAutoFlashcardPrompt(chapter.chapter_title, t);
          })();
      flashcardMsgIdRef.current = null;
      setFlashcardLoading(true);
      const aid = await sendMessage(prompt, t);
      flashcardMsgIdRef.current = aid;
      return;
    }

    await sendMessage(t);
  }, [profile, isStreaming, sendMessage, awaitingFlashcardInput, chapter.chapter_title]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const handleTileClick = useCallback((key: string) => {
    if (!profile || isStreaming) return;
    const buildPrompt = TILE_PROMPTS[key];
    if (!buildPrompt) return;
    if (key === "flashcards") pendingFlashcardRef.current = true;
    setActiveHint(key);
    setTimeout(() => setActiveHint(null), 900);
    sendMessage(buildPrompt(chapter.chapter_title));
  }, [profile, isStreaming, sendMessage, chapter.chapter_title]);

  // Called by MessageBubble's save button → adds thumbnail + persists to creations
  const handleSave = useCallback((content: string, outputType: OutputType) => {
    const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
    const title = headingMatch
      ? headingMatch[1].trim()
      : content.replace(/[#*`_]/g, "").slice(0, 50).trim() || chapter.chapter_title;
    const preview = content.replace(/^#{1,3}\s+.+$/m, "").replace(/[#*`_]/g, "").trim().slice(0, 60);
    const tempId = crypto.randomUUID();
    setSavedItems(prev => [{ id: tempId, title, preview, content, tags: ["classroom", chapter.chapter_title], createdAt: Date.now() }, ...prev].slice(0, 10));
    fetch("/api/creations", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        title, type:"chat", output_type: outputType, content,
        tags: ["classroom", chapter.chapter_title],
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        // Replace temp id with real DB id so refreshing doesn't duplicate
        if (data?.creation?.id) {
          setSavedItems(prev => prev.map(item =>
            item.id === tempId ? { ...item, id: data.creation.id } : item
          ));
        }
      })
      .catch(() => {});
  }, [chapter.chapter_title]);

  const handleFlashcardSave = useCallback((content: string) => {
    const parsed = parseFlashcards(content);
    const count   = parsed.length || 10;
    const hasVisual = parsed.some(c => c.mode === "visual");
    const type  = hasVisual ? "Visual Cards" : "Q&A Cards";
    const title = `${count} ${type}: ${chapter.chapter_title}`;
    const preview = `${count} ${type.toLowerCase()}`;
    const tempId = crypto.randomUUID();
    setSavedItems(prev => [
      { id: tempId, title, preview, content, tags: ["classroom", chapter.chapter_title, "flashcards"], createdAt: Date.now() },
      ...prev,
    ].slice(0, 10));
    fetch("/api/creations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, type: "chat", output_type: "text", content,
        tags: ["classroom", chapter.chapter_title, "flashcards"],
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.creation?.id) {
          setSavedItems(prev => prev.map(item => item.id === tempId ? { ...item, id: data.creation.id } : item));
        }
      })
      .catch(() => {});
  }, [chapter.chapter_title]);

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

      {/* ── Chapter title — bigger, centered top ─────────────────────────────── */}
      <div className="absolute flex flex-col items-center"
        style={{ top:10, left:"50%", transform:"translateX(-50%)", zIndex:25 }}>
        <div className="px-5 py-2 rounded-2xl"
          style={{ background:"rgba(0,0,0,0.55)", backdropFilter:"blur(12px)",
            border:"1px solid rgba(255,255,255,0.15)" }}>
          <p className="font-display font-black text-base whitespace-nowrap"
            style={{ color:"#fff", letterSpacing:"0.01em" }}>
            {chapter.chapter_title}
          </p>
          <p className="text-[11px] font-mono text-center mt-0.5" style={{ color:"rgba(255,255,255,0.45)" }}>
            CBSE Class 10 · Science
          </p>
        </div>
      </div>

      {/* ── Toolbar hotspot: Notes (invisible clickable zone) ────────────────── */}
      <div
        onClick={() => setMode("notes")}
        className="absolute"
        style={{ left:"0", top:"10%", width:"10%", height:"8.5%", zIndex:20, cursor:"pointer" }}
      />

      {/* ── Toolbar hotspot: Flashcards (invisible clickable zone) ───────────── */}
      <div
        onClick={() => {
          setMode("notes");
          if (isStreaming) return;
          const promptMsg: Message = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `Paste your notes, questions, points to study — or type **generate** to auto-create flashcards for **${chapter.chapter_title}**. 📚`,
            outputType: "text",
            createdAt: new Date(),
          };
          setMessages(prev => [...prev, promptMsg]);
          setAwaitingFlashcardInput(true);
        }}
        className="absolute"
        style={{ left:"0", top:"21%", width:"13%", height:"8.5%", zIndex:20, cursor:"pointer" }}
      />

      {/* ── Toolbar hotspot: Explainer Videos (invisible clickable zone) ─────── */}
      <div
        onClick={() => setMode("videos")}
        className="absolute"
        style={{ left:0, top:"45%", width:"13%", height:"8.5%", zIndex:20, cursor:"pointer" }}
      />

      {/* ── My Creations / Videos panel — overlaid on left wall panel ─────────── */}
      <div className="absolute overflow-y-auto"
        style={{ left:"15.5%", top:"15.5%", width:"17%", height:"72%",
          zIndex:18, scrollbarWidth:"none" }}>

        <AnimatePresence mode="wait">

          {/* ── NOTES mode ── */}
          {mode === "notes" && (
            <motion.div key="notes-panel"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.18 }}>
              <AnimatePresence>
                {savedItems.map((item) => {
                  const isFC = item.tags.includes("flashcards");
                  return (
                    <div key={item.id} draggable
                      onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                        e.dataTransfer.setData("application/classroom-item", item.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}>
                      <motion.div
                        initial={{ opacity:0, y:-8, scale:0.95 }}
                        animate={{ opacity:1, y:0,  scale:1 }}
                        transition={{ duration:0.25 }}
                        onClick={() => {
                          if (isFC) {
                            const parsed = parseFlashcards(item.content);
                            if (parsed.length > 0) { setModalFC({ cards: parsed, raw: item.content, idx: 0, flipped: false }); }
                          } else {
                            setViewingItem(item);
                          }
                        }}
                        className="rounded-xl p-3 mb-2 cursor-grab"
                        whileHover={{ scale:1.02, boxShadow: isFC ? "0 4px 16px rgba(124,58,237,0.25)" : "0 4px 16px rgba(37,99,235,0.2)" }}
                        style={{ background:"rgba(255,255,255,0.88)",
                          border: `1px solid ${isFC ? "rgba(124,58,237,0.25)" : "rgba(37,99,235,0.2)"}`,
                          boxShadow:"0 2px 12px rgba(15,28,77,0.1)" }}>
                        <div className="w-full h-1 rounded-full mb-2"
                          style={{ background: isFC ? "#7C3AED" : "linear-gradient(90deg,#2563eb,#7c3aed)" }} />
                        {isFC && (
                          <p className="text-[9px] font-mono uppercase tracking-widest mb-1"
                            style={{ color:"rgba(124,58,237,0.7)" }}>
                            ⚡ {item.preview}
                          </p>
                        )}
                        <p className="text-xs font-bold leading-snug"
                          style={{ color:"#0f1c4d", display:"-webkit-box",
                            WebkitLineClamp: isFC ? 2 : 3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                          {item.title}
                        </p>
                      </motion.div>
                    </div>
                  );
                })}
              </AnimatePresence>
              {savedItems.length === 0 && (
                <p className="text-[10px] text-center pt-3 opacity-30" style={{ color:"#0f1c4d" }}>
                  Saved items<br/>appear here
                </p>
              )}
            </motion.div>
          )}

          {/* ── VIDEOS mode ── */}
          {mode === "videos" && (
            <motion.div key="videos-panel"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.18 }}>
              {getVideos(chapter.subject).map((vid) => (
                <motion.div key={vid.embedUrl}
                  initial={{ opacity:0, y:-8, scale:0.95 }}
                  animate={{ opacity:1, y:0,  scale:1 }}
                  transition={{ duration:0.25 }}
                  onClick={() => setPlayingVideo(vid)}
                  className="rounded-xl mb-2 overflow-hidden cursor-pointer"
                  whileHover={{ scale:1.03, boxShadow:"0 6px 20px rgba(37,99,235,0.28)" }}
                  style={{ background:"rgba(255,255,255,0.92)",
                    border:"1px solid rgba(37,99,235,0.2)",
                    boxShadow:"0 2px 12px rgba(15,28,77,0.1)" }}>
                  {/* Video thumbnail */}
                  <div className="relative w-full" style={{ aspectRatio:"16/9", background:"#0a0f1e", maxHeight:72, overflow:"hidden" }}>
                    {vid.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={vid.thumbUrl} alt={vid.title}
                        style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                    ) : (
                      <div style={{ width:"100%", height:"100%", background:"#1a2540" }} />
                    )}
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background:"rgba(10,15,40,0.38)" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background:"rgba(37,99,235,0.9)",
                          boxShadow:"0 0 16px rgba(37,99,235,0.7)" }}>
                        <Play className="w-4 h-4 text-white" style={{ marginLeft:2 }} />
                      </div>
                    </div>
                  </div>
                  {/* Title */}
                  <div className="px-2.5 py-2">
                    <div className="w-full h-0.5 rounded-full mb-1.5"
                      style={{ background:"linear-gradient(90deg,#2563eb,#7c3aed)" }} />
                    <p className="text-[11px] font-bold leading-snug" style={{ color:"#0f1c4d" }}>
                      {vid.title}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

        </AnimatePresence>
      </div>


      {/* ── Dustbin — same as playground, drag saved cards here to delete ──── */}
      <div
        className="hidden lg:flex"
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setBinDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setBinDragOver(false); }}
        onDrop={e => {
          e.preventDefault();
          setBinDragOver(false);
          const id = e.dataTransfer.getData("application/classroom-item");
          if (!id) return;
          setSavedItems(prev => prev.filter(item => item.id !== id));
          fetch("/api/creations", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
        }}
        style={{
          position: "absolute",
          bottom: "3%",
          left:   "8%",
          width:  "20vw",
          zIndex: 18,
          alignItems: "flex-end",
          justifyContent: "center",
          cursor: "copy",
          transition: "transform 0.2s ease",
          transform: binDragOver ? "scale(1.18) translateY(-6px)" : "scale(1)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/arena1/bin.png"
          alt="Delete"
          draggable={false}
          style={{
            width: "100%", height: "auto", objectFit: "contain",
            filter: binDragOver
              ? "brightness(1.6) drop-shadow(0 0 14px rgba(255,80,80,0.9)) drop-shadow(0 0 32px rgba(255,80,80,0.5))"
              : "brightness(0.75) saturate(0.7)",
            transition: "filter 0.2s ease",
          }}
        />
      </div>

      {/* ── Chat overlay — transparent bg, floats on whiteboard ────────────── */}
      {/* Override Syne display font on all markdown headings inside this pane */}
      <style>{`
        .classroom-chat h1,.classroom-chat h2,.classroom-chat h3,
        .classroom-chat h4,.classroom-chat h5,.classroom-chat h6 {
          font-family: 'DM Sans', sans-serif !important;
          font-weight: 700;
        }
      `}</style>
      <div className="absolute flex flex-col classroom-chat"
        style={{ left:"36%", top:"10%", width:"60%", height:"70%", zIndex:15 }}>

        {/* Message list — no background, messages float on the whiteboard */}
        <div className="flex-1 min-h-0 overflow-y-auto"
          style={{ padding:"12px 14px 6px", display:"flex", flexDirection:"column",
            gap:8, scrollbarWidth:"none" }}>

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-35 pointer-events-none">
              <span style={{ fontSize:32 }}>✏️</span>
              <p className="text-sm text-center font-medium" style={{ color:"#1e3a8a", lineHeight:1.7 }}>
                Click <strong>Notes</strong> or <strong>Flashcards</strong> on the left,<br/>
                or type a question below
              </p>
            </div>
          )}

          {messages.map(msg => {
            const isFlashcardMsg = flashcardMsgIdRef.current === msg.id;
            const isLastMsg = msg === messages[messages.length - 1];
            const hasCards = !!fcMap[msg.id];
            // Show loader for the streaming assistant message when generating
            const showFlashcardLoader =
              !hasCards && msg.role === "assistant" && (
                (flashcardLoading && isLastMsg) ||
                (isFlashcardMsg && flashcardLoading)
              );
            if (showFlashcardLoader) {
              return (
                <MessageBubble
                  key={msg.id}
                  message={{ ...msg, isLoading: true, content: "" }}
                  avatarEmoji={profile.avatar_emoji}
                  isStreaming={false}
                  arenaAccent={ACCENT}
                  arenaAccentGlow={ACCENT_GLO}
                  arenaId={10}
                  onSave={handleSave}
                />
              );
            }

            // Inline flashcard deck — compact card viewer
            if (hasCards) {
              const cards = fcMap[msg.id];
              const isActive = fcState?.msgId === msg.id;
              const idx     = isActive ? fcState.idx    : 0;
              const flipped = isActive ? fcState.flipped : false;
              const card    = cards[idx];
              const total   = cards.length;
              const goTo = (i: number) => setFcState({ msgId: msg.id, idx: i, flipped: false });
              const flip  = () => setFcState(prev =>
                prev?.msgId === msg.id
                  ? { ...prev, flipped: !prev.flipped }
                  : { msgId: msg.id, idx: 0, flipped: true }
              );
              return (
                <div key={msg.id}>
                <div className="rounded-2xl overflow-hidden"
                  style={{ width:"58%", border:"1px solid rgba(255,255,255,0.1)",
                    boxShadow:"0 0 24px rgba(124,58,237,0.12)",
                    background:"rgba(15,15,26,0.95)", backdropFilter:"blur(20px)" }}>

                  {/* Card viewport */}
                  <div className="relative w-full" style={{ paddingBottom:"42%", cursor:"pointer" }}
                    onClick={flip}>
                    <div className="absolute inset-0" style={{ perspective:"1000px" }}>
                      <motion.div
                        animate={{ rotateY: flipped ? 180 : 0 }}
                        transition={{ duration: 0.45, ease:[0.16,1,0.3,1] }}
                        style={{ width:"100%", height:"100%", transformStyle:"preserve-3d", position:"relative" }}
                      >
                        {/* Front — Q&A: question | Visual: cartoon image */}
                        <div className="absolute inset-0 overflow-hidden"
                          style={{ backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden" as React.CSSProperties["WebkitBackfaceVisibility"] }}>
                          {card.mode === "visual" ? (
                            <VisualCardBack
                              imagePrompt={card.question}
                              imageKey={`${msg.id}-${idx}`}
                              cardImages={cardImages}
                              setCardImages={setCardImages}
                            />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#08080F]">
                              <div className="absolute inset-0" style={{ background:"radial-gradient(ellipse at 50% 35%, rgba(124,58,237,0.2), transparent 55%)" }}/>
                              <div className="absolute top-0 left-0 right-0 h-px" style={{ background:"linear-gradient(90deg,transparent,#C8FF00,transparent)", opacity:0.9 }}/>
                              <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background:"linear-gradient(90deg,transparent,#7C3AED,transparent)", opacity:0.8 }}/>
                              <p className="text-xs font-mono font-bold uppercase tracking-widest mb-3 relative z-[1]" style={{ color:"#C8FF00" }}>
                                Question {idx + 1} of {total}
                              </p>
                              <p className="text-sm font-display font-extrabold tracking-tight text-white text-center px-8 leading-tight relative z-[1]"
                                style={{ maxWidth:"85%" }}>
                                {card.question}
                              </p>
                              <p className="text-[10px] text-white/30 relative z-[1] mt-3">tap to reveal answer</p>
                            </div>
                          )}
                        </div>

                        {/* Back — Q&A: answer | Visual: key points */}
                        <div className="absolute inset-0 overflow-hidden bg-[#0F0F1A]"
                          style={{ backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden" as React.CSSProperties["WebkitBackfaceVisibility"], transform:"rotateY(180deg)" }}>
                          {card.mode === "visual" ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 gap-2">
                              <div className="w-2 absolute left-0 top-0 bottom-0" style={{ background:"linear-gradient(180deg,#C8FF00,#7C3AED,#00D4FF)", opacity:0.9 }}/>
                              <div className="absolute inset-0" style={{ background:"radial-gradient(ellipse at 50% 50%, rgba(124,58,237,0.12), transparent 65%)" }}/>
                              <p className="text-xs font-mono font-bold uppercase tracking-widest relative z-[1]" style={{ color:"#C8FF00" }}>
                                {card.question}
                              </p>
                              <div className="w-10 h-px rounded-full relative z-[1]" style={{ background:"rgba(200,255,0,0.35)" }}/>
                              <div className="text-[11px] text-white/80 leading-relaxed relative z-[1] overflow-y-auto text-left w-full pl-4"
                                style={{ fontFamily:"'DM Sans',sans-serif", maxHeight:"62%", scrollbarWidth:"none" }}>
                                <ReactMarkdown
                                  components={{
                                    p: ({children}) => <p className="mb-1">{children}</p>,
                                    ul: ({children}) => <ul className="list-disc list-inside space-y-0.5">{children}</ul>,
                                    ol: ({children}) => <ol className="list-decimal list-inside space-y-0.5">{children}</ol>,
                                    li: ({children}) => <li>{children}</li>,
                                    strong: ({children}) => <strong className="text-white font-bold">{children}</strong>,
                                  }}
                                >{card.answer}</ReactMarkdown>
                              </div>
                            </div>
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <div className="w-2 absolute left-0 top-0 bottom-0" style={{ background:"linear-gradient(180deg,#C8FF00,#7C3AED,#00D4FF)", opacity:0.9 }}/>
                              <div className="absolute inset-0" style={{ background:"radial-gradient(ellipse at 50% 50%, rgba(124,58,237,0.15), transparent 65%)" }}/>
                              <p className="text-xs font-mono font-bold uppercase tracking-widest mb-2 relative z-[1]" style={{ color:"#9F67FF" }}>Answer</p>
                              <div className="w-12 h-0.5 rounded-full mb-3 relative z-[1]" style={{ background:"#C8FF00", boxShadow:"0 0 12px rgba(200,255,0,0.35)" }}/>
                              <div className="text-sm text-white/90 px-6 leading-relaxed relative z-[1] overflow-y-auto"
                                style={{ fontFamily:"'DM Sans',sans-serif", maxWidth:"90%", maxHeight:"58%", scrollbarWidth:"none" }}>
                                <ReactMarkdown
                                  components={{
                                    p: ({children}) => <p className="mb-1 text-center">{children}</p>,
                                    ul: ({children}) => <ul className="list-disc list-inside text-left space-y-0.5">{children}</ul>,
                                    ol: ({children}) => <ol className="list-decimal list-inside text-left space-y-0.5">{children}</ol>,
                                    li: ({children}) => <li className="text-white/85">{children}</li>,
                                    strong: ({children}) => <strong className="text-white font-bold">{children}</strong>,
                                  }}
                                >{card.answer}</ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Controls bar */}
                  <div className="flex items-center justify-between px-3 py-2"
                    style={{ borderTop:"1px solid rgba(255,255,255,0.08)", background:"rgba(15,15,26,0.98)" }}>
                    <div className="flex items-center gap-2">
                      <button onClick={() => goTo(Math.max(0, idx - 1))} disabled={idx === 0}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all disabled:opacity-25"
                        style={{ color: idx === 0 ? "rgba(255,255,255,0.4)" : "#C8FF00" }}>
                        <ChevronLeft size={16}/>
                      </button>

                      <div className="flex gap-1">
                        {cards.map((_, i) => (
                          <button key={i} onClick={e => { e.stopPropagation(); goTo(i); }}
                            className={cn("rounded-full transition-all",
                              i === idx
                                ? "w-5 h-2 bg-[#C8FF00] shadow-[0_0_12px_rgba(200,255,0,0.35)]"
                                : "w-2 h-2 bg-white/15 hover:bg-white/30"
                            )}
                          />
                        ))}
                      </div>

                      <button onClick={() => goTo(Math.min(total - 1, idx + 1))} disabled={idx === total - 1}
                        className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all disabled:opacity-25"
                        style={{ color: idx === total - 1 ? "rgba(255,255,255,0.4)" : "#C8FF00" }}>
                        <ChevronRight size={16}/>
                      </button>

                      <span className="text-[10px] font-mono" style={{ color:"rgba(255,255,255,0.25)" }}>
                        {idx + 1} / {total} · tap to flip
                      </span>
                    </div>
                    <div/>
                  </div>
                </div>

                {/* Save + Download — below the card, above the next message */}
                <div className="flex items-center gap-2 mt-2 pl-1">
                  <button onClick={() => handleFlashcardSave(flashcardRaw)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-display font-extrabold tracking-tight transition-all active:scale-95"
                    style={{ color:"#1a2800", background:"#C8FF00", border:"2px solid #6b9900" }}>
                    <BookmarkPlus size={12}/> Save
                  </button>
                  <button onClick={() => {
                      const blob = new Blob([flashcardRaw], { type:"text/plain" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `flashcards-${chapter.chapter_title.replace(/\s+/g,"-")}.txt`;
                      a.click();
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-display font-extrabold tracking-tight transition-all active:scale-95"
                    style={{ color:"#0f1c4d", background:"rgba(37,99,235,0.12)", border:"2px solid #2563eb" }}>
                    <Download size={12}/> Download
                  </button>
                </div>
                </div>
              );
            }
            // For assistant messages that contain Q&A, show a "View as Flashcards" button
            const hasQA = msg.role === "assistant" && !msg.isLoading && (
              /\*\*Q\d*(?:uestion)?:\*\*/i.test(msg.content) ||
              /^Q\d+:/im.test(msg.content) ||
              /^Q(?:uestion)?:/im.test(msg.content)
            );
            return (
              <div key={msg.id}>
                <MessageBubble
                  message={msg}
                  avatarEmoji={profile.avatar_emoji}
                  isStreaming={isStreaming && msg === messages[messages.length - 1]}
                  arenaAccent={ACCENT}
                  arenaAccentGlow={ACCENT_GLO}
                  arenaId={10}
                  onSave={msg.content.startsWith("Paste your notes") ? undefined : handleSave}
                />
                {hasQA && (
                  <button
                    onClick={() => {
                      const parsed = parseFlashcards(msg.content);
                      if (parsed.length > 0) {
                        setFlashcardRaw(msg.content);
                        setInlineFC({ msgId: msg.id, cards: parsed });
                        setFcMap(prev => ({ ...prev, [msg.id]: parsed }));
                        setFcState({ msgId: msg.id, idx: 0, flipped: false });
                      }
                    }}
                    style={{ marginTop:6, marginLeft:4, padding:"5px 12px", borderRadius:10, fontSize:12,
                      fontFamily:"'DM Sans',sans-serif", fontWeight:600, cursor:"pointer",
                      background:"rgba(37,99,235,0.1)", border:"1px solid rgba(37,99,235,0.3)",
                      color:"#1d4ed8" }}>
                    🃏 View as Flashcards
                  </button>
                )}
              </div>
            );
          })}

          {/* Streaming dots — hidden during flashcard generation (loading box handles it) */}
          {isStreaming && !flashcardLoading && (
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

        {/* ── Input bar — dark pill, Creator's Room style ────────────────────── */}
        <div style={{ flexShrink:0, padding:"0 4px 8px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8,
            background:"linear-gradient(180deg, rgba(18,28,72,0.92) 0%, rgba(10,16,52,0.95) 100%)",
            backdropFilter:"blur(24px)",
            borderRadius:16, padding:"10px 12px",
            border:"1px solid rgba(100,140,255,0.25)",
            boxShadow:"0 0 0 1px rgba(100,140,255,0.08), 0 4px 24px rgba(0,0,50,0.4), inset 0 1px 0 rgba(255,255,255,0.1)" }}>

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
                background:"transparent", fontSize:15, fontWeight:500,
                color:"rgba(255,255,255,0.92)", fontFamily:"inherit",
                lineHeight:1.5, overflowY:"hidden",
                caretColor:ACCENT, userSelect:"text" }}
            />

            <button onClick={() => send(input)} disabled={!canSend}
              style={{ width:34, height:34, borderRadius:"50%", flexShrink:0,
                background: canSend ? `rgba(37,99,235,0.9)` : "rgba(255,255,255,0.08)",
                border:"none", cursor: canSend ? "pointer" : "not-allowed",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.2s",
                boxShadow: canSend ? `0 0 16px rgba(37,99,235,0.6)` : "none" }}>
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <path d="M2 9h14M9 2l7 7-7 7"
                  stroke={canSend ? "#fff" : "rgba(255,255,255,0.2)"}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Video player modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {playingVideo && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex:60, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)" }}
            onClick={() => setPlayingVideo(null)}
          >
            <motion.div
              initial={{ opacity:0, scale:0.93, y:16 }}
              animate={{ opacity:1, scale:1,    y:0 }}
              exit={{    opacity:0, scale:0.93, y:16 }}
              transition={{ duration:0.22 }}
              onClick={e => e.stopPropagation()}
              style={{ width:"72%", borderRadius:16, overflow:"hidden",
                boxShadow:"0 32px 80px rgba(0,0,0,0.7)",
                border:"1px solid rgba(255,255,255,0.1)" }}>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3"
                style={{ background:"rgba(10,15,40,0.95)", borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-sm font-semibold" style={{ color:"rgba(255,255,255,0.88)",
                  fontFamily:"'DM Sans',sans-serif" }}>
                  {playingVideo.title}
                </p>
                <button onClick={() => setPlayingVideo(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{ color:"rgba(255,255,255,0.5)" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Video — iframe for Drive links, native video for local files */}
              {playingVideo.embedUrl.startsWith("https://drive.google.com") ? (
                <iframe
                  key={playingVideo.embedUrl}
                  src={playingVideo.embedUrl}
                  allow="autoplay"
                  allowFullScreen
                  style={{ width:"100%", border:"none", background:"#000",
                    height:"min(70vh, 480px)", display:"block" }}
                />
              ) : (
                <video
                  key={playingVideo.embedUrl}
                  src={playingVideo.embedUrl}
                  controls
                  autoPlay
                  style={{ width:"100%", display:"block", background:"#000",
                    maxHeight:"70vh", objectFit:"contain" }}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Flashcard slide modal (saved decks) — exact SlideCarousel style ── */}
      <AnimatePresence>
        {modalFC && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 60, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setModalFC(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 16 }}
              transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl overflow-hidden border border-white/[0.1] shadow-[0_0_36px_rgba(124,58,237,0.15)] bg-[#0F0F1A]/95 backdrop-blur-xl"
              style={{ width: "72%" }}
            >
              {/* Slide viewport — 16:9, click to flip */}
              <div className="relative w-full" style={{ paddingBottom: "56.25%", cursor: "pointer" }}
                onClick={() => setModalFC(prev => prev ? { ...prev, flipped: !prev.flipped } : null)}>
                <div className="absolute inset-0">
                  <motion.div
                    animate={{ rotateY: modalFC.flipped ? 180 : 0 }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    style={{ width: "100%", height: "100%", transformStyle: "preserve-3d", position: "relative" }}
                  >
                    {/* Front — Question (TitleSlide) */}
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#08080F] relative overflow-hidden absolute inset-0"
                      style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" as React.CSSProperties["WebkitBackfaceVisibility"] }}>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(124,58,237,0.2),transparent_55%)]" />
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C8FF00] to-transparent opacity-90" />
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#7C3AED] to-transparent opacity-80" />
                      <p className="text-xs font-mono font-bold text-[#C8FF00] uppercase tracking-widest mb-3 relative z-[1]">
                        Question {modalFC.idx + 1} of {modalFC.cards.length}
                      </p>
                      <h1 className="text-2xl font-display font-extrabold tracking-tight text-white text-center px-8 mb-4 leading-tight relative z-[1]"
                        style={{ maxWidth: "80%" }}>
                        {modalFC.cards[modalFC.idx].question}
                      </h1>
                      <p className="text-xs text-white/35 relative z-[1]">tap to reveal answer</p>
                    </div>

                    {/* Back — Answer (SectionSlide) */}
                    <div className="w-full h-full flex absolute inset-0"
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden" as React.CSSProperties["WebkitBackfaceVisibility"],
                        transform: "rotateY(180deg)", background: "#0F0F1A",
                      }}>
                      <div className="w-2 bg-gradient-to-b from-[#C8FF00] via-[#7C3AED] to-[#00D4FF] flex-shrink-0 opacity-90" />
                      <div className="flex-1 bg-[#12121C] flex flex-col justify-center px-10">
                        <p className="text-xs font-mono font-bold text-[#9F67FF] uppercase tracking-widest mb-3">Answer</p>
                        <div className="w-16 h-0.5 bg-[#C8FF00] mb-4 rounded-full shadow-[0_0_12px_rgba(200,255,0,0.35)]" />
                        <p className="text-sm text-white/75 leading-relaxed" style={{ fontFamily: "'DM Sans',sans-serif" }}>
                          {modalFC.cards[modalFC.idx].answer}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Controls — exact SlideCarousel layout */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.08] bg-[#0F0F1A]/98 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setModalFC(prev => prev ? { ...prev, idx: Math.max(0, prev.idx - 1), flipped: false } : null)}
                    disabled={modalFC.idx === 0}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-[#C8FF00] disabled:opacity-25 transition-all">
                    <ChevronLeft size={18} />
                  </button>

                  <div className="flex gap-1">
                    {modalFC.cards.map((_, i) => (
                      <button key={i}
                        onClick={() => setModalFC(prev => prev ? { ...prev, idx: i, flipped: false } : null)}
                        className={cn(
                          "rounded-full transition-all",
                          i === modalFC.idx
                            ? "w-5 h-2 bg-[#C8FF00] shadow-[0_0_12px_rgba(200,255,0,0.35)]"
                            : "w-2 h-2 bg-white/15 hover:bg-white/30"
                        )}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => setModalFC(prev => prev ? { ...prev, idx: Math.min(prev.cards.length - 1, prev.idx + 1), flipped: false } : null)}
                    disabled={modalFC.idx === modalFC.cards.length - 1}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-[#C8FF00] disabled:opacity-25 transition-all">
                    <ChevronRight size={18} />
                  </button>

                  <span className="text-xs text-white/35 ml-1 font-mono">
                    {modalFC.idx + 1} / {modalFC.cards.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { handleFlashcardSave(modalFC.raw); setModalFC(null); }}
                    className="flex items-center gap-1.5 text-xs font-display font-extrabold tracking-tight text-[#C8FF00] hover:bg-[#C8FF00]/10 px-3 py-1.5 rounded-lg transition-all">
                    <BookmarkPlus size={14} /> Save
                  </button>
                  <button
                    onClick={() => {
                      const blob = new Blob([modalFC.raw], { type: "text/plain" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `flashcards-${chapter.chapter_title.replace(/\s+/g, "-")}.txt`;
                      a.click();
                    }}
                    className="flex items-center gap-1.5 text-xs font-display font-extrabold tracking-tight bg-[#C8FF00] text-[#08080F] px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(200,255,0,0.4)] active:scale-95 shadow-[0_0_20px_rgba(200,255,0,0.25)]">
                    <Download size={14} /> Download
                  </button>
                  <button onClick={() => setModalFC(null)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-all">
                    <X size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Saved item viewer modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {viewingItem && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex:50, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(6px)" }}
            onClick={() => setViewingItem(null)}
          >
            <motion.div
              initial={{ opacity:0, scale:0.95, y:12 }}
              animate={{ opacity:1, scale:1,    y:0 }}
              exit={{    opacity:0, scale:0.95, y:12 }}
              transition={{ duration:0.22 }}
              onClick={e => e.stopPropagation()}
              className="flex flex-col"
              style={{ width:"56%", maxHeight:"78vh",
                background:"rgba(255,255,255,0.97)", backdropFilter:"blur(20px)",
                borderRadius:20, overflow:"hidden",
                boxShadow:"0 24px 64px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.9)" }}
            >
              {/* Modal header */}
              <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3.5"
                style={{ borderBottom:"1px solid rgba(15,28,77,0.08)" }}>
                <span className="text-base">📝</span>
                <p className="flex-1 font-display font-bold text-sm truncate" style={{ color:"#0f1c4d" }}>
                  {viewingItem.title}
                </p>
                <button
                  onClick={() => setViewingItem(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-lg transition-colors hover:bg-gray-100"
                  style={{ color:"rgba(15,28,77,0.4)", lineHeight:1 }}
                >
                  ×
                </button>
              </div>

              {/* Modal content */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4"
                style={{ scrollbarWidth:"thin", fontFamily:"'DM Sans', sans-serif", fontSize:15, color:"#0f1c4d", lineHeight:1.7 }}>
                <ReactMarkdown
                  components={{
                    h1: ({children}) => <h1 style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:20, margin:"16px 0 6px", color:"#0f1c4d" }}>{children}</h1>,
                    h2: ({children}) => <h2 style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:18, margin:"14px 0 5px", color:"#0f1c4d" }}>{children}</h2>,
                    h3: ({children}) => <h3 style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:16, margin:"12px 0 4px", color:"#0f1c4d" }}>{children}</h3>,
                    p:  ({children}) => <p  style={{ margin:"6px 0" }}>{children}</p>,
                    li: ({children}) => <li style={{ marginBottom:4 }}>{children}</li>,
                    code: ({children}) => <code style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, background:"rgba(37,99,235,0.08)", color:"#1d4ed8", padding:"1px 5px", borderRadius:4 }}>{children}</code>,
                    pre: ({children}) => <pre style={{ background:"rgba(15,28,77,0.05)", borderRadius:8, padding:"10px 14px", overflowX:"auto", margin:"10px 0" }}>{children}</pre>,
                    strong: ({children}) => <strong style={{ fontWeight:700, color:"#0f1c4d" }}>{children}</strong>,
                  }}
                >{viewingItem.content}</ReactMarkdown>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
