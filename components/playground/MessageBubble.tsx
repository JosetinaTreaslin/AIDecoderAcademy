"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { AudioPlayer, type AudioData } from "./AudioPlayer";
import { SlideCarousel, type SlideData } from "./SlideCarousel";
import VideoPlayer from "./VideoPlayer";

interface VideoData {
  videoUrl:         string;
  title?:           string;
  durationSeconds?: number;
  shotCount?:       number;
  modelUsed?:       string;
  jobId?:           string;
}
import type { Message } from "./useChat";
import type { OutputType } from "@/types";

interface Props {
  message:      Message;
  avatarEmoji:  string;
  isStreaming?: boolean;
  onSave?:      (content: string, type: OutputType) => void;
  onOpen?:      () => void;
  extra?:       React.ReactNode;
  // Arena theme
  arenaAccent?:     string;  // e.g. "#7C3AED"
  arenaAccentGlow?: string;  // e.g. "rgba(124,58,237,0.3)"
  arenaId?:         number;
}

// Per output-type loading colours (unchanged)
const COLOR_MAP: Record<string, { ring: string; bg: string; bar: string; text: string }> = {
  cyan:   { ring: "border-[#00D4FF]/50", bg: "bg-[#060e18]", bar: "bg-[#00D4FF] shadow-[0_0_14px_rgba(0,212,255,0.45)]",  text: "text-[#7AEFFF]"  },
  pink:   { ring: "border-[#FF2D78]/50", bg: "bg-[#120009]", bar: "bg-[#FF2D78] shadow-[0_0_14px_rgba(255,45,120,0.45)]", text: "text-[#FF8FB8]"  },
  purple: { ring: "border-[#7C3AED]/55", bg: "bg-[#0d0618]", bar: "bg-[#9F67FF] shadow-[0_0_14px_rgba(159,103,255,0.45)]",text: "text-[#C4B5FD]"  },
  amber:  { ring: "border-[#FF6B2B]/50", bg: "bg-[#140800]", bar: "bg-[#FF6B2B] shadow-[0_0_14px_rgba(255,107,43,0.4)]",  text: "text-[#FFB38A]"  },
  volt:   { ring: "border-[#C8FF00]/50", bg: "bg-[#0a0f00]", bar: "bg-[#C8FF00] shadow-[0_0_14px_rgba(200,255,0,0.4)]",   text: "text-[#DEFF70]"  },
  green:  { ring: "border-[#00FF94]/50", bg: "bg-[#001409]", bar: "bg-[#00FF94] shadow-[0_0_14px_rgba(0,255,148,0.4)]",   text: "text-[#7BFFC4]"  },
  // Dark variant for classroom (light background)
  dark:   { ring: "border-[#1e3a8a]/60", bg: "bg-[#0a1640]",  bar: "bg-[#3b82f6]", text: "text-white" },
};

// Map arena id to loading bubble color key
const ARENA_COLOR: Record<number, string> = {
  1:  "purple",
  2:  "cyan",
  3:  "amber",
  4:  "green",
  5:  "pink",
  6:  "volt",
  10: "dark",   // classroom context
};

function LoadingBubble({ outputType, arenaId }: { outputType?: string; arenaId?: number }) {
  const [tick,     setTick]     = useState(0);
  const [barWidth, setBarWidth] = useState(8);

  const TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
    image:  { icon: "🎨", label: "Generating your image",     color: ARENA_COLOR[arenaId ?? 1] ?? "cyan"   },
    audio:  { icon: "🎙️", label: "Creating your audio scene", color: ARENA_COLOR[arenaId ?? 1] ?? "pink"   },
    slides: { icon: "📊", label: "Building your slides",       color: ARENA_COLOR[arenaId ?? 1] ?? "purple" },
  };

  const meta   = TYPE_META[outputType ?? ""] ?? { icon: "⚡", label: "Working on it", color: ARENA_COLOR[arenaId ?? 1] ?? "amber" };
  const colors = COLOR_MAP[meta.color] ?? COLOR_MAP.purple;

  useEffect(() => {
    const iv = setInterval(() => {
      setBarWidth(w => { if (w >= 85) return 85; return Math.min(85, w + (w < 40 ? 2.5 : w < 65 ? 1.2 : 0.4)); });
    }, 600);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(iv);
  }, []);

  const dots = ".".repeat((tick % 3) + 1).padEnd(3, "\u00a0");

  return (
    <div className={cn("w-56 rounded-xl border p-3 space-y-2 backdrop-blur-xl", colors.ring, colors.bg)}>
      <div className="flex items-center gap-2">
        <span className="text-lg animate-bounce" style={{ animationDuration: "1.2s" }}>{meta.icon}</span>
        <div>
          <p className={cn("text-xs font-display font-extrabold leading-tight tracking-tight", colors.text)}>
            {meta.label}{dots}
          </p>
          <p className={cn("text-[10px] mt-0.5", meta.color === "dark" ? "text-white/50" : "text-white/35")}>20–30 seconds</p>
        </div>
      </div>
      <div className="h-1 w-full bg-[#1E1E30] rounded-full overflow-hidden border border-white/10">
        <div className={cn("h-full rounded-full transition-all", colors.bar)}
          style={{ width: `${barWidth}%`, transitionDuration: "600ms", transitionTimingFunction: "ease-out" }}/>
      </div>
      <div className="space-y-1">
        {[null, "w-4/5", "w-2/3"].map((w, i) => (
          <div key={i} className={cn("h-2 rounded-full bg-white/[0.06] overflow-hidden", w)}>
            <div className="h-full w-full animate-shimmer" style={{ animationDelay: `${i * 0.2}s` }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionFooter({ onSave, onOpen, content, outputType, accent, accentGlow }: {
  onSave:      (content: string, type: OutputType) => void;
  onOpen?:     () => void;
  content:     string;
  outputType:  OutputType;
  accent:      string;
  accentGlow:  string;
}) {
  const [saved,   setSaved]   = useState(false);
  const [copied,  setCopied]  = useState(false);

  const handleSave = () => {
    onSave(content, outputType);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  const handleDownload = async () => {
    if (outputType === "text") {
      const blob = new Blob([content], { type: "text/plain" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "ai-response.txt"; a.click();
      URL.revokeObjectURL(url);
    } else if (outputType === "json") {
      const blob = new Blob([content], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "ai-response.json"; a.click();
      URL.revokeObjectURL(url);
    } else if (outputType === "image") {
      try {
        const res  = await fetch(content.trim());
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href = url; a.download = "ai-image.png"; a.click();
        URL.revokeObjectURL(url);
      } catch { window.open(content.trim(), "_blank"); }
    }
  };

  const canCopy     = outputType === "text" || outputType === "json";
  const canDownload = outputType === "text" || outputType === "json" || outputType === "image";

  // Shared ghost button style
  // Active (copied/saved) → mint green confirmation
  // Inactive → steel-blue: readable on dark purple bubbles, won't compete with the accent Save button
  const ghostBtn = (active: boolean) => ({
    background:  active ? "rgba(0,255,148,0.15)"  : "rgba(148,168,200,0.10)",
    borderColor: active ? "rgba(0,255,148,0.45)"  : "rgba(148,168,200,0.35)",
    color:       active ? "#7BFFC4"               : "#94A8C8",
  });

  return (
    <div className="flex items-center justify-end" style={{ gap: "0.7vmin", marginTop: "0.9vmin" }}>
      {/* Open (replaces Copy when onOpen is provided) */}
      {onOpen ? (
        <button
          onClick={onOpen}
          title="Open"
          className="flex items-center rounded-full font-display font-extrabold border transition-all duration-200 active:scale-95"
          style={{ gap: "0.4vmin", padding: "0.7vmin 1.1vmin", fontSize: "1.3vmin", background: "rgba(245,166,35,0.15)", borderColor: "rgba(245,166,35,0.5)", color: "#F5A623" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background   = "rgba(245,166,35,0.28)";
            (e.currentTarget as HTMLElement).style.borderColor  = "rgba(245,166,35,0.8)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background   = "rgba(245,166,35,0.15)";
            (e.currentTarget as HTMLElement).style.borderColor  = "rgba(245,166,35,0.5)";
          }}
        >
          <svg width="1.2vmin" height="1.2vmin" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M4 6h4M6 4l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Open
        </button>
      ) : canCopy && (
        /* Copy — text & json only */
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          className="flex items-center rounded-full font-display font-semibold border transition-all duration-200 active:scale-95 hover:border-[#94A8C8]/70 hover:text-[#C8DBF0]"
          style={{ gap: "0.4vmin", padding: "0.7vmin 1.1vmin", fontSize: "1.3vmin", ...ghostBtn(copied) }}
        >
          {copied ? (
            <><span style={{ fontSize: "1.1vmin" }}>✓</span> Copied!</>
          ) : (
            <>
              <svg width="1.2vmin" height="1.2vmin" viewBox="0 0 12 12" fill="none">
                <rect x="4" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M8 4V2.5A1.5 1.5 0 006.5 1h-4A1.5 1.5 0 001 2.5v4A1.5 1.5 0 002.5 8H4" stroke="currentColor" strokeWidth="1.3"/>
              </svg>
              Copy
            </>
          )}
        </button>
      )}

      {/* Download */}
      {canDownload && (
        <button
          onClick={handleDownload}
          title={outputType === "image" ? "Download image" : `Download .${outputType}`}
          className="flex items-center rounded-full font-display font-semibold border transition-all duration-200 active:scale-95 hover:border-[#94A8C8]/70 hover:text-[#C8DBF0]"
          style={{ gap: "0.4vmin", padding: "0.7vmin 1.1vmin", fontSize: "1.3vmin", ...ghostBtn(false) }}
        >
          <svg width="1.2vmin" height="1.2vmin" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1 9.5v1A1.5 1.5 0 002.5 12h7a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          {outputType === "image" ? "Download" : "Download"}
        </button>
      )}

      {/* Save to Creations */}
      <button
        onClick={handleSave}
        title="Save to My Creations"
        className="flex items-center rounded-full font-display font-extrabold tracking-tight border transition-all duration-200 active:scale-95"
        style={{ gap: "0.4vmin", padding: "0.7vmin 1.1vmin", fontSize: "1.3vmin",
          ...(saved ? ghostBtn(true) : {
          background: "rgba(255,255,255,0.06)",
          borderColor: "rgba(255,255,255,0.12)",
          color: accent,
        }) }}
        onMouseEnter={e => {
          if (!saved) {
            (e.currentTarget as HTMLElement).style.background   = accent;
            (e.currentTarget as HTMLElement).style.color        = "#08080F";
            (e.currentTarget as HTMLElement).style.borderColor  = accent;
            (e.currentTarget as HTMLElement).style.boxShadow    = `0 0 14px ${accentGlow}`;
          }
        }}
        onMouseLeave={e => {
          if (!saved) {
            (e.currentTarget as HTMLElement).style.background   = "rgba(255,255,255,0.06)";
            (e.currentTarget as HTMLElement).style.color        = accent;
            (e.currentTarget as HTMLElement).style.borderColor  = "rgba(255,255,255,0.12)";
            (e.currentTarget as HTMLElement).style.boxShadow    = "none";
          }
        }}
      >
        {saved ? (
          <><span style={{ fontSize: "1.1vmin" }}>✓</span> Saved!</>
        ) : (
          <>
            <svg width="1.2vmin" height="1.2vmin" viewBox="0 0 12 12" fill="none">
              <path d="M9 1H3a1 1 0 00-1 1v9l4-2 4 2V2a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            </svg>
            Save
          </>
        )}
      </button>
    </div>
  );
}

function tryParseAudio(c: string): AudioData | null {
  try { const p = JSON.parse(c); if (p?.url && p?.script?.dialogues) return p as AudioData; } catch {}
  return null;
}
function tryParseSlides(c: string): SlideData | null {
  try { const p = JSON.parse(c); if (p?.sections && p?.pptBase64) return p as SlideData; } catch {}
  return null;
}
function tryParseVideo(c: string): VideoData | null {
  try { const p = JSON.parse(c); if (p?.videoUrl && typeof p.videoUrl === "string") return p as VideoData; } catch {}
  return null;
}
function isImageUrl(c: string): boolean {
  return /^https?:\/\/.+\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(c.trim())
    || /^https?:\/\/.+supabase\.co.+images\/.+$/i.test(c.trim());
}

// ── JSON pretty-print block ─────────────────────────────────────────────────
// When the assistant returns JSON output (outputType === "json"), render it
// as a syntax-highlighted code block instead of a wall-of-text paragraph.
// Falls back gracefully to a <pre> wrap of the raw string if parsing fails
// (model occasionally returns partial JSON mid-stream).
function JsonBlock({ raw, accent }: { raw: string; accent: string }) {
  // Try to extract JSON: model may wrap in ```json … ``` or include preamble.
  const extracted = (() => {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body   = fenced ? fenced[1] : raw;
    const start  = body.search(/[\[{]/);
    if (start === -1) return null;
    return body.slice(start).trim();
  })();

  let parsed: unknown = null;
  let pretty = extracted ?? raw;
  if (extracted) {
    try {
      parsed = JSON.parse(extracted);
      pretty = JSON.stringify(parsed, null, 2);
    } catch {
      pretty = extracted;
    }
  }

  // Lightweight token colouring — strings, numbers, booleans, keys, punctuation.
  const tokens = pretty.split(/("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}[\],])/g);

  const COLORS = {
    key:    accent,
    string: "#9DEFC4",
    number: "#FFB86C",
    bool:   "#FF79C6",
    punct:  "rgba(255,255,255,0.55)",
    plain:  "rgba(255,255,255,0.88)",
  };

  return (
    <pre
      className="font-mono text-[11px] leading-relaxed rounded-2xl overflow-x-auto p-4 my-1 border border-white/[0.08]"
      style={{
        background: "#0B0F1A",
        whiteSpace: "pre",
        maxWidth:   "100%",
        scrollbarWidth: "thin" as const,
      }}
    >
      {tokens.map((t, i) => {
        if (!t) return null;
        if (/^"(?:\\.|[^"\\])*"\s*:$/.test(t)) {
          return <span key={i} style={{ color: COLORS.key, fontWeight: 600 }}>{t}</span>;
        }
        if (/^"(?:\\.|[^"\\])*"$/.test(t)) {
          return <span key={i} style={{ color: COLORS.string }}>{t}</span>;
        }
        if (/^-?\d/.test(t)) {
          return <span key={i} style={{ color: COLORS.number }}>{t}</span>;
        }
        if (t === "true" || t === "false" || t === "null") {
          return <span key={i} style={{ color: COLORS.bool }}>{t}</span>;
        }
        if (/^[{}[\],]$/.test(t)) {
          return <span key={i} style={{ color: COLORS.punct }}>{t}</span>;
        }
        return <span key={i} style={{ color: COLORS.plain }}>{t}</span>;
      })}
    </pre>
  );
}

export function MessageBubble({
  message, avatarEmoji, isStreaming, onSave, onOpen, extra,
  arenaAccent     = "#7C3AED",
  arenaAccentGlow = "rgba(124,58,237,0.35)",
  arenaId         = 1,
}: Props) {
  const isUser = message.role === "user";

  const isLoading = !isUser && !!message.isLoading;
  const audioData = !isUser && !isLoading ? tryParseAudio(message.content)  : null;
  const slideData = !isUser && !isLoading ? tryParseSlides(message.content) : null;
  const videoData = !isUser && !isLoading ? tryParseVideo(message.content)  : null;
  const isImage   = !isUser && !isLoading && isImageUrl(message.content);
  const isJson    = !isUser && !isLoading && message.outputType === "json";
  const isEmpty   = message.content === "" && isStreaming && !isLoading;
  // Show action footer for text/json/image; audio and slides handle their own actions internally
  const showActions = !isUser && !isLoading && !isEmpty && !!onSave && !!message.content
    && !audioData && !slideData && !videoData;

  // Derive a readable text colour for the user bubble
  // Volt yellow and cyan are dark-text; others are white-text
  const darkTextArenas = new Set([2, 4, 6]); // cyan, green, volt
  const userTextColor  = darkTextArenas.has(arenaId) ? "#08080F" : "#ffffff";

  return (
    <div className={cn("flex gap-1.5 sm:gap-2 message-in items-end w-full", isUser ? "flex-row-reverse" : "justify-start")}>

      {/* Avatar */}
      <div
        className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 mt-1 border backdrop-blur-md"
        style={isUser ? {
          background:  `${arenaAccent}28`,
          borderColor: `${arenaAccent}55`,
        } : {
          background:  "rgba(255,255,255,0.06)",
          borderColor: "rgba(255,255,255,0.09)",
        }}
      >
        {isUser ? avatarEmoji : "🧠"}
      </div>

      {/* Content column */}
      <div className={cn(
        "flex flex-col",
        isUser ? "max-w-[50%] sm:max-w-[45%]" : "max-w-[68%] sm:max-w-[58%]"
      )}>

        {/* Bubble */}
        <div className={cn(
          !audioData && !slideData && !videoData && !isImage && !isLoading && (
            isUser ? "leading-relaxed" : "text-white leading-relaxed backdrop-blur-xl"
          )
        )}
          style={!audioData && !slideData && !videoData && !isImage && !isLoading ? {
            padding: "1.1vmin 1.8vmin", fontSize: "1.3vmin",
            borderRadius: isUser ? "1.8vmin 1.8vmin 0.4vmin 1.8vmin" : "1.8vmin 1.8vmin 1.8vmin 0.4vmin",
            ...(isUser ? {
              background: `linear-gradient(135deg, ${arenaAccent}, ${arenaAccent}cc)`,
              color:      userTextColor,
              boxShadow:  `0 12px 40px -12px ${arenaAccentGlow}`,
            } : {
              background:  "linear-gradient(135deg, rgba(10,5,30,0.82) 0%, rgba(18,10,45,0.78) 100%)",
              border:      `1px solid ${arenaAccent}35`,
              boxShadow:   `0 8px 32px rgba(0,0,0,0.35), 0 0 20px ${arenaAccent}12`,
              backdropFilter: "blur(16px)",
            }),
          } : {}}
        >

          {/* Typing dots */}
          {isEmpty && (
            <div className="bg-white/[0.05] border border-white/[0.09] backdrop-blur-xl"
              style={{ padding: "1.6vmin 2.2vmin", borderRadius: "2.2vmin 2.2vmin 2.2vmin 0.4vmin" }}>
              <div className="flex gap-1.5 py-1">
                {[0,1,2].map(i => (
                  <span key={i} className="dot w-2 h-2 rounded-full bg-white/35"
                    style={{ animationDelay: `${i * 0.15}s` }}/>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {!isEmpty && isLoading && (
            <LoadingBubble outputType={message.outputType} arenaId={arenaId} />
          )}

          {/* Image */}
          {!isEmpty && isImage && (
            <div
              onClick={() => window.dispatchEvent(new CustomEvent("preview-image", { detail: { url: message.content.trim(), fromChat: true } }))}
              className="rounded-2xl overflow-hidden border border-white/[0.09] cursor-pointer"
              style={{ boxShadow: `0 0 32px ${arenaAccentGlow}`, transition: "transform 0.2s ease" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = "scale(1.05)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = "scale(1)"}>
              <img src={message.content.trim()} alt="Generated image"
                draggable={false}
                className="w-full max-w-[220px] object-cover rounded-xl"/>
            </div>
          )}

          {/* Audio */}
          {!isEmpty && audioData && (
            <AudioPlayer
              data={audioData}
              onSave={onSave ? () => onSave(message.content, "audio") : undefined}
            />
          )}

          {/* Slides */}
          {!isEmpty && slideData && (
            <SlideCarousel
              data={slideData}
              onSave={onSave ? () => onSave(message.content, "slides") : undefined}
            />
          )}

          {/* Video */}
          {!isEmpty && videoData && (
            <VideoPlayer
              payload={videoData}
              arenaAccent={arenaAccent}
              arenaAccentGlow={arenaAccentGlow}
            />
          )}

          {/* JSON output — pretty-printed, syntax-highlighted block (assistant only) */}
          {!isEmpty && !isLoading && !isImage && !audioData && !slideData && !videoData && !isUser && isJson && (
            <JsonBlock raw={message.content} accent={arenaAccent} />
          )}

          {/* Plain text */}
          {!isEmpty && !isLoading && !isImage && !audioData && !slideData && !videoData && !(isJson && !isUser) && (
            isUser ? (
              <div>
                {/* Parse [Image titled "X": URL] and [Document titled "X": URL] markers — render as thumbnails/chips */}
                {(() => {
                  const IMAGE_RE = /\[Image titled "([^"]+)": (https?:\/\/\S+?)\]/g;
                  const DOC_RE   = /\[Document titled "([^"]+)": (https?:\/\/\S+?)\]/g;
                  const AUDIO_RE = /\[Audio titled "([^"]+)": ([^\]]+)\]/g;
                  const VIDEO_RE = /\[Video titled "([^"]+)": ([^\]]+)\]/g;
                  const imgs:   { title: string; url: string }[] = [];
                  const docs:   { title: string; url: string }[] = [];
                  const audios: { title: string; url: string }[] = [];
                  const videos: { title: string; url: string }[] = [];
                  let text = message.content.replace(IMAGE_RE, (_, title, url) => { imgs.push({ title, url }); return ""; });
                  text = text.replace(DOC_RE,   (_, title, url) => { docs.push({ title, url }); return ""; });
                  text = text.replace(AUDIO_RE, (_, title, url) => { audios.push({ title, url }); return ""; });
                  text = text.replace(VIDEO_RE, (_, title, url) => { videos.push({ title, url }); return ""; });
                  const clean = text.trim();
                  return (
                    <>
                      {(imgs.length > 0 || docs.length > 0 || audios.length > 0 || videos.length > 0) && (
                        <div className="flex gap-2 flex-wrap mb-2">
                          {imgs.map((img, i) => (
                            <div key={`img-${i}`} className="flex flex-col items-center gap-1">
                              <div className="rounded-lg overflow-hidden flex-shrink-0"
                                style={{ width: 80, height: 56, border: "1.5px solid rgba(255,255,255,0.3)" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.url} alt={img.title} style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                              </div>
                              <span style={{ fontSize: 9, fontWeight: 700, color: userTextColor, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                                {img.title.toUpperCase()}
                              </span>
                            </div>
                          ))}
                          {docs.map((doc, i) => {
                            const name = doc.title.length > 18 ? doc.title.slice(0, 16) + "…" : doc.title;
                            return (
                              <a key={`doc-${i}`} href={doc.url} target="_blank" rel="noopener noreferrer"
                                className="flex flex-col items-center gap-1 no-underline" style={{ textDecoration: "none" }}>
                                <div className="rounded-lg flex-shrink-0 flex items-center justify-center"
                                  style={{ width: 56, height: 56, border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.12)" }}>
                                  <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
                                    <path d="M14 1H4a2 2 0 00-2 2v22a2 2 0 002 2h16a2 2 0 002-2V9L14 1z" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.8"/>
                                    <path d="M14 1v8h8" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.8"/>
                                    <line x1="7" y1="15" x2="17" y2="15" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>
                                    <line x1="7" y1="19" x2="14" y2="19" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>
                                  </svg>
                                </div>
                                <span style={{ fontSize: 9, fontWeight: 700, color: userTextColor, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em", maxWidth: 64, textAlign: "center", wordBreak: "break-all" }}>
                                  {name.toUpperCase()}
                                </span>
                              </a>
                            );
                          })}
                          {audios.map((aud, i) => {
                            const label = aud.title.length > 18 ? aud.title.slice(0, 16) + "…" : aud.title;
                            const hasLink = aud.url.startsWith("http");
                            const chip = (
                              <div className="flex flex-col items-center gap-1">
                                <div className="rounded-lg flex-shrink-0 flex items-center justify-center"
                                  style={{ width: 56, height: 56, border: "1.5px solid rgba(0,170,255,0.45)", background: "rgba(0,170,255,0.12)" }}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                    <path d="M9 18V5l12-2v13" stroke={userTextColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.85"/>
                                    <circle cx="6" cy="18" r="3" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.85"/>
                                    <circle cx="18" cy="16" r="3" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.85"/>
                                  </svg>
                                </div>
                                <span style={{ fontSize: 9, fontWeight: 700, color: userTextColor, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em", maxWidth: 64, textAlign: "center", wordBreak: "break-all" }}>
                                  {label.toUpperCase()}
                                </span>
                              </div>
                            );
                            return hasLink
                              ? <a key={`aud-${i}`} href={aud.url} target="_blank" rel="noopener noreferrer" className="no-underline" style={{ textDecoration: "none" }}>{chip}</a>
                              : <div key={`aud-${i}`}>{chip}</div>;
                          })}
                          {videos.map((vid, i) => {
                            const label = vid.title.length > 18 ? vid.title.slice(0, 16) + "…" : vid.title;
                            const hasLink = vid.url.startsWith("http");
                            const chip = (
                              <div className="flex flex-col items-center gap-1">
                                <div className="rounded-lg flex-shrink-0 flex items-center justify-center"
                                  style={{ width: 56, height: 56, border: "1.5px solid rgba(255,120,0,0.45)", background: "rgba(255,120,0,0.12)" }}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                    <rect x="2" y="5" width="14" height="14" rx="2" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.85"/>
                                    <path d="M16 9l6-3v12l-6-3V9z" fill={userTextColor} fillOpacity="0.7"/>
                                  </svg>
                                </div>
                                <span style={{ fontSize: 9, fontWeight: 700, color: userTextColor, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em", maxWidth: 64, textAlign: "center", wordBreak: "break-all" }}>
                                  {label.toUpperCase()}
                                </span>
                              </div>
                            );
                            return hasLink
                              ? <a key={`vid-${i}`} href={vid.url} target="_blank" rel="noopener noreferrer" className="no-underline" style={{ textDecoration: "none" }}>{chip}</a>
                              : <div key={`vid-${i}`}>{chip}</div>;
                          })}
                        </div>
                      )}
                      {clean && <p className="whitespace-pre-wrap">{clean}</p>}
                    </>
                  );
                })()}
                {message.attachmentMeta && message.attachmentMeta.length > 0 && (() => {
                  const imgEntries   = message.attachmentMeta.filter(m => m.startsWith("img:"));
                  const docEntries   = message.attachmentMeta.filter(m => m.startsWith("doc:"));
                  const audioEntries = message.attachmentMeta.filter(m => m.startsWith("audio:"));
                  const videoEntries = message.attachmentMeta.filter(m => m.startsWith("video:"));
                  const badgeEntries = message.attachmentMeta.filter(m =>
                    !m.startsWith("img:") && !m.startsWith("doc:") &&
                    !m.startsWith("audio:") && !m.startsWith("video:")
                  );
                  return (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {/* Injected image thumbnails — format: img:TITLE:URL (new) or img:URL (legacy) */}
                      {imgEntries.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {imgEntries.map((item, i) => {
                            const rest      = item.slice(4); // strip "img:"
                            const isLegacy  = rest.startsWith("http");
                            const colonIdx  = isLegacy ? -1 : rest.indexOf(":");
                            const title     = (!isLegacy && colonIdx >= 0) ? rest.slice(0, colonIdx) : "";
                            const url       = (!isLegacy && colonIdx >= 0) ? rest.slice(colonIdx + 1) : rest;
                            const label     = title ? title.toUpperCase() : "IMAGE";
                            return (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div className="rounded-lg overflow-hidden flex-shrink-0"
                                  style={{ width: 80, height: 56, border: "1.5px solid rgba(255,255,255,0.3)" }}>
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt={title || "image"} draggable={false}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                                <span style={{ fontSize: 9, fontWeight: 700, color: userTextColor, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                                  {label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {/* Doc / Audio / Video chips — same square style, icon + label below */}
                      {(docEntries.length > 0 || audioEntries.length > 0 || videoEntries.length > 0) && (
                        <div className="flex gap-2 flex-wrap">
                          {docEntries.map((item, i) => {
                            const rest     = item.slice(4);
                            const colonIdx = rest.indexOf(":");
                            const filename = colonIdx >= 0 ? rest.slice(0, colonIdx) : rest;
                            const url      = colonIdx >= 0 ? rest.slice(colonIdx + 1) : "";
                            const label    = filename.length > 16 ? filename.slice(0, 14) + "…" : filename;
                            const chip = (
                              <div className="flex flex-col items-center gap-1">
                                <div className="rounded-lg flex-shrink-0 flex items-center justify-center"
                                  style={{ width: 56, height: 56, border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.12)" }}>
                                  <svg width="22" height="26" viewBox="0 0 24 28" fill="none">
                                    <path d="M14 1H4a2 2 0 00-2 2v22a2 2 0 002 2h16a2 2 0 002-2V9L14 1z" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.8"/>
                                    <path d="M14 1v8h8" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.8"/>
                                    <line x1="7" y1="15" x2="17" y2="15" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>
                                    <line x1="7" y1="19" x2="14" y2="19" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.6" strokeLinecap="round"/>
                                  </svg>
                                </div>
                                <span style={{ fontSize: 9, fontWeight: 700, color: userTextColor, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em", maxWidth: 64, textAlign: "center", wordBreak: "break-all" }}>
                                  {label.toUpperCase()}
                                </span>
                              </div>
                            );
                            return url
                              ? <a key={`doc-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="no-underline" style={{ textDecoration: "none" }}>{chip}</a>
                              : <div key={`doc-${i}`}>{chip}</div>;
                          })}
                          {audioEntries.map((item, i) => {
                            const rest     = item.slice(6); // strip "audio:"
                            const colonIdx = rest.indexOf(":");
                            const filename = colonIdx >= 0 ? rest.slice(0, colonIdx) : rest;
                            const url      = colonIdx >= 0 ? rest.slice(colonIdx + 1) : "";
                            const label    = filename.length > 16 ? filename.slice(0, 14) + "…" : filename;
                            const chip = (
                              <div className="flex flex-col items-center gap-1">
                                <div className="rounded-lg flex-shrink-0 flex items-center justify-center"
                                  style={{ width: 56, height: 56, border: "1.5px solid rgba(0,170,255,0.45)", background: "rgba(0,170,255,0.12)" }}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                    <path d="M9 18V5l12-2v13" stroke={userTextColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.85"/>
                                    <circle cx="6" cy="18" r="3" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.85"/>
                                    <circle cx="18" cy="16" r="3" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.85"/>
                                  </svg>
                                </div>
                                <span style={{ fontSize: 9, fontWeight: 700, color: userTextColor, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em", maxWidth: 64, textAlign: "center", wordBreak: "break-all" }}>
                                  {(label || "AUDIO").toUpperCase()}
                                </span>
                              </div>
                            );
                            return url.startsWith("http")
                              ? <a key={`aud-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="no-underline" style={{ textDecoration: "none" }}>{chip}</a>
                              : <div key={`aud-${i}`}>{chip}</div>;
                          })}
                          {videoEntries.map((item, i) => {
                            const rest     = item.slice(6); // strip "video:"
                            const colonIdx = rest.indexOf(":");
                            const filename = colonIdx >= 0 ? rest.slice(0, colonIdx) : rest;
                            const url      = colonIdx >= 0 ? rest.slice(colonIdx + 1) : "";
                            const label    = filename.length > 16 ? filename.slice(0, 14) + "…" : filename;
                            const chip = (
                              <div className="flex flex-col items-center gap-1">
                                <div className="rounded-lg flex-shrink-0 flex items-center justify-center"
                                  style={{ width: 56, height: 56, border: "1.5px solid rgba(255,120,0,0.45)", background: "rgba(255,120,0,0.12)" }}>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                    <rect x="2" y="5" width="14" height="14" rx="2" stroke={userTextColor} strokeWidth="1.5" strokeOpacity="0.85"/>
                                    <path d="M16 9l6-3v12l-6-3V9z" fill={userTextColor} fillOpacity="0.7"/>
                                  </svg>
                                </div>
                                <span style={{ fontSize: 9, fontWeight: 700, color: userTextColor, opacity: 0.75, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em", maxWidth: 64, textAlign: "center", wordBreak: "break-all" }}>
                                  {(label || "VIDEO").toUpperCase()}
                                </span>
                              </div>
                            );
                            return url.startsWith("http")
                              ? <a key={`vid-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="no-underline" style={{ textDecoration: "none" }}>{chip}</a>
                              : <div key={`vid-${i}`}>{chip}</div>;
                          })}
                        </div>
                      )}
                      {/* Plain type badges (image/audio/pdf/file generic — legacy) */}
                      {badgeEntries.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {badgeEntries.map((item, i) => {
                            const isFileType = ["image","audio","pdf","file"].includes(item);
                            return (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                                style={{ background: "rgba(255,255,255,0.18)", color: userTextColor }}>
                                {item === "image" ? (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <rect x=".5" y=".5" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
                                    <circle cx="3" cy="3.5" r="1" fill="currentColor"/>
                                    <path d="M.5 7l2.5-2.5 2 2 1.5-1.5L9.5 7" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                                  </svg>
                                ) : item === "audio" ? (
                                  <div className="flex items-end gap-[1.5px]">
                                    {[2,3,2,4,2,3,2].map((h, j) => (
                                      <div key={j} className="w-[1.5px] rounded-full" style={{ height: `${h}px`, background: userTextColor }}/>
                                    ))}
                                  </div>
                                ) : (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M6 1H2.5a1 1 0 00-1 1v6a1 1 0 001 1h5a1 1 0 001-1V3.5L6 1z" stroke="currentColor" strokeWidth="1"/>
                                    <path d="M6 1v2.5h2.5" stroke="currentColor" strokeWidth="1"/>
                                  </svg>
                                )}
                                {isFileType ? `${item} attached` : item}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="select-text cursor-text">
              <ReactMarkdown components={{
                p:      ({ children }) => <p className="mb-2 last:mb-0 text-white/95">{children}</p>,
                code:   ({ children }) => (
                  <code className="bg-[#1E1E30] px-1.5 py-0.5 rounded-md text-xs font-mono"
                    style={{ color: arenaAccent }}>
                    {children}
                  </code>
                ),
                pre:    ({ children }) => (
                  <pre className="bg-[#0F0F1A] text-white/90 p-4 rounded-2xl text-xs font-mono overflow-x-auto my-2 border border-white/[0.08]">
                    {children}
                  </pre>
                ),
                ul:     ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 text-white/85">{children}</ul>,
                ol:     ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 text-white/85">{children}</ol>,
                strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                a:      ({ children, href }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer"
                    className="underline" style={{ color: arenaAccent }}>{children}</a>
                ),
              }}>
                {message.content}
              </ReactMarkdown>
              </div>
            )
          )}
        </div>

        {extra && <div className="mt-2">{extra}</div>}

        {/* Action footer — open/copy / download / save */}
        {showActions && (
          <ActionFooter
            onSave={onSave!}
            onOpen={onOpen}
            content={message.content}
            outputType={message.outputType ?? "text"}
            accent={arenaAccent}
            accentGlow={arenaAccentGlow}
          />
        )}
      </div>
    </div>
  );
}