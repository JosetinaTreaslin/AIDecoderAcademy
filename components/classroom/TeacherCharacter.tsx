"use client";

// Classroom Teacher (Ms. Bhavna) — full-body standee + chat trigger.
// Mirrors how AIDA and the validator stand on the playground floor.
// Click standee or chat badge → opens TeacherChat panel.

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { useClassroomWriter } from "@/lib/chatChannels";
import type { Profile } from "@/types";
import { TeacherChat } from "./TeacherChat";

interface Props {
  profile: Profile | null;
  /** Optional chapter context for the chat persona. */
  chapterTitle?: string;
  /** Hide entirely (e.g. during proctored tests). */
  hidden?: boolean;
}

const GOLD       = "#E0B14C";
const GOLD_GLOW  = "rgba(224,177,76,0.55)";
const VIOLET     = "#9D6BFF";

export function TeacherCharacter({ profile, chapterTitle, hidden }: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const writer = useClassroomWriter();

  // Mark "in lesson" on mount so AIDA knows.
  useEffect(() => {
    writer.startLesson("classroom");
    return () => {
      writer.endLesson({
        topic:            chapterTitle || "classroom_visit",
        summary:          `Student visited the classroom${chapterTitle ? ` for ${chapterTitle}` : ""}.`,
        keyConcepts:      [],
        studentResponses: [],
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fade the floating "talk to me" hint after first interaction.
  useEffect(() => {
    if (chatOpen) setHintVisible(false);
  }, [chatOpen]);

  if (hidden) return null;

  return (
    <>
      {/* ── Standee ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="fixed z-30 pointer-events-none"
        style={{
          left:   "-8px",
          bottom: "0px",
          height: "clamp(280px, 38vh, 460px)",
          width:  "auto",
        }}
      >
        {/* Soft floor glow behind her */}
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: 0, left: "50%", transform: "translateX(-50%)",
            width: "110%", height: "32%",
            background: `radial-gradient(ellipse at center bottom, ${GOLD_GLOW} 0%, transparent 70%)`,
            filter: "blur(8px)",
            opacity: 0.55,
          }}
        />

        <motion.button
          type="button"
          onClick={() => setChatOpen(true)}
          aria-label="Talk to Ms. Bhavna"
          className="relative h-full pointer-events-auto cursor-pointer"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ background: "transparent", border: "none", padding: 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/classroom/teacher-bhavna.png"
            alt="Ms. Bhavna — your classroom teacher"
            draggable={false}
            className="select-none h-full w-auto block"
            style={{
              objectFit: "contain",
              filter: "drop-shadow(0 12px 22px rgba(0,0,0,0.45))",
            }}
          />

          {/* Chat trigger badge — top-right of standee */}
          <motion.div
            className="absolute pointer-events-none flex items-center justify-center rounded-full"
            style={{
              top:    "8%",
              right:  "-4px",
              width:  44, height: 44,
              background: `linear-gradient(135deg, ${VIOLET}, ${GOLD})`,
              boxShadow: `0 0 18px ${GOLD_GLOW}, inset 0 1px 0 rgba(255,255,255,0.4)`,
              border:  "2px solid rgba(255,255,255,0.7)",
            }}
            animate={hintVisible ? {
              boxShadow: [
                `0 0 18px ${GOLD_GLOW}, inset 0 1px 0 rgba(255,255,255,0.4)`,
                `0 0 28px ${GOLD_GLOW}, inset 0 1px 0 rgba(255,255,255,0.4)`,
                `0 0 18px ${GOLD_GLOW}, inset 0 1px 0 rgba(255,255,255,0.4)`,
              ],
            } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <MessageCircle size={20} color="#fff" strokeWidth={2.4} />
          </motion.div>
        </motion.button>

        {/* Hint bubble */}
        <AnimatePresence>
          {hintVisible && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="absolute pointer-events-none"
              style={{
                top: "20%",
                left: "100%",
                marginLeft: 8,
                background: "linear-gradient(180deg, rgba(15,15,26,0.96), rgba(8,8,15,0.96))",
                color: "#F4ECD7",
                border: `1px solid ${GOLD}55`,
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 12,
                fontFamily: "var(--font-dm-sans,'DM Sans',sans-serif)",
                fontWeight: 500,
                whiteSpace: "nowrap",
                boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 16px ${GOLD_GLOW}`,
              }}
            >
              💬 Talk to Ms. Bhavna
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Chat panel (separate component) ─────────────────────────── */}
      <AnimatePresence>
        {chatOpen && (
          <TeacherChat
            profile={profile}
            chapterTitle={chapterTitle}
            onClose={() => setChatOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default TeacherCharacter;
