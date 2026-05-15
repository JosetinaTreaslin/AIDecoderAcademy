"use client";

import { Brain, PenLine, Clock, BarChart3, ChevronLeft } from "lucide-react";
import type { Chapter } from "@/types";

interface Props {
  chapter: Chapter;
  onSelect: (type: "mcq" | "written") => void;
  onBack:   () => void;
}

export function TestTypeSelector({ chapter, onSelect, onBack }: Props) {
  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: "rgba(255,255,255,0.8)" }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="text-center">
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(0,212,255,0.7)" }}>
            Chapter {chapter.chapter_number}
          </p>
          <p className="text-sm font-display font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.9)" }}>
            {chapter.chapter_title}
          </p>
        </div>
        <div className="w-16" />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 gap-4">
        <p className="text-center text-xs font-mono uppercase tracking-widest mb-2"
          style={{ color: "rgba(255,255,255,0.3)" }}>
          Choose test type
        </p>

        {/* MCQ card */}
        <button
          onClick={() => onSelect("mcq")}
          className="w-full rounded-2xl p-5 text-left transition-all group"
          style={{
            background: "rgba(0,212,255,0.05)",
            border:     "1px solid rgba(0,212,255,0.2)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background   = "rgba(0,212,255,0.1)";
            (e.currentTarget as HTMLElement).style.borderColor  = "rgba(0,212,255,0.4)";
            (e.currentTarget as HTMLElement).style.boxShadow    = "0 0 32px rgba(0,212,255,0.12)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background   = "rgba(0,212,255,0.05)";
            (e.currentTarget as HTMLElement).style.borderColor  = "rgba(0,212,255,0.2)";
            (e.currentTarget as HTMLElement).style.boxShadow    = "none";
          }}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.3)" }}>
              <Brain className="w-5 h-5" style={{ color: "#00D4FF" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display font-bold text-sm" style={{ color: "#ffffff" }}>
                  MCQ Test
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(0,212,255,0.12)", color: "#00D4FF" }}>
                  Phase 1
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                15 multiple-choice questions randomly selected from a bank of 40.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    7 easy · 5 medium · 3 hard
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>~20 min</span>
                </div>
              </div>
            </div>
          </div>
        </button>

        {/* Written card */}
        <button
          onClick={() => onSelect("written")}
          className="w-full rounded-2xl p-5 text-left transition-all group"
          style={{
            background: "rgba(255,184,0,0.05)",
            border:     "1px solid rgba(255,184,0,0.2)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background   = "rgba(255,184,0,0.1)";
            (e.currentTarget as HTMLElement).style.borderColor  = "rgba(255,184,0,0.4)";
            (e.currentTarget as HTMLElement).style.boxShadow    = "0 0 32px rgba(255,184,0,0.1)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background   = "rgba(255,184,0,0.05)";
            (e.currentTarget as HTMLElement).style.borderColor  = "rgba(255,184,0,0.2)";
            (e.currentTarget as HTMLElement).style.boxShadow    = "none";
          }}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,184,0,0.12)", border: "1px solid rgba(255,184,0,0.3)" }}>
              <PenLine className="w-5 h-5" style={{ color: "#FFB800" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display font-bold text-sm" style={{ color: "#ffffff" }}>
                  Written Test
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(255,184,0,0.12)", color: "#FFB800" }}>
                  Phase 2
                </span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                CBSE-style question paper. Write your answers on paper, then upload photos for AI evaluation.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    24 marks · Sec A / B / C
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>45 min</span>
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
