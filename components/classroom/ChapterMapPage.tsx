"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Loader2 } from "lucide-react";
import type { Chapter } from "@/types";

// ── Types ────────────────────────────────────────────────────────────────────
interface Props {
  onChapterSelect: (chapter: Chapter) => void;
  onBack:          () => void;
}

type LeaderboardEntry = {
  display_name: string; avatar_emoji: string; xp: number;
  level: number; streak_days: number; active_arena: number;
  rank: number; is_current_user: boolean;
};

const ARENA_ACCENTS: Record<number, string> = {
  1:"#7C3AED",2:"#00D4FF",3:"#FF6B2B",4:"#00FF94",5:"#FF2D78",6:"#C8FF00",
};
const PODIUM_META = [
  { rank:2, ring:"#C0C0C0", glow:"rgba(192,192,192,0.35)", platform:28, avatar:30, label:"🥈" },
  { rank:1, ring:"#FFD700", glow:"rgba(255,215,0,0.40)",   platform:42, avatar:38, label:"👑" },
  { rank:3, ring:"#CD7F32", glow:"rgba(205,127,50,0.35)",  platform:18, avatar:26, label:"🥉" },
];

// ── Chapter tile config ───────────────────────────────────────────────────────
// Positions as % of the mind-map container (top/left/right/bottom)
const CHAPTER_TILES = [
  { key:"chemical", src:"/classroom/chapter/chemical.png", chapterNum:1, hasData:true,
    style:{ top:"2%",   left:"50%",  transform:"translateX(-50%)" } },
  { key:"acids",    src:"/classroom/chapter/acids.png",    chapterNum:2, hasData:false,
    style:{ top:"28%",  right:"1%" } },
  { key:"metals",   src:"/classroom/chapter/metals.png",   chapterNum:3, hasData:false,
    style:{ bottom:"5%",right:"4%" } },
  { key:"carbon",   src:"/classroom/chapter/carbon.png",   chapterNum:4, hasData:false,
    style:{ bottom:"5%",left:"2%" } },
  { key:"periodic", src:"/classroom/chapter/periodic.png", chapterNum:5, hasData:false,
    style:{ top:"28%",  left:"1%" } },
] as const;

// SVG connector lines: from exam circle center → each chapter tile center
// Coordinates in viewBox="0 0 100 100"
const CONNECTORS = [
  { id:"c1", x1:50, y1:48, x2:50, y2:22 },   // → chemical  (top)
  { id:"c2", x1:53, y1:50, x2:81, y2:42 },   // → acids     (right)
  { id:"c3", x1:53, y1:54, x2:76, y2:74 },   // → metals    (bottom-right)
  { id:"c4", x1:47, y1:54, x2:24, y2:74 },   // → carbon    (bottom-left)
  { id:"c5", x1:47, y1:50, x2:19, y2:42 },   // → periodic  (left)
];

// ── Sub-components ────────────────────────────────────────────────────────────
function PodiumSpot({ entry, meta }: { entry: LeaderboardEntry; meta: typeof PODIUM_META[0] }) {
  const isMe = entry.is_current_user;
  const accent = ARENA_ACCENTS[entry.active_arena] ?? "#7C3AED";
  return (
    <motion.div className="flex flex-col items-center flex-1"
      initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }}
      transition={{ duration:0.4, delay:meta.rank===1?0:0.15 }}>
      <div style={{ fontSize:meta.rank===1?14:12, marginBottom:3 }}>{meta.label}</div>
      <div className="rounded-full flex items-center justify-center"
        style={{ width:meta.avatar, height:meta.avatar,
          background:isMe?"rgba(124,58,237,0.12)":"rgba(255,255,255,0.85)",
          border:`2.5px solid ${meta.ring}`, boxShadow:`0 0 10px ${meta.glow}`,
          fontSize:meta.avatar*0.52 }}>
        {entry.avatar_emoji||"🧑‍💻"}
      </div>
      <div className="w-1.5 h-1.5 rounded-full mt-1" style={{ background:accent }} />
      <div className="font-black text-center truncate mt-0.5"
        style={{ fontSize:10, color:isMe?"#7C3AED":"#1a1a2e", maxWidth:60, lineHeight:1.2 }}>
        {isMe?"You":entry.display_name.split(" ")[0]}
      </div>
      <div className="font-black" style={{ fontSize:10, color:"#7C3AED", marginTop:1 }}>
        {entry.xp.toLocaleString()}
      </div>
      <div className="w-full rounded-t-lg flex items-end justify-center pb-1 mt-1"
        style={{ height:meta.platform,
          background:`linear-gradient(180deg,${meta.ring}28,${meta.ring}0c)`,
          borderTop:`1.5px solid ${meta.ring}55`, borderLeft:`1px solid ${meta.ring}33`,
          borderRight:`1px solid ${meta.ring}33`, fontSize:11, color:meta.ring, fontWeight:900 }}>
        {meta.rank}
      </div>
    </motion.div>
  );
}

function LeaderboardRow({ entry, index }: { entry: LeaderboardEntry; index:number }) {
  const isMe = entry.is_current_user;
  const accent = ARENA_ACCENTS[entry.active_arena] ?? "#7C3AED";
  return (
    <motion.div className="flex items-center gap-2 px-2 py-1.5 rounded-xl"
      initial={{ opacity:0,x:10 }} animate={{ opacity:1,x:0 }}
      transition={{ duration:0.3, delay:index*0.04 }}
      style={{ background:isMe?"rgba(124,58,237,0.08)":"rgba(0,0,0,0.02)",
        border:isMe?"1px solid rgba(124,58,237,0.15)":"1px solid transparent" }}>
      <div className="w-5 font-black text-center flex-shrink-0" style={{ fontSize:10, color:"#bbb" }}>{entry.rank}</div>
      <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background:accent }} />
      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
        style={{ background:isMe?"rgba(124,58,237,0.10)":"rgba(0,0,0,0.05)", fontSize:13 }}>
        {entry.avatar_emoji||"🧑‍💻"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold truncate" style={{ fontSize:11, color:isMe?"#7C3AED":"#1a1a2e", lineHeight:1 }}>
          {isMe?"You":entry.display_name.split(" ")[0]}
        </div>
        <div style={{ fontSize:9, color:"#bbb", lineHeight:1, marginTop:2 }}>Lv {entry.level}</div>
      </div>
      <div className="font-black flex-shrink-0" style={{ fontSize:11, color:isMe?"#7C3AED":"#333" }}>
        {entry.xp.toLocaleString()}
      </div>
    </motion.div>
  );
}

// ── Progress ring (SVG) ───────────────────────────────────────────────────────
function ProgressRing({ pct, label, color }: { pct:number; label:string; color:string }) {
  const r = 36; const circ = 2*Math.PI*r;
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${circ*pct} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-black text-xl leading-none" style={{ color }}>{Math.round(pct*100)}%</span>
        <span className="text-[10px] font-medium mt-0.5" style={{ color:"rgba(255,255,255,0.7)" }}>{label}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function ChapterMapPage({ onChapterSelect, onBack }: Props) {
  const [chapters,  setChapters]  = useState<Chapter[]>([]);
  const [attempts,  setAttempts]  = useState<number>(0);
  const [lbData,    setLbData]    = useState<{ top10:LeaderboardEntry[]; isInTop10:boolean }|null>(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    // Fetch chapters + leaderboard in parallel
    Promise.all([
      fetch("/api/classroom/chapters").then(r=>r.json()),
      fetch("/api/leaderboard").then(r=>r.ok?r.json():null).catch(()=>null),
    ]).then(([chapData, lb]) => {
      setChapters((chapData.chapters as Chapter[]).filter(c=>c.subject==="Science" && c.chapter_number < 90));
      setLbData(lb);
      setLoading(false);
    });
  }, []);

  const handleTileClick = (chapterNum: number, hasData: boolean) => {
    if (!hasData) return;
    const ch = chapters.find(c => c.chapter_number === chapterNum);
    if (ch) onChapterSelect(ch);
  };

  const lbEntries     = lbData?.top10 ?? [];
  const podiumEntries = lbEntries.slice(0,3);
  const listEntries   = lbEntries.slice(3);

  // Progress stats
  const totalChapters = 5;
  const doneChapters  = chapters.length; // seeded = available
  const progressPct   = doneChapters / totalChapters;

  return (
    <div className="relative flex flex-col overflow-hidden"
      style={{ height:"100dvh", fontFamily:"var(--font-dm-sans,'DM Sans',sans-serif)" }}>

      {/* Background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/classroom/chapter/background.png" alt="" aria-hidden draggable={false}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
        style={{ zIndex:0 }} />
      {/* Subtle overlay for readability */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background:"rgba(230,235,255,0.15)", zIndex:1 }} />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 flex items-center px-5 py-3 gap-4" style={{ zIndex:10,
        background:"rgba(255,255,255,0.88)", backdropFilter:"blur(16px)",
        borderBottom:"1px solid rgba(255,255,255,0.6)",
        boxShadow:"0 2px 16px rgba(15,28,77,0.06)" }}>

        <button onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ color:"rgba(15,28,77,0.65)" }}>
          <ChevronLeft className="w-4 h-4" />
          Back to Subjects
        </button>

        <div className="flex-1 flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧪</span>
            <span className="font-display font-black text-2xl" style={{ color:"#0f1c4d" }}>CHEMISTRY</span>
          </div>
          <span className="text-xs font-medium" style={{ color:"rgba(15,28,77,0.5)" }}>CBSE Class 10</span>
        </div>

        {/* Board badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background:"rgba(124,58,237,0.08)", border:"1px solid rgba(124,58,237,0.2)" }}>
          <span className="text-sm">📋</span>
          <span className="text-xs font-bold" style={{ color:"#7C3AED" }}>Board: CBSE</span>
        </div>
      </div>

      {/* ── Body: 3 columns ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 flex gap-0" style={{ zIndex:10 }}>

        {/* LEFT — Subject progress card ────────────────────────────────────── */}
        <div className="flex-shrink-0 flex flex-col justify-center px-4 py-4 gap-3"
          style={{ width:220 }}>
          <motion.div initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }}
            transition={{ duration:0.5 }}
            className="rounded-2xl p-4"
            style={{ background:"rgba(255,255,255,0.88)", backdropFilter:"blur(20px)",
              border:"1px solid rgba(255,255,255,0.7)",
              boxShadow:"0 8px 32px rgba(15,28,77,0.1)" }}>

            <p className="font-display font-black text-sm mb-4" style={{ color:"#0f1c4d" }}>
              Subject Progress
            </p>

            <div className="flex justify-center mb-4">
              <ProgressRing pct={progressPct} label="Completed" color="#7C3AED" />
            </div>

            <div className="space-y-2.5">
              {[
                { label:"Chapters Completed", value:`${doneChapters}/${totalChapters}` },
                { label:"Tests Attempted",    value: attempts > 0 ? String(attempts) : "—" },
                { label:"Avg. Accuracy",      value:"—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color:"rgba(15,28,77,0.55)" }}>{label}</span>
                  <span className="text-[11px] font-black" style={{ color:"#0f1c4d" }}>{value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* CENTER — Mind map ────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 relative">

          {/* SVG connector lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100" preserveAspectRatio="none" style={{ zIndex:1 }}>
            {CONNECTORS.map(c => (
              <line key={c.id}
                x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
                stroke="rgba(255,255,255,0.55)" strokeWidth="0.5"
                strokeDasharray="2 2" strokeLinecap="round"
              />
            ))}
          </svg>

          {/* Center exam circle */}
          <motion.div initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }}
            transition={{ duration:0.5, delay:0.1 }}
            className="absolute" style={{ top:"50%", left:"50%", transform:"translate(-50%,-52%)",
              width:180, height:180, zIndex:3, cursor:"not-allowed" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/classroom/chapter/mid_term_exam.png" alt="Integrated Exam Practice"
              className="w-full h-full object-contain select-none" draggable={false} />
            {/* Lock overlay */}
            <div className="absolute inset-0 rounded-full flex items-center justify-center"
              style={{ background:"rgba(8,16,32,0.15)", backdropFilter:"blur(1px)" }}>
              <div className="flex items-center justify-center rounded-full"
                style={{ width:38, height:38, marginTop:70,
                  background:"linear-gradient(180deg,#0B1A2F,#050E1F)",
                  border:"1.5px solid rgba(125,211,252,0.65)",
                  boxShadow:"0 0 16px rgba(0,212,255,0.5)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="#E8F4FF" strokeWidth="1.8"/>
                  <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="#E8F4FF" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Chapter tiles */}
          {CHAPTER_TILES.map((tile, i) => (
            <motion.div key={tile.key}
              initial={{ opacity:0, scale:0.9 }} animate={{ opacity:1, scale:1 }}
              transition={{ duration:0.4, delay: 0.15 + i*0.07 }}
              className="absolute"
              style={{ ...tile.style, width:260, zIndex:4,
                cursor: tile.hasData ? "pointer" : "not-allowed" }}
              whileHover={tile.hasData ? { scale:1.03 } : {}}
              whileTap={tile.hasData ? { scale:0.97 } : {}}
              onClick={() => handleTileClick(tile.chapterNum, tile.hasData)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tile.src} alt={tile.key} className="w-full h-auto rounded-2xl select-none"
                draggable={false}
                style={{ boxShadow: tile.hasData
                  ? "0 4px 20px rgba(15,28,77,0.15)"
                  : "0 2px 10px rgba(15,28,77,0.08)" }} />

              {/* Lock overlay for locked tiles */}
              {!tile.hasData && (
                <div className="absolute inset-0 rounded-2xl flex items-center justify-center"
                  style={{ backdropFilter:"blur(1.5px) saturate(85%)" as any,
                    background:"rgba(8,16,32,0.08)" }}>
                  <div className="flex items-center justify-center rounded-full"
                    style={{ width:38, height:38,
                      background:"linear-gradient(180deg,#0B1A2F,#050E1F)",
                      border:"1.5px solid rgba(125,211,252,0.65)",
                      boxShadow:"0 0 16px rgba(0,212,255,0.5), inset 0 0 8px rgba(0,212,255,0.18)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="5" y="11" width="14" height="10" rx="2" stroke="#E8F4FF" strokeWidth="1.8"/>
                      <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="#E8F4FF" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* RIGHT — Leaderboard ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex flex-col py-4 pr-4" style={{ width:220 }}>
          <motion.div initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }}
            transition={{ duration:0.5 }}
            className="flex-1 flex flex-col rounded-2xl overflow-hidden"
            style={{ background:"rgba(255,255,255,0.90)", backdropFilter:"blur(20px)",
              border:"1px solid rgba(255,255,255,0.75)",
              boxShadow:"0 8px 32px rgba(0,0,0,0.1)" }}>

            {/* Header */}
            <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2.5"
              style={{ background:"linear-gradient(135deg,rgba(124,58,237,0.10),rgba(0,212,255,0.05))",
                borderBottom:"1px solid rgba(0,0,0,0.06)" }}>
              <span style={{ fontSize:16 }}>🏆</span>
              <span className="font-black tracking-tight" style={{ fontSize:13, color:"#1a1a2e" }}>
                Leaderboard
              </span>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color:"#7C3AED" }} />
              </div>
            ) : lbEntries.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p style={{ fontSize:11, color:"#bbb" }}>No data yet</p>
              </div>
            ) : (
              <>
                {podiumEntries.length === 3 && (
                  <div className="flex-shrink-0 flex items-end gap-1 px-3 pt-3 pb-0"
                    style={{ background:"linear-gradient(180deg,rgba(124,58,237,0.04),transparent)" }}>
                    {PODIUM_META.map(meta => {
                      const entry = podiumEntries.find(e=>e.rank===meta.rank);
                      return entry ? <PodiumSpot key={meta.rank} entry={entry} meta={meta} /> : null;
                    })}
                  </div>
                )}
                {listEntries.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0">
                      <div className="flex-1 h-px" style={{ background:"rgba(0,0,0,0.06)" }} />
                      <span style={{ fontSize:9, color:"#ccc", fontWeight:700, letterSpacing:"0.08em" }}>RANKING</span>
                      <div className="flex-1 h-px" style={{ background:"rgba(0,0,0,0.06)" }} />
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth:"none" }}>
                      <div className="flex flex-col gap-0.5 px-2 pb-2">
                        {listEntries.map((entry,i) => <LeaderboardRow key={entry.rank} entry={entry} index={i} />)}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        </div>

      </div>
    </div>
  );
}
