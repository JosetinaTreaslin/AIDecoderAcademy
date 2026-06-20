"use client";

import { motion } from "framer-motion";
import { X, ImageOff } from "lucide-react";

export interface BlogPanel {
  panelNumber:      number;
  sceneDescription: string;
  characters?:      string;
  dialogue?:        string;
  visualNotes?:     string;
  imageUrl?:        string;
}

interface Props {
  topic:          string;
  title:          string;
  subject?:       string;
  panels:         BlogPanel[];
  keyTakeaways?:  string[];
  onClose:        () => void;
}

export function BlogModal({ topic, title, subject, panels, keyTakeaways, onClose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: "rgba(5,8,20,0.88)", backdropFilter: "blur(12px)", padding: 20 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 18 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{    opacity: 0, scale: 0.95, y: 18 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="flex flex-col"
        style={{
          width: "min(820px, 96vw)", maxHeight: "92vh",
          borderRadius: 22,
          background: "#F8F9FC",
          boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
          overflow: "hidden",
        }}
      >
        {/* ── Hero header ─────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 relative"
          style={{
            background: "linear-gradient(135deg, #0f1c4d 0%, #1e3a8a 55%, #2563eb 100%)",
            padding: "26px 26px 30px",
            overflow: "hidden",
          }}
        >
          {/* Ambient glows */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background:
              "radial-gradient(ellipse at 10% 70%, rgba(245,166,35,0.13) 0%, transparent 50%)," +
              "radial-gradient(ellipse at 90% 10%, rgba(96,165,250,0.15) 0%, transparent 50%)",
          }} />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              {/* Subject tag */}
              {subject && (
                <span style={{
                  display: "inline-block", marginBottom: 10,
                  background: "rgba(245,166,35,0.2)", border: "1px solid rgba(245,166,35,0.5)",
                  color: "#F5A623", borderRadius: 100, padding: "4px 14px",
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                  fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                }}>
                  {subject} · Educational Comic
                </span>
              )}

              {/* Title */}
              <h2 style={{
                fontFamily: "'Syne',sans-serif", fontWeight: 900,
                fontSize: "clamp(18px, 3vw, 26px)",
                color: "#fff", lineHeight: 1.2, marginBottom: 8,
                letterSpacing: "-0.01em",
              }}>
                {title}
              </h2>

              {/* Subtitle */}
              <p style={{
                fontSize: 13, fontWeight: 600,
                color: "rgba(255,255,255,0.55)", lineHeight: 1.6,
                fontFamily: "'DM Sans',sans-serif",
              }}>
                Explore <strong style={{ color: "rgba(255,255,255,0.8)" }}>{topic}</strong> through an illustrated adventure
                <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 8px" }}>·</span>
                <span style={{ color: "rgba(255,255,255,0.45)" }}>{panels.length} panel{panels.length !== 1 ? "s" : ""}</span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="flex-shrink-0 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              style={{ width: 34, height: 34, color: "rgba(255,255,255,0.5)", marginTop: 2 }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable comic strip ───────────────────────────────────── */}
        <div
          className="flex-1 min-h-0 overflow-y-auto"
          style={{ padding: "28px 28px 8px", scrollbarWidth: "thin" }}
        >
          {panels.map((panel, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
              style={{
                marginBottom: 36,
                background: "#fff",
                borderRadius: 16, overflow: "hidden",
                boxShadow: "0 4px 28px rgba(15,28,77,0.08)",
                border: "1px solid rgba(15,28,77,0.05)",
              }}
            >
              {/* Panel header bar */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 18px",
                background: "linear-gradient(90deg, #0f1c4d 0%, #1e3a8a 100%)",
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.13em",
                  color: "#F5A623", textTransform: "uppercase",
                }}>
                  Panel {panel.panelNumber ?? i + 1}
                </span>
                {panel.characters && (
                  <span style={{
                    fontSize: 10, color: "rgba(255,255,255,0.35)",
                    fontStyle: "italic", overflow: "hidden",
                    whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1,
                    fontFamily: "'DM Sans',sans-serif",
                  }}>
                    · {panel.characters}
                  </span>
                )}
              </div>

              {/* Illustration */}
              {panel.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={panel.imageUrl}
                  alt={`Panel ${panel.panelNumber ?? i + 1}`}
                  style={{
                    width: "100%", display: "block",
                    objectFit: "contain", maxHeight: 380,
                    background: "#EFF6FF",
                  }}
                />
              ) : (
                <div style={{
                  height: 200, background: "#EFF6FF",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <ImageOff style={{ width: 28, height: 28, color: "rgba(15,28,77,0.18)" }} />
                  <p style={{ fontSize: 11, color: "rgba(15,28,77,0.28)", fontFamily: "'DM Sans',sans-serif" }}>
                    Image not available
                  </p>
                </div>
              )}

              {/* Scene narration + dialogue */}
              <div style={{ padding: "18px 22px 22px" }}>
                <p style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 14, fontWeight: 600,
                  color: "#1e3a8a", lineHeight: 1.7,
                  marginBottom: panel.dialogue ? 14 : 0,
                }}>
                  {panel.sceneDescription}
                </p>

                {panel.dialogue && (
                  <div style={{
                    display: "flex", gap: 11,
                    background: "linear-gradient(135deg, #EFF6FF, #F0F9FF)",
                    border: "1px solid rgba(37,99,235,0.14)",
                    borderLeft: "4px solid #2563eb",
                    borderRadius: "0 12px 12px 0",
                    padding: "11px 16px",
                  }}>
                    <span style={{ fontSize: 17, flexShrink: 0, marginTop: 1 }}>💬</span>
                    <p style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 13.5, fontStyle: "italic", fontWeight: 600,
                      color: "#0f1c4d", lineHeight: 1.65,
                    }}>
                      {panel.dialogue}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* ── Key Takeaways ─────────────────────────────────────────── */}
          {keyTakeaways && keyTakeaways.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: panels.length * 0.06 + 0.1, duration: 0.4 }}
              style={{
                background: "linear-gradient(135deg, #0f1c4d, #1e3a8a)",
                borderRadius: 18, padding: "26px 28px 30px",
                marginBottom: 28,
              }}
            >
              <h3 style={{
                fontFamily: "'Syne',sans-serif", fontWeight: 900,
                fontSize: 20, color: "#fff",
                marginBottom: 20,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ color: "#F5A623" }}>✦</span> Key Takeaways
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {keyTakeaways.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 13,
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12, padding: "13px 18px",
                    }}
                  >
                    <span style={{ color: "#F5A623", fontSize: 14, flexShrink: 0, marginTop: 2 }}>✦</span>
                    <p style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 13.5, fontWeight: 600,
                      color: "rgba(255,255,255,0.88)", lineHeight: 1.65,
                    }}>
                      {t}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
