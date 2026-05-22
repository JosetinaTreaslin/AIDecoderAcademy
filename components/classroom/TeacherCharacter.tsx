"use client";

// Classroom Teacher (Ms. Bhavna) — full-body standee + chat + lecture.
// Click standee → opens TeacherChat (free chat).
// Click "Lesson" inside TeacherChat → opens LecturePanel overlay.

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useClassroomWriter } from "@/lib/chatChannels";
import type { Profile } from "@/types";
import { TeacherChat } from "./TeacherChat";
import { LecturePanel } from "./LecturePanel";

interface Props {
  profile: Profile | null;
  chapterTitle?: string;
  hidden?: boolean;
}

const GOLD      = "#E0B14C";
const GOLD_GLOW = "rgba(224,177,76,0.55)";

export function TeacherCharacter({ profile, chapterTitle, hidden }: Props) {
  const [chatOpen,    setChatOpen]    = useState(false);
  const [lectureOpen, setLectureOpen] = useState(false);
  const [hintVisible, setHintVisible] = useState(true);
  const [speaking,    setSpeaking]    = useState(false);
  const writer = useClassroomWriter();

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

  useEffect(() => {
    if (chatOpen || lectureOpen) setHintVisible(false);
  }, [chatOpen, lectureOpen]);

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
        {/* Floor glow — wider pulse range when speaking (Fix 8) */}
        <motion.div
          className="absolute pointer-events-none"
          style={{
            bottom: 0, left: "50%", transform: "translateX(-50%)",
            width: "130%", height: "36%",
            background: `radial-gradient(ellipse at center bottom, ${GOLD_GLOW} 0%, transparent 70%)`,
            filter: "blur(10px)",
          }}
          animate={{ opacity: speaking ? [0.2, 1.0, 0.2] : 0.45, scale: speaking ? [0.95, 1.05, 0.95] : 1 }}
          transition={speaking
            ? { duration: 1.0, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.4 }}
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

      {/* ── Chat panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {chatOpen && (
          <TeacherChat
            profile={profile}
            chapterTitle={chapterTitle}
            onClose={() => setChatOpen(false)}
            onSpeakingChange={setSpeaking}
            onOpenLecture={() => setLectureOpen(true)}
          />
        )}
      </AnimatePresence>

      {/* ── Lecture panel (full overlay, opens on top of chat) ──────── */}
      <AnimatePresence>
        {lectureOpen && (
          <LecturePanel
            profile={profile}
            chapterTitle={chapterTitle}
            onClose={() => setLectureOpen(false)}
            onSpeakingChange={setSpeaking}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default TeacherCharacter;
