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
          className="flex items-center gap-1.5 text-sm transition-all px-3 py-1.5 rounded-lg"
          style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.5)"; }}
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: "rgba(0,212,255,0.6)" }}>
            Chapter {chapter.chapter_number}
          </p>
          <p className="text-sm font-display font-bold mt-0.5 max-w-[200px] truncate" style={{ color: "rgba(255,255,255,0.92)" }}>
            {chapter.chapter_title}
          </p>
        </div>
        <div className="w-20" />
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col justify-center px-6 py-6 gap-4">
        <div className="text-center mb-1">
          <p className="text-xs font-mono uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
            Choose your test type
          </p>
        </div>

        {/* MCQ card */}
        <button
          onClick={() => onSelect("mcq")}
          className="w-full rounded-2xl p-6 text-left transition-all"
          style={{
            background: "rgba(0,212,255,0.04)",
            border:     "1px solid rgba(0,212,255,0.18)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background  = "rgba(0,212,255,0.09)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.38)";
            (e.currentTarget as HTMLElement).style.boxShadow   = "0 0 40px rgba(0,212,255,0.1), inset 0 1px 0 rgba(0,212,255,0.12)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background  = "rgba(0,212,255,0.04)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,212,255,0.18)";
            (e.currentTarget as HTMLElement).style.boxShadow   = "none";
          }}
        >
          <div className="flex items-start gap-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.06))", border: "1px solid rgba(0,212,255,0.3)", boxShadow: "0 0 20px rgba(0,212,255,0.15)" }}>
              <Brain className="w-6 h-6" style={{ color: "#00D4FF" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-2">
                <h3 className="font-display font-black text-base" style={{ color: "#ffffff" }}>MCQ Test</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(0,212,255,0.15)", color: "#00D4FF", border: "1px solid rgba(0,212,255,0.25)" }}>
                  Phase 1
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
                15 multiple-choice questions randomly selected from a bank of 40.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <BarChart3 className="w-3 h-3" style={{ color: "rgba(0,212,255,0.5)" }} />
                  <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                    7 easy · 5 medium · 3 hard
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Clock className="w-3 h-3" style={{ color: "rgba(0,212,255,0.5)" }} />
                  <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>~20 min</span>
                </div>
              </div>
            </div>
          </div>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
          <span className="text-[10px] font-mono uppercase" style={{ color: "rgba(255,255,255,0.2)" }}>or</span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Written card */}
        <button
          onClick={() => onSelect("written")}
          className="w-full rounded-2xl p-6 text-left transition-all"
          style={{
            background: "rgba(255,184,0,0.04)",
            border:     "1px solid rgba(255,184,0,0.18)",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background  = "rgba(255,184,0,0.09)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,184,0,0.38)";
            (e.currentTarget as HTMLElement).style.boxShadow   = "0 0 40px rgba(255,184,0,0.1), inset 0 1px 0 rgba(255,184,0,0.1)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background  = "rgba(255,184,0,0.04)";
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,184,0,0.18)";
            (e.currentTarget as HTMLElement).style.boxShadow   = "none";
          }}
        >
          <div className="flex items-start gap-5">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(255,184,0,0.2), rgba(255,184,0,0.06))", border: "1px solid rgba(255,184,0,0.3)", boxShadow: "0 0 20px rgba(255,184,0,0.12)" }}>
              <PenLine className="w-6 h-6" style={{ color: "#FFB800" }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2.5 mb-2">
                <h3 className="font-display font-black text-base" style={{ color: "#ffffff" }}>Written Test</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,184,0,0.15)", color: "#FFB800", border: "1px solid rgba(255,184,0,0.25)" }}>
                  Phase 2
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
                CBSE-style question paper. Write on paper, then upload photos for AI evaluation.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <BarChart3 className="w-3 h-3" style={{ color: "rgba(255,184,0,0.5)" }} />
                  <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                    24 marks · Sec A / B / C
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Clock className="w-3 h-3" style={{ color: "rgba(255,184,0,0.5)" }} />
                  <span className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>45 min</span>
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
