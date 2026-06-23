"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Props {
  onClick:         () => void;
  arenaAccent:     string;
  arenaAccentGlow: string;
  hasDraft:        boolean;
}

// Floating worksheet launcher — uses /worksheet-on-floor.png as a JRPG-style
// floor sprite, sitting just to the LEFT of the AIDA character.
//
// ───────────────────────────────────────────────────────────────────────────
// MANUAL SIZE KNOB
//   Edit the two `vw` values on the SAME line (width + height). They must
//   stay equal — the sprite is a square. Plain `vw` (no px floor/ceiling)
//   so it scales continuously at every window size instead of freezing at
//   a fixed pixel size on very small or very large screens.
//   Current value is HALF of AIDA's size. Bigger = bump the number.
//   Examples: 7.2vw (half of AIDA) · 9vw (~30% bigger) · 11vw (~60% bigger)
//
// MANUAL POSITION KNOBS
//   `right`  — keeps it anchored to AIDA's left edge. The 16px at the end is
//              the GAP between the worksheet and AIDA. Bump that for more space.
//   `bottom` — vertical position from the floor; matches AIDA's bottom.
// ───────────────────────────────────────────────────────────────────────────
//
// VISIBILITY
//   Auto-hides whenever the SAGE validator panel OR the worksheet popup is
//   open — so the floor sprite never bleeds through the modal text.
export function WorksheetIcon({ onClick, arenaAccent, arenaAccentGlow, hasDraft }: Props) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onValidatorOpen  = () => setHidden(true);
    const onValidatorClose = () => setHidden(false);
    const onWorksheetOpen  = () => setHidden(true);
    const onWorksheetClose = () => setHidden(false);
    window.addEventListener("validator-panel-open",  onValidatorOpen);
    window.addEventListener("validator-panel-close", onValidatorClose);
    window.addEventListener("worksheet-popup-open",  onWorksheetOpen);
    window.addEventListener("worksheet-popup-close", onWorksheetClose);
    return () => {
      window.removeEventListener("validator-panel-open",  onValidatorOpen);
      window.removeEventListener("validator-panel-close", onValidatorClose);
      window.removeEventListener("worksheet-popup-open",  onWorksheetOpen);
      window.removeEventListener("worksheet-popup-close", onWorksheetClose);
    };
  }, []);

  if (hidden) return null;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="fixed z-[100] flex items-end justify-center worksheet-icon"
      style={{
        // ↓ horizontal: right of viewport, plus the character's width, plus
        //   tight gap = sits left of it. 53% here (not AidaAssistant's
        //   literal "62%") is what actually clears the TeacherCharacter
        //   sprite (left-anchored, separate component) without overlapping
        //   it — verified empirically, don't "correct" this to 62% without
        //   checking on screen first.
        //   The "14.4vw" term MUST stay a plain value (no clamp/px bound) —
        //   it has to match TeacherCharacter's/AidaAssistant's actual width
        //   formula exactly, or this drifts left as the window narrows.
        right:  "calc(53% + 14.4vw + 4px)",
        bottom: "0px",                                    // ← matches AIDA's bottom exactly
        width:  "21.6vw",             // ← SIZE knob: width  (2× original) — pure vw, no px floor/ceiling so it scales at every size
        height: "21.6vw",             // ← SIZE knob: height (keep equal to width)
        background: "transparent",
        border:     "none",
        padding:    0,
        cursor: "pointer",
        filter: `drop-shadow(0 0 18px ${arenaAccentGlow})`,
      }}
      whileHover={{ y: -3, scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      aria-label="Open worksheet"
    >
      <img
        src="/worksheet-on-floor.png"
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      {hasDraft && (
        <span
          className="absolute top-2 right-2 w-3 h-3 rounded-full"
          style={{ background: arenaAccent, boxShadow: `0 0 10px ${arenaAccentGlow}` }}
        />
      )}
    </motion.button>
  );
}
