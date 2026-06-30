"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FlashcardDeck, parseFlashcards } from "./FlashcardDeck";
import type { FlashCard } from "./FlashcardDeck";
import { AudioOverviewMessage, type AudioOverviewPayload } from "./AudioOverviewMessage";
import { PodcastLoading, type LoadProgress } from "./PodcastLoading";
import { PodcastStage, type PodcastStageResult } from "./PodcastStage";
import { speakBhavna } from "./bhavnaTts";
import { BlogModal } from "./BlogModal";
import type { BlogPanel } from "./BlogModal";
import { MindMapView } from "./MindMapView";
import type { MindMapNode } from "./MindMapView";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Play, X } from "lucide-react";
import { MessageBubble } from "@/components/playground/MessageBubble";
import type { Message }  from "@/components/playground/useChat";
import ReactMarkdown from "react-markdown";
import { AudioPlayer, type AudioData } from "@/components/playground/AudioPlayer";
import type { Chapter, Profile, OutputType } from "@/types";
import { useClassroomWriter } from "@/lib/chatChannels";

interface Props {
  chapter: Chapter;
  onBack:  () => void;
}

// Local extension: classroom messages may carry a rich audio-overview payload.
type ClassroomMessage = Message & { audioOverview?: AudioOverviewPayload };

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

// Left toolbar tile hotspots. `top` = VISUAL CENTER of the tile (% of viewport),
// measured from the background art; the hotspot div is centred on it via
// translateY(-50%). Single source of truth — the hotspots below map over this,
// so updating the art only means updating these positions (never hand-editing
// individual divs). `debug` is the outline colour shown when DEBUG_ZONES is on.
const TILES = [
  { key:"flashcards",  label:"Flashcards",       active:true,  top:"12.5%", debug:"#f59e0b" },
  { key:"mindmap",     label:"Mind Maps",        active:true,  top:"21.0%", debug:"#a78bfa" },
  { key:"blogs",       label:"Blogs",            active:true,  top:"30.0%", debug:"#60a5fa" },
  { key:"explainer",   label:"Explainer Videos", active:true,  top:"38.0%", debug:"#38bdf8" },
  { key:"comic",       label:"Comic Creations",  active:false, top:"46.5%", debug:"#fb7185" },
  { key:"audio",       label:"Audio Overview",   active:true,  top:"55.5%", debug:"#fb923c" },
  { key:"infographic", label:"Infographic",      active:false, top:"63.5%", debug:"#34d399" },
  { key:"podcast",     label:"Audio Podcast",    active:true,  top:"72.0%", debug:"#e879f9" },
  { key:"notes",       label:"Notes",            active:true,  top:"80.0%", debug:"#22c55e" },
] as const;

const TILE_PROMPTS: Record<string, (t: string) => string> = {
  notes: (t) => `Generate comprehensive study notes for "${t}" — CBSE Class 10 Science. Use clear headings, bullet points, key definitions, important equations, and a quick-revision summary. For equations, use plain text format only — no LaTeX. Write fractions as a/b or a ÷ b, use characters like θ, π, °, ±. Examples: sin(90° - θ) = cos(θ), csc(θ) = 1/sin(θ).`,
};

interface FlashcardResult {
  topic:   string;
  subject?: string;
  cards:   FlashCard[];
  saved:   boolean;
}

interface BlogResult {
  topic:         string;
  title:         string;
  subject?:      string;
  panels:        BlogPanel[];
  keyTakeaways:  string[];
  saved:         boolean;
}

interface MindmapResult {
  topic:  string;
  root:   MindMapNode;
  saved:  boolean;
}

const ACCENT     = "#2563eb";
const ACCENT_GLO = "rgba(37,99,235,0.35)";

// Shared mute flag used by the passive Bhavna voice surfaces (welcome panel,
// hint bubble). The podcast-cancel line respects the same toggle.
const HINT_AUDIO_KEY = "bhavna:hintAudio";

// Bhavna's in-character reactions when a kid stops a podcast mid-record. One is
// picked at random so repeat cancels don't repeat the same line.
const PODCAST_CANCEL_LINES = [
  "Aaand… cut!  You hit stop — recording paused!  Time for a brain break?",
  "Okay okay, podcast cancelled! Our guest is taking a quick break too.  does finger guns",
  "Show's off! You hit stop.  Want to try again when you're ready?",
  "Mic dropped!  You stopped the recording.  Nice job listening to yourself!  ",
];

// ── Set to true to see all clickable zone outlines for positioning ─────────────
const DEBUG_ZONES = false;

export function ClassroomArena({ chapter, onBack }: Props) {
  const [profile,    setProfile]    = useState<Profile | null>(null);
  const [input,      setInput]      = useState("");
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [savedItems,   setSavedItems]   = useState<SavedItem[]>([]);
  const [viewingItem,  setViewingItem]  = useState<SavedItem | null>(null);
  const [binDragOver,  setBinDragOver]  = useState(false);
  const [messages,     setMessages]     = useState<ClassroomMessage[]>([]);
  const [isStreaming,  setIsStreaming]  = useState(false);
  const [mode,           setMode]           = useState<"notes" | "videos">("notes");
  const [playingVideo,   setPlayingVideo]   = useState<VideoItem | null>(null);
  const [flashcardCards, setFlashcardCards] = useState<FlashCard[] | null>(null);
  const [flashcardRaw,   setFlashcardRaw]   = useState("");
  const [audioOverviewMode, setAudioOverviewMode] = useState(false);
  const [podcastProgress, setPodcastProgress] = useState<LoadProgress | null>(null);
  const [podcast,         setPodcast]         = useState<PodcastStageResult | null>(null);
  const podcastAbort     = useRef<AbortController | null>(null);
  const lastPodcastTopic = useRef("");
  const bottomRef           = useRef<HTMLDivElement>(null);
  const taRef               = useRef<HTMLTextAreaElement>(null);
  const pendingFlashcardRef = useRef(false);
  const wasStreamingRef     = useRef(false);
  const messagesRef         = useRef<ClassroomMessage[]>([]);
  const [flashcardResults, setFlashcardResults] = useState<Record<string, FlashcardResult>>({});
  const [flashcardModalData, setFlashcardModalData] = useState<{ topic: string; subject?: string; cards: FlashCard[] } | null>(null);
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [blogMode,      setBlogMode]      = useState(false);
  const [mindmapMode,   setMindmapMode]   = useState(false);
  const [blogResults,   setBlogResults]   = useState<Record<string, BlogResult>>({});
  const [blogModalData, setBlogModalData] = useState<{ topic: string; title: string; subject?: string; panels: BlogPanel[]; keyTakeaways?: string[] } | null>(null);
  const [mindmapResults,   setMindmapResults]   = useState<Record<string, MindmapResult>>({});
  const [mindmapModalData, setMindmapModalData] = useState<{ topic: string; root: MindMapNode } | null>(null);
  const [panelFilter,   setPanelFilter]   = useState<"notes" | "flashcards" | "blog" | "mindmap">("notes");

  const classroomWriter = useClassroomWriter();
  useEffect(() => {
    classroomWriter.setChapter(chapter.chapter_title, chapter.subject);
  }, [chapter.chapter_title, chapter.subject]);

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
          filtered.map((c: any) => {
            const tags = Array.isArray(c.tags) ? c.tags as string[] : [];
            const isFC   = tags.includes("flashcards");
            const isBlog = tags.includes("blog");
            let preview = (c.content as string).replace(/^#{1,3}\s+.+$/m, "").replace(/[#*`_]/g, "").trim().slice(0, 60);
            if (isFC) {
              try {
                const j = JSON.parse(c.content);
                preview = `${Array.isArray(j.cards) ? j.cards.length : "?"} cards`;
              } catch { preview = "flashcards"; }
            } else if (isBlog) {
              try {
                const j = JSON.parse(c.content);
                preview = `${Array.isArray(j.panels) ? j.panels.length : "?"} panels`;
              } catch { preview = "blog"; }
            }
            return { id: c.id, title: c.title, preview, content: c.content, tags, createdAt: new Date(c.created_at).getTime() };
          })
        );
      })
      .catch(() => {});
  }, [chapter.chapter_title]);

  // Tell the floating Bhavna standee (TeacherCharacter) to stand down while a
  // podcast is generating OR playing — otherwise its idle nudge bubble fires and
  // speaks over the episode audio. Mirrors the validator-panel-open pattern.
  useEffect(() => {
    const active = !!podcast || !!podcastProgress;
    window.dispatchEvent(new Event(active ? "podcast-open" : "podcast-close"));
  }, [podcast, podcastProgress]);

  // Sends to the dedicated classroom chat route (NOT /api/chat)
  const sendMessage = useCallback(async (text: string) => {
    if (!profile || isStreaming || !text.trim()) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user",      content: text, outputType: "text", createdAt: new Date() };
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
  }, [profile, isStreaming, messages, chapter.chapter_title]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // Validates a student-typed topic against this chapter, then generates a
  // flashcard deck (Q/A + illustration per card) for it via the dedicated route
  const handleFlashcardTopic = useCallback(async (topic: string) => {
    if (!profile || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: topic, outputType: "text", createdAt: new Date() };
    const asstId = crypto.randomUUID();
    const loadingMsg: Message = {
      id: asstId, role: "assistant",
      content: `Checking "${topic}" against this chapter and generating flashcards…`,
      outputType: "text", isLoading: true, createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/classroom/flashcards/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ topic, chapterTitle: chapter.chapter_title, subject: chapter.subject }),
      });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json() as { valid: boolean; reason?: string; topic?: string; cards?: FlashCard[] };

      if (!data.valid) {
        setMessages(prev => prev.map(m =>
          m.id === asstId
            ? { ...m, content: data.reason || `That doesn't seem to be part of "${chapter.chapter_title}" — try a topic from this chapter.`, isLoading: false }
            : m
        ));
        return; // stay in flashcard mode so the student can try another topic
      }

      const resolvedTopic = data.topic ?? topic;
      const cards = data.cards ?? [];
      setMessages(prev => prev.map(m =>
        m.id === asstId
          ? { ...m, content: `✅ Generated ${cards.length} flashcard${cards.length !== 1 ? "s" : ""} for ${resolvedTopic}.`, isLoading: false }
          : m
      ));
      setFlashcardResults(prev => ({ ...prev, [asstId]: { topic: resolvedTopic, subject: chapter.subject, cards, saved: false } }));
    } catch (e) {
      console.error("[flashcards/generate]", e);
      setMessages(prev => prev.map(m =>
        m.id === asstId ? { ...m, content: "Sorry, couldn't generate flashcards. Please try again.", isLoading: false } : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }, [profile, isStreaming, chapter.chapter_title, chapter.subject]);

  // Validates a student-typed topic, then generates an illustrated comic-strip blog for it
  const handleBlogTopic = useCallback(async (topic: string) => {
    if (!profile || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: topic, outputType: "text", createdAt: new Date() };
    const asstId = crypto.randomUUID();
    const loadingMsg: Message = {
      id: asstId, role: "assistant",
      content: `Creating an illustrated blog for "${topic}"… generating panels and images, this may take a minute.`,
      outputType: "text", isLoading: true, createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/classroom/blog/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ topic, chapterTitle: chapter.chapter_title, subject: chapter.subject }),
      });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json() as { valid: boolean; reason?: string; topic?: string; title?: string; panels?: BlogPanel[]; keyTakeaways?: string[] };

      if (!data.valid) {
        setMessages(prev => prev.map(m =>
          m.id === asstId
            ? { ...m, content: data.reason || `That doesn't seem to be part of "${chapter.chapter_title}" — try a topic from this chapter.`, isLoading: false }
            : m
        ));
        return;
      }

      const resolvedTopic  = data.topic ?? topic;
      const resolvedTitle  = data.title ?? resolvedTopic;
      const panels         = data.panels ?? [];
      const keyTakeaways   = data.keyTakeaways ?? [];
      setMessages(prev => prev.map(m =>
        m.id === asstId
          ? { ...m, content: `✅ Created "${resolvedTitle}" — ${panels.length} illustrated panel${panels.length !== 1 ? "s" : ""} ready.`, isLoading: false }
          : m
      ));
      setBlogResults(prev => ({ ...prev, [asstId]: { topic: resolvedTopic, title: resolvedTitle, subject: chapter.subject, panels, keyTakeaways, saved: false } }));
    } catch (e) {
      console.error("[blog/generate]", e);
      setMessages(prev => prev.map(m =>
        m.id === asstId ? { ...m, content: "Sorry, couldn't create the blog. Please try again.", isLoading: false } : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }, [profile, isStreaming, chapter.chapter_title, chapter.subject]);

  // Validates topic + generates a mindmap tree via /api/classroom/mindmap/generate
  const handleMindmapTopic = useCallback(async (topic: string) => {
    if (!profile || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: topic, outputType: "text", createdAt: new Date() };
    const asstId = crypto.randomUUID();
    const loadingMsg: Message = {
      id: asstId, role: "assistant",
      content: `Building a mind map for "${topic}"… mapping concepts and connections.`,
      outputType: "text", isLoading: true, createdAt: new Date(),
    };
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/classroom/mindmap/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ topic, chapterTitle: chapter.chapter_title, subject: chapter.subject }),
      });
      if (!res.ok) throw new Error(await res.text());

      const data = await res.json() as { valid: boolean; reason?: string; topic?: string; root?: MindMapNode };

      if (!data.valid) {
        setMessages(prev => prev.map(m =>
          m.id === asstId
            ? { ...m, content: data.reason || `That doesn't seem to be part of "${chapter.chapter_title}" — try a topic from this chapter.`, isLoading: false }
            : m
        ));
        return;
      }

      const resolvedTopic = data.topic ?? topic;
      const root = data.root!;
      setMessages(prev => prev.map(m =>
        m.id === asstId
          ? { ...m, content: `🧠 Mind map ready for "${resolvedTopic}" — click Open to explore!`, isLoading: false }
          : m
      ));
      setMindmapResults(prev => ({ ...prev, [asstId]: { topic: resolvedTopic, root, saved: false } }));
    } catch (e) {
      console.error("[mindmap/generate]", e);
      setMessages(prev => prev.map(m =>
        m.id === asstId ? { ...m, content: "Sorry, couldn't generate the mind map. Please try again.", isLoading: false } : m
      ));
    } finally {
      setIsStreaming(false);
    }
  }, [profile, isStreaming, chapter.chapter_title, chapter.subject]);

  // Persists a generated mindmap to My Creations
  const handleMindmapSave = useCallback((messageId: string) => {
    const result = mindmapResults[messageId];
    if (!result || result.saved) return;

    const { topic, root } = result;
    const title   = `Mind Map: ${topic}`;
    const content = JSON.stringify({ topic, root });
    const tempId  = crypto.randomUUID();

    setMindmapResults(prev => ({ ...prev, [messageId]: { ...prev[messageId], saved: true } }));
    setSavedItems(prev => [
      { id: tempId, title, preview: "mind map", content, tags: ["classroom", chapter.chapter_title, "mindmap"], createdAt: Date.now() },
      ...prev,
    ].slice(0, 10));
    fetch("/api/creations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, type: "chat", output_type: "text", content,
        tags: ["classroom", chapter.chapter_title, "mindmap"],
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.creation?.id) {
          setSavedItems(prev => prev.map(item => item.id === tempId ? { ...item, id: data.creation.id } : item));
        }
      })
      .catch(() => {});
  }, [chapter.chapter_title, mindmapResults]);

  // Persists a generated blog to My Creations
  const handleBlogSave = useCallback((messageId: string) => {
    const result = blogResults[messageId];
    if (!result || result.saved) return;

    const { topic, title, panels, keyTakeaways } = result;
    const preview = `${panels.length} panel${panels.length !== 1 ? "s" : ""}`;
    const content = JSON.stringify({ topic, title, panels, keyTakeaways });
    const tempId  = crypto.randomUUID();

    setBlogResults(prev => ({ ...prev, [messageId]: { ...prev[messageId], saved: true } }));
    setSavedItems(prev => [
      { id: tempId, title, preview, content, tags: ["classroom", chapter.chapter_title, "blog"], createdAt: Date.now() },
      ...prev,
    ].slice(0, 10));
    fetch("/api/creations", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        title, type: "chat", output_type: "text", content,
        tags: ["classroom", chapter.chapter_title, "blog"],
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.creation?.id) {
          setSavedItems(prev => prev.map(item => item.id === tempId ? { ...item, id: data.creation.id } : item));
        }
      })
      .catch(() => {});
  }, [chapter.chapter_title, blogResults]);

  // Persist generated audio (overview/podcast) to creations. The creations
  // schema only allows type ∈ story|code|art|quiz|chat|mixed (no "audio") and
  // has no file_url column, so we save as type:"chat" + output_type:"audio"
  // with the playable URL embedded in content JSON. type:"chat" also matches
  // the ?type=chat mount-reload filter, so saved audio reloads on return.
  const saveAudioCreation = useCallback((title: string, content: string, kind: "audio" | "podcast") => {
    const tempId = crypto.randomUUID();
    const preview = kind === "podcast" ? "Podcast episode" : "Audio overview";
    setSavedItems(prev => [
      { id: tempId, title, preview, content, tags: ["classroom", chapter.chapter_title, kind], createdAt: Date.now() },
      ...prev,
    ].slice(0, 10));
    fetch("/api/creations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, type: "chat", output_type: "audio", content,
        tags: ["classroom", chapter.chapter_title, kind],
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.creation?.id) {
          setSavedItems(prev => prev.map(item => item.id === tempId ? { ...item, id: data.creation.id } : item));
          // Lightweight save confirmation for the podcast: a transient Bhavna
          // bubble that auto-clears after 3s. NOT voiced: the save fires exactly
          // as the podcast stage opens and starts playing, so speaking would talk
          // over the episode — and the bubble sits behind the fullscreen stage
          // anyway, so the student sees it only after they close the stage.
          if (kind === "podcast") {
            const bubbleId = crypto.randomUUID();
            const line = "Saved that one for you!";
            setMessages(prev => [...prev, {
              id: bubbleId, role: "assistant", content: line, outputType: "text", createdAt: new Date(),
            }]);
            setTimeout(() => setMessages(prev => prev.filter(m => m.id !== bubbleId)), 3000);
          }
        }
      })
      .catch(() => {});
  }, [chapter.chapter_title]);

  // Generates an audio overview and renders it as a chat message (loading →
  // audio payload, or a funny off-topic quip). Declared before `send` because
  // `send` depends on it.
  const runOverview = useCallback(async (focus?: string) => {
    const loadingId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: loadingId, role: "assistant", outputType: "text",
      content: "🎙️ Recording your overview…", isLoading: true, createdAt: new Date(),
    } as ClassroomMessage]);
    try {
      const r = await fetch("/api/classroom/audio-overview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterTitle: chapter.chapter_title, focus }),
      });
      if (!r.ok) throw new Error("bad status");
      const data = await r.json();

      if (data.offTopic) {
        setMessages(prev => prev.map(m => m.id === loadingId
          ? { ...m, content: data.quip, isLoading: false } : m));
        return;
      }

      const payload: AudioOverviewPayload = {
        audioUrl: data.audioUrl, title: data.title, script: data.script,
        words: data.words ?? [], formulas: data.formulas ?? [], keyPoints: data.keyPoints ?? [],
        table: data.table ?? null,
      };
      setMessages(prev => prev.map(m => m.id === loadingId
        ? ({ ...m, content: data.title, isLoading: false, outputType: "audio", audioOverview: payload } as ClassroomMessage)
        : m));
      // Shape must match AudioData consumed by My Creations / AudioPlayer:
      // { url, script: { narrator_text, dialogues[] } } — not { audioUrl, script:string }.
      saveAudioCreation(
        data.title,
        JSON.stringify({ url: data.audioUrl, script: { narrator_text: data.script, dialogues: [] } }),
        "audio",
      );
    } catch {
      setMessages(prev => prev.map(m => m.id === loadingId
        ? { ...m, content: "Couldn't make your overview — please try again.", isLoading: false } : m));
    }
  }, [chapter.chapter_title, saveAudioCreation]);

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || !profile || isStreaming) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
    if (audioOverviewMode) {
      // Sticky: every message is an overview until the student exits the mode.
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: "user", outputType: "text",
        content: t, createdAt: new Date(),
      } as ClassroomMessage]);
      await runOverview(t);
      return;
    }
    if (flashcardMode)  await handleFlashcardTopic(t);
    else if (blogMode)  await handleBlogTopic(t);
    else if (mindmapMode) await handleMindmapTopic(t);
    else await sendMessage(t);
  }, [profile, isStreaming, sendMessage, audioOverviewMode, runOverview, flashcardMode, handleFlashcardTopic, blogMode, handleBlogTopic, mindmapMode, handleMindmapTopic]);

  const runPodcast = useCallback(async (topic: string) => {
    lastPodcastTopic.current = topic;
    podcastAbort.current?.abort();              // cancel any prior run
    const ctrl = new AbortController();
    podcastAbort.current = ctrl;
    setPodcastProgress({ stage: "persona" });
    try {
      const r = await fetch("/api/classroom/podcast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, chapterTitle: chapter.chapter_title }),
        signal: ctrl.signal,
      });
      if (!r.body) { setPodcastProgress({ stage: "error", message: "No response" }); return; }
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split("\n\n"); buf = frames.pop() ?? "";
        for (const f of frames) {
          const line = f.trim(); if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.stage === "done") {
            setPodcast(evt as PodcastStageResult); setPodcastProgress(null);
            // Save in AudioPlayer's AudioData shape ({ url, script }) so a saved
            // podcast is fully playable from My Creations, not just stored.
            saveAudioCreation(
              evt.title,
              JSON.stringify({
                url: evt.audioUrl,
                script: {
                  narrator_text: "",
                  dialogues: (evt.transcript ?? []).map((t: { speaker: string; text: string }) => ({
                    character: t.speaker,
                    text: t.text,
                  })),
                },
                // Future-proofing for full immersive replay: AudioPlayer ignores
                // these, but a later My Creations renderer can rebuild PodcastStage
                // (per-line segments + guest) without regenerating the episode.
                segments: evt.segments ?? [],
                persona: evt.persona,
              }),
              "podcast",
            );
          }
          else setPodcastProgress(evt as LoadProgress);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;   // user cancelled — cancelPodcast handles the UX
      setPodcastProgress({ stage: "error", message: (e as Error).message });
    } finally {
      if (podcastAbort.current === ctrl) podcastAbort.current = null;
    }
  }, [chapter.chapter_title, saveAudioCreation]);

  // Stop a recording mid-flight: true-abort the stream (no wasted ElevenLabs
  // TTS), drop the overlay, and let Bhavna react in one in-character chat bubble
  // (voiced unless the shared hint-audio mute is on).
  const cancelPodcast = useCallback(() => {
    podcastAbort.current?.abort();
    podcastAbort.current = null;
    setPodcastProgress(null);

    const line = PODCAST_CANCEL_LINES[Math.floor(Math.random() * PODCAST_CANCEL_LINES.length)];
    setMessages(prev => [...prev, {
      id:         crypto.randomUUID(),
      role:       "assistant",
      content:    line,
      outputType: "text",
      createdAt:  new Date(),
    }]);

    const muted = typeof window !== "undefined" && localStorage.getItem(HINT_AUDIO_KEY) === "off";
    if (!muted) {
      const ctrl = new AbortController();
      speakBhavna(line, ctrl.signal).catch(() => { /* autoplay block / abort — silent */ });
    }
  }, []);

  // Open a saved item from the My Creations panel. Podcasts saved with per-line
  // segments + persona relaunch the full immersive PodcastStage (standees,
  // speaker highlight, skip, mic). Everything else — notes, audio overviews, and
  // older podcast saves without segments — opens the read/play modal.
  const openSavedItem = useCallback((item: SavedItem) => {
    if (item.tags.includes("podcast")) {
      try {
        const parsed = JSON.parse(item.content);
        if (Array.isArray(parsed?.segments) && parsed.segments.length && parsed?.persona) {
          setPodcast({
            title: item.title,
            persona: parsed.persona,
            segments: parsed.segments,
            transcript: parsed.segments.map(
              (s: { speaker: "host" | "guest"; text: string }) => ({ speaker: s.speaker, text: s.text }),
            ),
          });
          return;
        }
      } catch { /* not replayable — fall through to the modal */ }
    }
    setViewingItem(item);
  }, []);

  // Error-state retry: re-run the podcast with the same topic.
  const retryPodcast = useCallback(() => {
    runPodcast(lastPodcastTopic.current || chapter.chapter_title);
  }, [runPodcast, chapter.chapter_title]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const handleTileClick = useCallback((key: string) => {
    if (!profile || isStreaming) return;
    setActiveHint(key);
    setTimeout(() => setActiveHint(null), 900);

    if (key === "flashcards") {
      setMode("notes");
      const turningOn = !flashcardMode;
      setFlashcardMode(turningOn);
      if (turningOn) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: "assistant",
          content: `✏️ Flashcard mode is on — type a topic from "${chapter.chapter_title}" below and I'll build a flashcard deck for it.`,
          outputType: "text", createdAt: new Date(),
        }]);
      }
      return;
    }

    const buildPrompt = TILE_PROMPTS[key];
    if (!buildPrompt) return;
    sendMessage(buildPrompt(chapter.chapter_title));
  }, [profile, isStreaming, sendMessage, chapter.chapter_title, flashcardMode]);

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

  // Called by a flashcard result card's "Save Flashcards" button
  const handleFlashcardSave = useCallback((messageId: string) => {
    const result = flashcardResults[messageId];
    if (!result || result.saved) return;

    const { topic, cards } = result;
    const title   = `Flashcards: ${topic}`;
    const preview = `${cards.length} flashcard${cards.length !== 1 ? "s" : ""}`;
    const content = JSON.stringify({ topic, cards });
    const tempId  = crypto.randomUUID();

    setFlashcardResults(prev => ({ ...prev, [messageId]: { ...prev[messageId], saved: true } }));
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
  }, [chapter.chapter_title, flashcardResults]);

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
        style={{ top:"1.1vmin", left:"50%", transform:"translateX(-50%)", zIndex:25 }}>
        <div className="flex flex-col items-center"
          style={{ padding:"0.9vmin 2.2vmin",
            borderRadius:"1.8vmin",
            background:"rgba(0,0,0,0.55)", backdropFilter:"blur(12px)",
            border:"1px solid rgba(255,255,255,0.15)" }}>
          <p className="font-display font-black whitespace-nowrap"
            style={{ color:"#fff", letterSpacing:"0.01em", fontSize:"1.8vmin" }}>
            {chapter.chapter_title}
          </p>
          <p className="font-mono text-center"
            style={{ color:"rgba(255,255,255,0.45)", fontSize:"1.2vmin", marginTop:"0.2vmin" }}>
            CBSE Class 10 · Science
          </p>
        </div>
      </div>

      {/* ── Toolbar hotspots — mapped from TILES so click targets always track
              the background art. Each div is centred on its tile via
              translateY(-50%). Inactive tiles (comic, infographic) show a
              Bhavna "coming soon" teaser instead of a mode. ──────────────────── */}
      {TILES.map(({ key, top, active, debug }) => (
        <div
          key={key}
          onClick={() => {
            switch (key) {
              case "notes": {
                if (!flashcardMode && !blogMode && !mindmapMode && panelFilter === "notes" && mode === "notes") return;
                setMode("notes"); setPanelFilter("notes"); setFlashcardMode(false); setBlogMode(false); setMindmapMode(false); setAudioOverviewMode(false); setMessages([]);
                break;
              }
              case "flashcards": {
                if (flashcardMode) return;
                setMode("notes"); setPanelFilter("flashcards");
                setBlogMode(false); setMindmapMode(false); setAudioOverviewMode(false); setFlashcardMode(true);
                setMessages([{
                  id: crypto.randomUUID(), role: "assistant",
                  content: `✏️ Flashcard mode is on — type a topic from "${chapter.chapter_title}" below and I'll build a flashcard deck for it.`,
                  outputType: "text", createdAt: new Date(),
                }]);
                break;
              }
              case "mindmap": {
                if (mindmapMode) return;
                setMode("notes"); setPanelFilter("mindmap");
                setFlashcardMode(false); setBlogMode(false); setAudioOverviewMode(false); setMindmapMode(true);
                setMessages([{
                  id: crypto.randomUUID(), role: "assistant",
                  content: `🧠 Mind Map mode is on — type a topic from "${chapter.chapter_title}" below and I'll build an interactive mind map for it.`,
                  outputType: "text", createdAt: new Date(),
                }]);
                break;
              }
              case "blogs": {
                if (blogMode) return;
                setMode("notes"); setPanelFilter("blog");
                setFlashcardMode(false); setMindmapMode(false); setAudioOverviewMode(false); setBlogMode(true);
                setMessages([{
                  id: crypto.randomUUID(), role: "assistant",
                  content: `🎨 Blog mode is on — type a topic from "${chapter.chapter_title}" below and I'll create an illustrated comic blog for it.`,
                  outputType: "text", createdAt: new Date(),
                }]);
                break;
              }
              case "explainer": {
                if (mode === "videos") return;
                setFlashcardMode(false); setBlogMode(false); setMindmapMode(false); setAudioOverviewMode(false);
                setMode("videos");
                break;
              }
              case "audio": {
                if (isStreaming) return;
                if (audioOverviewMode) {
                  setAudioOverviewMode(false);
                  setMessages(prev => [...prev, {
                    id: crypto.randomUUID(), role: "assistant", outputType: "text",
                    content: "✅ Exited Audio Overview mode — back to normal chat.",
                    createdAt: new Date(),
                  } as ClassroomMessage]);
                  return;
                }
                setMode("notes");
                setAudioOverviewMode(true);
                setMessages(prev => [...prev, {
                  id: crypto.randomUUID(), role: "assistant", outputType: "text",
                  content: `🎧 **Audio Overview mode is ON.** Every message becomes an overview of *${chapter.chapter_title}* — the whole chapter, or any subtopic. (This chapter only 😄) Tap Audio Overview again to exit.`,
                  createdAt: new Date(),
                } as ClassroomMessage]);
                break;
              }
              case "podcast": {
                setAudioOverviewMode(false);
                runPodcast(input.trim() || chapter.chapter_title);
                setInput("");
                break;
              }
              case "comic": {
                // Coming soon — Bhavna teases it (curiosity hook for 6–16 yr olds)
                setMessages(prev => [...prev, {
                  id: crypto.randomUUID(), role: "assistant", outputType: "text",
                  content: `🦸 **Comic Creations is coming soon!** Picture your whole chapter turned into a comic strip — superhero scientists, sneaky math villains, and cliff-hanger plot twists made of pure physics. 👀 Keep your eyes peeled… this one's going to be *legendary*.`,
                  createdAt: new Date(),
                } as ClassroomMessage]);
                break;
              }
              case "infographic": {
                // Coming soon teaser
                setMessages(prev => [...prev, {
                  id: crypto.randomUUID(), role: "assistant", outputType: "text",
                  content: `📊 **Infographics are coming soon!** Soon you'll snap any topic into one colourful, scroll-stopping cheat-sheet you'll actually want on your wall. Stay tuned! ✨`,
                  createdAt: new Date(),
                } as ClassroomMessage]);
                break;
              }
            }
          }}
          className="absolute"
          style={{
            left: "1%", top, width: "13%", height: "7%",
            transform: "translateY(-50%)", zIndex: 20, cursor: "pointer",
            ...(DEBUG_ZONES ? { border: `2px solid ${debug}`, background: `${debug}26`, borderRadius: 6 } : {}),
          }}
          title={`${key} hotspot`}
        >
          {DEBUG_ZONES && (
            <span style={{ position:"absolute", top:2, left:4, fontSize:9, fontWeight:700, color:debug, fontFamily:"monospace", pointerEvents:"none" }}>
              {key.toUpperCase()}{active ? "" : " (soon)"}
            </span>
          )}
        </div>
      ))}

      {/* ── Selected-tile highlight — dark-glass marker over the active mode's
              tile. Tracks whichever mode is on (notes/flashcards/mindmap/blog/
              explainer/audio); podcast is a one-shot action so it has no
              persistent selected state. ──────────────────────────────────────── */}
      {(() => {
        const selectedKey =
          audioOverviewMode                              ? "audio" :
          mode === "videos"                              ? "explainer" :
          flashcardMode                                  ? "flashcards" :
          mindmapMode                                    ? "mindmap" :
          blogMode                                       ? "blogs" :
          (mode === "notes" && panelFilter === "notes")  ? "notes" :
          null;
        if (!selectedKey) return null;
        const tile = TILES.find(t => t.key === selectedKey);
        if (!tile) return null;
        return (
          <motion.div
            className="absolute pointer-events-none"
            style={{
              left:"1.5%", top: `calc(${tile.top} - 0.5%)`, width:"13%", height:"7.7%",
              transform:"translateY(-50%)", zIndex:19, borderRadius:14,
              border:"2px solid rgba(224,177,76,0.95)",
              boxShadow:"0 0 16px rgba(224,177,76,0.60), 0 0 38px rgba(224,177,76,0.26), inset 0 0 12px rgba(224,177,76,0.18)",
            }}
            animate={{ opacity:[0.55,1,0.55] }}
            transition={{ duration:1.8, repeat:Infinity, ease:"easeInOut" }}
          />
        );
      })()}

      {/* ── My Creations / Videos panel — overlaid on left wall panel ─────────── */}
      <div className="absolute overflow-y-auto"
        style={{ left:"17.6%", top:"14%", width:"16.7%", height:"68%",
          zIndex:18, scrollbarWidth:"none" }}>

        <AnimatePresence mode="wait">

          {/* ── NOTES mode ── */}
          {mode === "notes" && (
            <motion.div key="notes-panel"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.18 }}>
              {/* ── Flashcard grid: 2 columns ── */}
              {panelFilter === "flashcards" ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.7vmin", paddingRight:"0.4vmin", paddingBottom:"0.9vmin" }}>
                  {savedItems.filter(item => item.tags.includes("flashcards")).slice(0, 10).map(item => {
                    let firstImageUrl: string | undefined;
                    let cardCount = 0;
                    try {
                      const j = JSON.parse(item.content);
                      firstImageUrl = j.cards?.[0]?.imageUrl;
                      cardCount = Array.isArray(j.cards) ? j.cards.length : 0;
                    } catch {}
                    const topic = item.title.replace(/^Flashcards:\s*/, "");
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity:0, scale:0.92 }}
                        animate={{ opacity:1, scale:1 }}
                        transition={{ duration:0.2 }}
                        onClick={() => {
                          let t = topic; let cards: FlashCard[] = [];
                          try { const j = JSON.parse(item.content); if (Array.isArray(j.cards)) { cards = j.cards; t = j.topic ?? t; } }
                          catch { cards = parseFlashcards(item.content); }
                          if (cards.length > 0) setFlashcardModalData({ topic: t, subject: chapter.subject, cards });
                        }}
                        whileHover={{ scale:1.04, boxShadow:"0 6px 18px rgba(245,166,35,0.3)" }}
                        className="cursor-pointer rounded-xl overflow-hidden"
                        style={{ background:"rgba(255,255,255,0.92)", border:"0.2vmin solid rgba(245,166,35,0.4)", boxShadow:"0 2px 10px rgba(15,28,77,0.08)" }}
                      >
                        {/* Image or placeholder */}
                        <div style={{ width:"100%", aspectRatio:"6/2", overflow:"hidden", background:"#FFF8EC" }}>
                          {firstImageUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={firstImageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                            : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"2.2vmin" }}>🗂️</div>
                          }
                        </div>

                        <div style={{ padding:"0.4vmin 0.6vmin 0.6vmin" }}>
                          <p style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:"1vmin", color:"#0f1c4d",
                            display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", lineHeight:1.3 }}>
                            {topic}
                          </p>
                          {cardCount > 0 && (
                            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"0.9vmin", color:"rgba(245,166,35,0.9)", marginTop:"0.2vmin", fontWeight:700 }}>
                              {cardCount} cards
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : panelFilter === "mindmap" ? (
                /* ── Mindmap grid: 2 columns ── */
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, paddingRight:4, paddingBottom:8 }}>
                  {savedItems.filter(item => item.tags.includes("mindmap")).slice(0, 10).map(item => {
                    const topic = item.title.replace(/^Mind Map:\s*/, "");
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity:0, scale:0.92 }}
                        animate={{ opacity:1, scale:1 }}
                        transition={{ duration:0.2 }}
                        onClick={() => {
                          try {
                            const j = JSON.parse(item.content);
                            if (j.root) setMindmapModalData({ topic: j.topic ?? topic, root: j.root });
                          } catch {}
                        }}
                        whileHover={{ scale:1.04, boxShadow:"0 6px 18px rgba(139,92,246,0.3)" }}
                        className="cursor-pointer rounded-xl overflow-hidden"
                        style={{ background:"rgba(255,255,255,0.92)", border:"2px solid rgba(139,92,246,0.35)", boxShadow:"0 2px 10px rgba(15,28,77,0.08)" }}
                      >
                        <div style={{ width:"100%", aspectRatio:"6/2", overflow:"hidden", background:"linear-gradient(135deg,#1e1b4b,#0d1535)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>
                          🧠
                        </div>
                        <div style={{ padding:"4px 5px 5px" }}>
                          <p style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9, color:"#0f1c4d",
                            display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", lineHeight:1.3 }}>
                            {topic}
                          </p>
                          <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:"rgba(139,92,246,0.9)", marginTop:2, fontWeight:700 }}>
                            mind map
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : panelFilter === "blog" ? (
                /* ── Blog grid: 2 columns ── */
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, paddingRight:4, paddingBottom:8 }}>
                  {savedItems.filter(item => item.tags.includes("blog")).slice(0, 10).map(item => {
                    let firstImageUrl: string | undefined;
                    let panelCount = 0;
                    try {
                      const j = JSON.parse(item.content);
                      firstImageUrl = j.panels?.[0]?.imageUrl;
                      panelCount = Array.isArray(j.panels) ? j.panels.length : 0;
                    } catch {}
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity:0, scale:0.92 }}
                        animate={{ opacity:1, scale:1 }}
                        transition={{ duration:0.2 }}
                        onClick={() => {
                          try {
                            const j = JSON.parse(item.content);
                            if (Array.isArray(j.panels) && j.panels.length > 0) {
                              setBlogModalData({ topic: j.topic ?? item.title, title: j.title ?? item.title, subject: chapter.subject, panels: j.panels, keyTakeaways: j.keyTakeaways });
                            }
                          } catch {}
                        }}
                        whileHover={{ scale:1.04, boxShadow:"0 6px 18px rgba(37,99,235,0.3)" }}
                        className="cursor-pointer rounded-xl overflow-hidden"
                        style={{ background:"rgba(255,255,255,0.92)", border:"2px solid rgba(37,99,235,0.35)", boxShadow:"0 2px 10px rgba(15,28,77,0.08)" }}
                      >
                        <div style={{ width:"100%", aspectRatio:"6/2", overflow:"hidden", background:"#EFF6FF" }}>
                          {firstImageUrl
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={firstImageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                            : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🎨</div>
                          }
                        </div>
                        <div style={{ padding:"4px 5px 5px" }}>
                          <p style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:9, color:"#0f1c4d",
                            display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden", lineHeight:1.3 }}>
                            {item.title}
                          </p>
                          {panelCount > 0 && (
                            <p style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:"rgba(37,99,235,0.8)", marginTop:2, fontWeight:700 }}>
                              {panelCount} panels
                            </p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                /* ── Notes list: full-width vertical ── */
                <AnimatePresence>
                  {savedItems.filter(item => !item.tags.includes("flashcards") && !item.tags.includes("blog") && !item.tags.includes("mindmap")).map(item => (
                    <div key={item.id} draggable
                      onDragStart={(e: React.DragEvent<HTMLDivElement>) => {
                        e.dataTransfer.setData("application/classroom-item", item.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}>
                      <motion.div
                        initial={{ opacity:0, y:-8, scale:0.95 }}
                        animate={{ opacity:1, y:0, scale:1 }}
                        transition={{ duration:0.25 }}
                        onClick={() => openSavedItem(item)}
                        className="cursor-grab"
                        whileHover={{ scale:1.02, boxShadow:"0 4px 16px rgba(37,99,235,0.2)" }}
                        style={{ borderRadius:"1.3vmin", padding:"1.3vmin", marginBottom:"0.9vmin",
                          background:"rgba(255,255,255,0.88)", border:"1px solid rgba(37,99,235,0.2)", boxShadow:"0 2px 12px rgba(15,28,77,0.1)" }}>
                        <div className="w-full rounded-full"
                          style={{ height:"0.4vmin", marginBottom:"0.9vmin", background:"linear-gradient(90deg,#2563eb,#7c3aed)" }} />
                        <p className="font-bold leading-snug"
                          style={{ color:"#0f1c4d", fontSize:"1.3vmin", display:"-webkit-box", WebkitLineClamp:3, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                          {item.title}
                        </p>
                      </motion.div>
                    </div>
                  ))}
                </AnimatePresence>
              )}
              {savedItems.filter(item =>
                panelFilter === "flashcards" ? item.tags.includes("flashcards") :
                panelFilter === "blog"       ? item.tags.includes("blog") :
                panelFilter === "mindmap"    ? item.tags.includes("mindmap") :
                !item.tags.includes("flashcards") && !item.tags.includes("blog") && !item.tags.includes("mindmap")
              ).length === 0 && (
                <p className="text-[10px] text-center pt-3 opacity-30" style={{ color:"#0f1c4d" }}>
                  {panelFilter === "flashcards" ? "Saved flashcard\ndecks appear here" :
                   panelFilter === "blog"       ? "Saved blogs\nappear here" :
                   panelFilter === "mindmap"    ? "Saved mind maps\nappear here" :
                   "Saved notes\nappear here"}
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
                  className="overflow-hidden cursor-pointer"
                  whileHover={{ scale:1.03, boxShadow:"0 6px 20px rgba(37,99,235,0.28)" }}
                  style={{ borderRadius:"1.3vmin", marginBottom:"0.9vmin", background:"rgba(255,255,255,0.92)",
                    border:"1px solid rgba(37,99,235,0.2)",
                    boxShadow:"0 2px 12px rgba(15,28,77,0.1)" }}>
                  {/* Video thumbnail */}
                  <div className="relative w-full" style={{ aspectRatio:"16/9", background:"#0a0f1e", maxHeight:"8vmin", overflow:"hidden" }}>
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
                      <div className="rounded-full flex items-center justify-center"
                        style={{ width:"3.6vmin", height:"3.6vmin", background:"rgba(37,99,235,0.9)",
                          boxShadow:"0 0 16px rgba(37,99,235,0.7)" }}>
                        <Play className="text-white" style={{ width:"1.8vmin", height:"1.8vmin", marginLeft:"0.2vmin" }} />
                      </div>
                    </div>
                  </div>
                  {/* Title */}
                  <div style={{ padding:"0.9vmin 1.1vmin" }}>
                    <div className="w-full rounded-full" style={{ height:"0.2vmin", marginBottom:"0.7vmin",
                      background:"linear-gradient(90deg,#2563eb,#7c3aed)" }} />
                    <p className="font-bold leading-snug" style={{ color:"#0f1c4d", fontSize:"1.2vmin" }}>
                      {vid.title}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Dustbin — drop a note card here to delete it ──────────────────── */}
      <div
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setBinDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setBinDragOver(false); }}
        onDrop={e => {
          e.preventDefault();
          setBinDragOver(false);
          const id = e.dataTransfer.getData("application/classroom-item");
          if (!id) return;
          setSavedItems(prev => prev.filter(item => item.id !== id));
          fetch("/api/creations", {
            method:  "DELETE",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ id }),
          }).catch(() => {});
        }}
        style={{
          position: "absolute",
          bottom: "2%",
          left:   "18%",
          width:  "6.5%",
          zIndex: 18,
          display: "flex",
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
        {binDragOver && (
          <div style={{
            position: "absolute", bottom: "50%", left: "50%", transform: "translateX(-50%)",
            background: "rgba(8,4,22,0.92)", border: "1px solid rgba(255,80,80,0.5)",
            borderRadius: 10, padding: "4px 10px", whiteSpace: "nowrap",
            fontSize: 10, fontWeight: 700, color: "rgba(255,120,120,1)",
            boxShadow: "0 0 16px rgba(255,80,80,0.4)", backdropFilter: "blur(8px)",
            pointerEvents: "none",
          }}>
            Drop to delete
          </div>
        )}
      </div>

      {/* ── Dustbin — drop a note card here to delete it ──────────────────── */}
      <div
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setBinDragOver(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setBinDragOver(false); }}
        onDrop={e => {
          e.preventDefault();
          setBinDragOver(false);
          const id = e.dataTransfer.getData("application/classroom-item");
          if (!id) return;
          setSavedItems(prev => prev.filter(item => item.id !== id));
          fetch("/api/creations", {
            method:  "DELETE",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ id }),
          }).catch(() => {});
        }}
        style={{
          position: "absolute",
          bottom: "2%",
          left:   "18%",
          width:  "6.5%",
          zIndex: 18,
          display: "flex",
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
        {binDragOver && (
          <div style={{
            position: "absolute", bottom: "50%", left: "50%", transform: "translateX(-50%)",
            background: "rgba(8,4,22,0.92)", border: "1px solid rgba(255,80,80,0.5)",
            borderRadius: 10, padding: "4px 10px", whiteSpace: "nowrap",
            fontSize: 10, fontWeight: 700, color: "rgba(255,120,120,1)",
            boxShadow: "0 0 16px rgba(255,80,80,0.4)", backdropFilter: "blur(8px)",
            pointerEvents: "none",
          }}>
            Drop to delete
          </div>
        )}
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
        style={{ left:"38%", top:"12%", width:"59%", height:"70%", zIndex:15 }}>

        {/* Message list — no background, messages float on the whiteboard */}
        <div className="flex-1 min-h-0 overflow-y-auto"
          style={{ padding:"12px 14px 6px", display:"flex", flexDirection:"column",
            gap:8, scrollbarWidth:"none" }}>

          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full opacity-35 pointer-events-none" style={{ gap:"1.3vmin" }}>
              <span style={{ fontSize:"3.6vmin" }}>✏️</span>
              <p className="text-center font-medium" style={{ color:"#1e3a8a", lineHeight:1.7, fontSize:"1.6vmin" }}>
                Click <strong>Notes</strong> or <strong>Flashcards</strong> on the left,<br/>
                or type a question below
              </p>
            </div>
          )}

          {messages.map(msg => {
            const fcResult   = flashcardResults[msg.id];
            const blogResult = blogResults[msg.id];
            const mmResult   = mindmapResults[msg.id];
            // Audio Overview messages carry a rich payload — render the player +
            // infographic instead of a plain text bubble. (Loading state still
            // falls through to MessageBubble for the "🎙️ Recording…" placeholder.)
            if (msg.audioOverview && !msg.isLoading) {
              return (
                <div key={msg.id} style={{ padding: "2px 0" }}>
                  <AudioOverviewMessage payload={msg.audioOverview} />
                </div>
              );
            }
            return (
              <MessageBubble
                key={msg.id}
                message={msg}
                avatarEmoji={profile.avatar_emoji}
                isStreaming={isStreaming && msg === messages[messages.length - 1]}
                arenaAccent={ACCENT}
                arenaAccentGlow={ACCENT_GLO}
                arenaId={1}
                onSave={
                  fcResult   ? () => handleFlashcardSave(msg.id) :
                  blogResult ? () => handleBlogSave(msg.id) :
                  mmResult   ? () => handleMindmapSave(msg.id) :
                  handleSave
                }
                onOpen={
                  fcResult && !msg.isLoading
                    ? () => setFlashcardModalData({ topic: fcResult.topic, subject: fcResult.subject, cards: fcResult.cards })
                    : blogResult && !msg.isLoading
                      ? () => setBlogModalData({ topic: blogResult.topic, title: blogResult.title, subject: blogResult.subject, panels: blogResult.panels, keyTakeaways: blogResult.keyTakeaways })
                      : mmResult && !msg.isLoading
                        ? () => setMindmapModalData({ topic: mmResult.topic, root: mmResult.root })
                        : undefined
                }
              />
            );
          })}

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

        {/* ── Audio Overview active chip ─────────────────────────────────────── */}
        {audioOverviewMode && (
          <div style={{ flexShrink:0, padding:"0 0.4vmin 0.7vmin" }}>
            <motion.div
              initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
              className="flex items-center rounded-full w-fit"
              style={{ gap:"0.9vmin", padding:"0.7vmin 1.3vmin",
                background:"linear-gradient(180deg, rgba(200,168,75,0.22), rgba(200,168,75,0.10))",
                border:"1px solid rgba(200,168,75,0.55)",
                boxShadow:"0 0 16px rgba(200,168,75,0.35)" }}>
              <motion.span style={{ width:"0.8vmin", height:"0.8vmin", borderRadius:"50%", background:"#C8A84B", display:"inline-block" }}
                animate={{ opacity:[0.4,1,0.4] }} transition={{ duration:1.4, repeat:Infinity }} />
              <span className="font-semibold" style={{ color:"#F4E4B8", fontSize:"1.3vmin" }}>
                🎧 Audio Overview ON — every message becomes an overview
              </span>
              <button
                onClick={() => {
                  setAudioOverviewMode(false);
                  setMessages(prev => [...prev, {
                    id: crypto.randomUUID(), role: "assistant", outputType: "text",
                    content: "✅ Exited Audio Overview mode — back to normal chat.",
                    createdAt: new Date(),
                  } as ClassroomMessage]);
                }}
                className="font-bold rounded-full hover:opacity-80"
                style={{ fontSize:"1.3vmin", marginLeft:"0.2vmin", padding:"0.2vmin 0.9vmin", background:"rgba(200,168,75,0.85)", color:"#1a1206" }}>
                Exit
              </button>
            </motion.div>
          </div>
        )}

        {/* ── Input bar — dark pill, Creator's Room style ────────────────────── */}
        <div style={{ flexShrink:0, padding:"0 0.4vmin 0.9vmin" }}>
          {flashcardMode && (
            <div className="flex items-center justify-between" style={{ padding:"0 0.4vmin 0.7vmin" }}>
              <span
                className="font-bold rounded-full"
                style={{ fontSize:"1.3vmin", padding:"0.4vmin 1.1vmin", background:"rgba(245,166,35,0.16)", border:"1px solid rgba(245,166,35,0.4)", color:"#F5A623", fontFamily:"'DM Sans',sans-serif" }}
              >
                🗂️ Flashcard mode — type a topic from this chapter
              </span>
              <button
                onClick={() => setFlashcardMode(false)}
                className="font-semibold rounded-full transition-colors hover:bg-white/10"
                style={{ fontSize:"1.3vmin", padding:"0.4vmin 1.1vmin", color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans',sans-serif" }}
              >
                Exit
              </button>
            </div>
          )}
          {blogMode && (
            <div className="flex items-center justify-between" style={{ padding:"0 4px 6px" }}>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background:"rgba(37,99,235,0.16)", border:"1px solid rgba(37,99,235,0.4)", color:"#60a5fa", fontFamily:"'DM Sans',sans-serif" }}
              >
                🎨 Blog mode — type a topic from this chapter
              </span>
              <button
                onClick={() => setBlogMode(false)}
                className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors hover:bg-white/10"
                style={{ color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans',sans-serif" }}
              >
                Exit
              </button>
            </div>
          )}
          {mindmapMode && (
            <div className="flex items-center justify-between" style={{ padding:"0 4px 6px" }}>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ background:"rgba(139,92,246,0.16)", border:"1px solid rgba(139,92,246,0.4)", color:"#a78bfa", fontFamily:"'DM Sans',sans-serif" }}
              >
                🧠 Mind Map mode — type a topic from this chapter
              </span>
              <button
                onClick={() => setMindmapMode(false)}
                className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors hover:bg-white/10"
                style={{ color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans',sans-serif" }}
              >
                Exit
              </button>
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:"0.9vmin",
            background:"linear-gradient(180deg, rgba(18,28,72,0.92) 0%, rgba(10,16,52,0.95) 100%)",
            backdropFilter:"blur(24px)",
            borderRadius:"1.8vmin", padding:"1.1vmin 1.3vmin",
            border: flashcardMode ? "1px solid rgba(245,166,35,0.45)" : blogMode ? "1px solid rgba(37,99,235,0.55)" : mindmapMode ? "1px solid rgba(139,92,246,0.55)" : "1px solid rgba(100,140,255,0.25)",
            boxShadow: flashcardMode
              ? "0 0 0 1px rgba(245,166,35,0.12), 0 4px 24px rgba(0,0,50,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
              : blogMode
                ? "0 0 0 1px rgba(37,99,235,0.15), 0 4px 24px rgba(0,0,50,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                : mindmapMode
                  ? "0 0 0 1px rgba(139,92,246,0.15), 0 4px 24px rgba(0,0,50,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"
                  : "0 0 0 1px rgba(100,140,255,0.08), 0 4px 24px rgba(0,0,50,0.4), inset 0 1px 0 rgba(255,255,255,0.1)" }}>

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
              placeholder={
                flashcardMode ? `Type a topic from "${chapter.chapter_title}" for flashcards…` :
                blogMode      ? `Type a topic from "${chapter.chapter_title}" for the illustrated blog…` :
                mindmapMode   ? `Type a topic from "${chapter.chapter_title}" for the mind map…` :
                "Ask anything about this chapter…"
              }
              rows={1}
              disabled={!profile}
              style={{ flex:1, resize:"none", border:"none", outline:"none",
                background:"transparent", fontSize:"1.7vmin", fontWeight:500,
                color:"rgba(255,255,255,0.92)", fontFamily:"inherit",
                lineHeight:1.5, overflowY:"hidden",
                caretColor: flashcardMode ? "#F5A623" : blogMode ? "#60a5fa" : mindmapMode ? "#a78bfa" : ACCENT, userSelect:"text" }}
            />

            <button onClick={() => send(input)} disabled={!canSend}
              style={{ width:"3.8vmin", height:"3.8vmin", borderRadius:"50%", flexShrink:0,
                background: canSend ? `rgba(37,99,235,0.9)` : "rgba(255,255,255,0.08)",
                border:"none", cursor: canSend ? "pointer" : "not-allowed",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"all 0.2s",
                boxShadow: canSend ? `0 0 16px rgba(37,99,235,0.6)` : "none" }}>
              <svg width="1.4vmin" height="1.4vmin" viewBox="0 0 18 18" fill="none">
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

      {/* ── Flashcard deck overlay ──────────────────────────────────────────── */}
      <AnimatePresence>
        {flashcardModalData && (
          <FlashcardDeck
            topic={flashcardModalData.topic}
            subject={flashcardModalData.subject}
            cards={flashcardModalData.cards}
            onClose={() => setFlashcardModalData(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Blog/comic overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {blogModalData && (
          <BlogModal
            topic={blogModalData.topic}
            title={blogModalData.title}
            subject={blogModalData.subject}
            panels={blogModalData.panels}
            keyTakeaways={blogModalData.keyTakeaways}
            onClose={() => setBlogModalData(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Mind Map overlay ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {mindmapModalData && (
          <MindMapView
            topic={mindmapModalData.topic}
            root={mindmapModalData.root}
            onClose={() => setMindmapModalData(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Audio Overview now renders as an in-chat message (AudioOverviewMessage).
             Podcast overlays remain below. ──────────────────────────────────── */}
      {podcastProgress && (
        <PodcastLoading
          progress={podcastProgress}
          onCancel={cancelPodcast}
          onRetry={retryPodcast}
        />
      )}
      {podcast && <PodcastStage result={podcast} onClose={() => setPodcast(null)} />}

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
                {(() => {
                  // Audio saves (podcast + Audio Overview) store JSON, not markdown.
                  // Detect them and render the player instead of dumping raw JSON.
                  let audioData: AudioData | null = null;
                  try {
                    const parsed = JSON.parse(viewingItem.content);
                    const url = parsed?.url ?? parsed?.audioUrl;   // tolerate legacy audioUrl saves
                    if (url && parsed?.script) audioData = { url, script: parsed.script };
                  } catch { /* not JSON — fall through to markdown */ }
                  if (audioData) return <AudioPlayer data={audioData} />;
                  return (
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
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
