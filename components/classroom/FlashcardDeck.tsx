"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Shuffle, ImageOff } from "lucide-react";

export interface FlashCard {
  question: string;
  answer:   string;
  imageUrl?: string;
}

// Legacy parser — old saved decks were stored as "**Q:** ...\n**A:** ..." markdown
// with no images. Kept for backward compatibility when reopening old saves.
export function parseFlashcards(markdown: string): FlashCard[] {
  const cards: FlashCard[] = [];
  let currentQ = "";
  let currentA = "";

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    const qMatch = trimmed.match(/^\*\*Q:\*\*\s*(.+)/);
    const aMatch = trimmed.match(/^\*\*A:\*\*\s*(.+)/);

    if (qMatch) {
      if (currentQ && currentA) cards.push({ question: currentQ, answer: currentA });
      currentQ = qMatch[1].trim();
      currentA = "";
    } else if (aMatch) {
      currentA = aMatch[1].trim();
    } else if (currentA && trimmed && !trimmed.startsWith("**")) {
      currentA += " " + trimmed;
    }
  }

  if (currentQ && currentA) cards.push({ question: currentQ, answer: currentA });
  return cards;
}

interface Props {
  topic:   string;
  subject?: string;
  cards:   FlashCard[];
  onClose: () => void;
}

export function FlashcardDeck({ topic, subject, cards, onClose }: Props) {
  const total = cards.length;
  const [order,      setOrder]      = useState<number[]>(() => cards.map((_, i) => i));
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [flipped,    setFlipped]    = useState<Set<number>>(new Set());

  const toggleFlip = useCallback((cardIdx: number) => {
    setFlipped(prev => {
      const next = new Set(prev);
      if (next.has(cardIdx)) next.delete(cardIdx);
      else next.add(cardIdx);
      return next;
    });
  }, []);

  const goPrev = useCallback(() => setFocusedIdx(i => (i - 1 + total) % total), [total]);
  const goNext = useCallback(() => setFocusedIdx(i => (i + 1) % total), [total]);

  const shuffle = useCallback(() => {
    setOrder(prev => {
      const next = [...prev];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return next;
    });
    setFocusedIdx(0);
    setFlipped(new Set());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 60, background: "rgba(10,14,30,0.78)", backdropFilter: "blur(10px)", padding: 24 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{    opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="flex flex-col"
        style={{
          width: "min(900px, 94vw)", maxHeight: "88vh",
          background: "#F4F5F7", borderRadius: 24,
          boxShadow: "0 32px 80px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between flex-shrink-0" style={{ padding: "20px 24px 14px" }}>
          <div>
            <p style={{ fontFamily: "'Syne',sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: "0.04em", color: "#0f1c4d" }}>
              FLASH<span style={{ color: "#F5A623" }}>MASTER</span>
            </p>
            <p className="text-xs font-mono mt-0.5" style={{ color: "rgba(15,28,77,0.5)" }}>
              {subject ? `${subject} • ${topic}` : topic}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ background: "#F5A623", color: "#fff", fontFamily: "'DM Sans',sans-serif" }}
            >
              Card {focusedIdx + 1} of {total}
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 transition-colors"
              style={{ color: "rgba(15,28,77,0.4)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card grid */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: "4px 24px 20px", scrollbarWidth: "thin" }}>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${total <= 2 ? total : total <= 4 ? 2 : 3}, minmax(0,1fr))` }}
          >
            {order.map(cardIdx => {
              const card    = cards[cardIdx];
              const isFlip  = flipped.has(cardIdx);
              const isFocus = cardIdx === order[focusedIdx];
              return (
                <div
                  key={cardIdx}
                  onClick={() => { toggleFlip(cardIdx); setFocusedIdx(order.indexOf(cardIdx)); }}
                  style={{ perspective: "1200px", cursor: "pointer", aspectRatio: "3/4" }}
                >
                  <motion.div
                    animate={{ rotateY: isFlip ? 180 : 0 }}
                    transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
                    style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d" }}
                  >
                    {/* Front — image + question */}
                    <div
                      className="flex flex-col"
                      style={{
                        position: "absolute", inset: 0, borderRadius: 16,
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden" as React.CSSProperties["WebkitBackfaceVisibility"],
                        background: "#fff",
                        border: `2px solid ${isFocus ? "#F5A623" : "rgba(245,166,35,0.35)"}`,
                        boxShadow: isFocus
                          ? "0 6px 24px rgba(245,166,35,0.35), 0 0 0 3px rgba(245,166,35,0.18)"
                          : "0 2px 12px rgba(15,28,77,0.08)",
                        overflow: "hidden",
                      }}
                    >
                      <div className="flex-1 flex items-center justify-center" style={{ background: "#FFF8EC", minHeight: 0 }}>
                        {card.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={card.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "8px" }} />
                        ) : (
                          <ImageOff className="w-6 h-6" style={{ color: "rgba(15,28,77,0.2)" }} />
                        )}
                      </div>
                      <div className="flex-shrink-0 flex items-center justify-center text-center" style={{ padding: "10px 12px", minHeight: 64 }}>
                        <p style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 13, color: "#0f1c4d", lineHeight: 1.4 }}>
                          {card.question}
                        </p>
                      </div>
                    </div>

                    {/* Back — answer */}
                    <div
                      className="flex flex-col items-center justify-center text-center"
                      style={{
                        position: "absolute", inset: 0, borderRadius: 16,
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden" as React.CSSProperties["WebkitBackfaceVisibility"],
                        transform: "rotateY(180deg)",
                        background: "linear-gradient(160deg,#1a0533 0%,#0c1a5e 100%)",
                        border: "2px solid #F5A623",
                        padding: "16px 14px",
                        boxShadow: "0 6px 24px rgba(245,166,35,0.25)",
                      }}
                    >
                      <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: "#F5A623" }}>
                        Answer
                      </p>
                      <p style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 600, fontSize: 13, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
                        {card.answer}
                      </p>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-center gap-3 flex-shrink-0" style={{ padding: "14px 24px", borderTop: "1px solid rgba(15,28,77,0.08)" }}>
          <button
            onClick={goPrev}
            disabled={total <= 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-transform hover:scale-105 disabled:opacity-30"
            style={{ background: "#fff", border: "1px solid rgba(15,28,77,0.12)", color: "#0f1c4d", fontFamily: "'DM Sans',sans-serif" }}
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <button
            onClick={shuffle}
            disabled={total <= 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-transform hover:scale-105 disabled:opacity-30"
            style={{ background: "#00B4D8", color: "#fff", border: "1px solid #00B4D8", boxShadow: "0 4px 16px rgba(0,180,216,0.4)", fontFamily: "'DM Sans',sans-serif" }}
          >
            <Shuffle className="w-4 h-4" /> Shuffle Deck
          </button>
          <button
            onClick={goNext}
            disabled={total <= 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-transform hover:scale-105 disabled:opacity-30"
            style={{ background: "#fff", border: "1px solid rgba(15,28,77,0.12)", color: "#0f1c4d", fontFamily: "'DM Sans',sans-serif" }}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
