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
//   Edit the two `clamp(...)` values on the SAME line (width + height). They
//   must stay equal — the sprite is a square. Format is clamp(MIN, IDEAL, MAX):
//     MIN  = smallest size on tiny screens, in pixels
//     IDEAL = preferred size, in vw (% of viewport width)
//     MAX  = largest size on huge screens, in pixels
//   Current values are HALF of AIDA's size. Bigger = bump all three numbers.
//   Examples:
//     clamp(87px, 7.2vw, 135px)  ← current (half of AIDA)
//     clamp(110px, 9vw, 170px)   ← ~30% bigger
//     clamp(140px, 11vw, 210px)  ← ~60% bigger
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
  const [hidden,    setHidden]    = useState(false);
  const [navOffset, setNavOffset] = useState(0);

  useEffect(() => {
    const onValidatorOpen  = () => setHidden(true);
    const onValidatorClose = () => setHidden(false);
    const onWorksheetOpen  = () => setHidden(true);
    const onWorksheetClose = () => setHidden(false);
    const onNavChange = (e: Event) => {
      const ce = e as CustomEvent<{ visible: boolean; height: number }>;
      setNavOffset(ce.detail.visible ? ce.detail.height : 0);
    };
    window.addEventListener("validator-panel-open",    onValidatorOpen);
    window.addEventListener("validator-panel-close",   onValidatorClose);
    window.addEventListener("worksheet-popup-open",    onWorksheetOpen);
    window.addEventListener("worksheet-popup-close",   onWorksheetClose);
    window.addEventListener("nav-visibility-change",   onNavChange);
    return () => {
      window.removeEventListener("validator-panel-open",    onValidatorOpen);
      window.removeEventListener("validator-panel-close",   onValidatorClose);
      window.removeEventListener("worksheet-popup-open",    onWorksheetOpen);
      window.removeEventListener("worksheet-popup-close",   onWorksheetClose);
      window.removeEventListener("nav-visibility-change",   onNavChange);
    };
  }, []);

  if (hidden) return null;

  return (
    <motion.div
      className="fixed z-[100]"
      style={{
        right:  "calc(53% + 14.4vw)",
        bottom: "2%",
        width:  "21.6vw",
        height: "21.6vw",
      }}
      animate={{ y: navOffset }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Inner: float animation + click */}
      <motion.button
        type="button"
        onClick={onClick}
        className="w-full h-full flex items-end justify-center"
        style={{
          background: "transparent",
          border:     "none",
          padding:    0,
          cursor:     "pointer",
          filter:     `drop-shadow(0 0 18px ${arenaAccentGlow})`,
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
    </motion.div>
  );
}
