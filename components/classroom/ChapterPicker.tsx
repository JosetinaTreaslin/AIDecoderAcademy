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
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#00D4FF" }} />
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-60">
        <BookOpen className="w-10 h-10" style={{ color: "#00D4FF" }} />
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          No chapters available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {Object.entries(grouped).map(([subject, chs]) => (
        <div key={subject}>
          {/* Subject header */}
          <button
            onClick={() => setExpanded(prev => ({ ...prev, [subject]: !prev[subject] }))}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-left transition-all"
            style={{
              background:   "rgba(0,212,255,0.08)",
              border:       "1px solid rgba(0,212,255,0.2)",
              color:        "#00D4FF",
            }}
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="font-display font-bold text-sm uppercase tracking-wider">
                {subject}
              </span>
              <span className="text-xs opacity-60 font-mono">
                {chs.length} chapter{chs.length !== 1 ? "s" : ""}
              </span>
            </div>
            {expanded[subject]
              ? <ChevronDown className="w-4 h-4 opacity-60" />
              : <ChevronRight className="w-4 h-4 opacity-60" />
            }
          </button>

          {/* Chapter list */}
          {expanded[subject] && (
            <div className="mt-1 ml-3 space-y-1">
              {chs.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => onSelect(ch)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all group"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border:     "1px solid rgba(255,255,255,0.07)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(0,212,255,0.07)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.25)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)";
                  }}
                >
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-mono font-bold"
                    style={{ background: "rgba(0,212,255,0.12)", color: "#00D4FF" }}
                  >
                    {ch.chapter_number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>
                      {ch.chapter_title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {ch.board} · Grade {ch.grade}
                    </p>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0"
                    style={{ color: "#00D4FF" }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
