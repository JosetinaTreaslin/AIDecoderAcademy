"use client";

import { useState, useEffect } from "react";
import { BookOpen, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { Chapter } from "@/types";

interface Props {
  onSelect: (chapter: Chapter) => void;
}

export function ChapterPicker({ onSelect }: Props) {
  const [chapters, setChapters]   = useState<Chapter[]>([]);
  const [grouped,  setGrouped]    = useState<Record<string, Chapter[]>>({});
  const [loading,  setLoading]    = useState(true);
  const [expanded, setExpanded]   = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/classroom/chapters")
      .then(r => r.json())
      .then(({ chapters: ch, grouped: gr }) => {
        setChapters(ch);
        setGrouped(gr);
        // Auto-expand first subject
        const firstSubject = Object.keys(gr)[0];
        if (firstSubject) setExpanded({ [firstSubject]: true });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#00D4FF" }} />
        <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>Loading chapters…</p>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.15)" }}>
          <BookOpen className="w-7 h-7 opacity-40" style={{ color: "#00D4FF" }} />
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          No chapters available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([subject, chs]) => (
        <div key={subject} className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}>
          {/* Subject header */}
          <button
            onClick={() => setExpanded(prev => ({ ...prev, [subject]: !prev[subject] }))}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-all"
            style={{ background: expanded[subject] ? "rgba(0,212,255,0.07)" : "transparent" }}
            onMouseEnter={e => { if (!expanded[subject]) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"; }}
            onMouseLeave={e => { if (!expanded[subject]) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,212,255,0.12)", border: "1px solid rgba(0,212,255,0.2)" }}>
                <BookOpen className="w-4 h-4" style={{ color: "#00D4FF" }} />
              </div>
              <div>
                <span className="font-display font-bold text-sm" style={{ color: expanded[subject] ? "#00D4FF" : "rgba(255,255,255,0.85)" }}>
                  {subject}
                </span>
                <span className="text-xs font-mono ml-2" style={{ color: "rgba(255,255,255,0.28)" }}>
                  {chs.length} chapter{chs.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            {expanded[subject]
              ? <ChevronDown className="w-4 h-4" style={{ color: "rgba(0,212,255,0.6)" }} />
              : <ChevronRight className="w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} />
            }
          </button>

          {/* Chapter list */}
          {expanded[subject] && (
            <div className="border-t divide-y" style={{ borderColor: "rgba(255,255,255,0.06)", "--tw-divide-opacity": 1 } as any}>
              {chs.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => onSelect(ch)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left transition-all group"
                  style={{ background: "transparent" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.05)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  {/* Chapter number badge */}
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-xs font-mono font-bold"
                    style={{ background: "rgba(0,212,255,0.1)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.18)" }}
                  >
                    {ch.chapter_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug" style={{ color: "rgba(255,255,255,0.9)" }}>
                      {ch.chapter_title}
                    </p>
                    <p className="text-[11px] mt-0.5 font-mono" style={{ color: "rgba(255,255,255,0.28)" }}>
                      {ch.board} · Grade {ch.grade}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-mono" style={{ color: "#00D4FF" }}>Start</span>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: "#00D4FF" }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
