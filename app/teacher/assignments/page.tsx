"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, ChevronRight } from "lucide-react";
import type { Chapter } from "@/types";

const INTER = "var(--font-inter), system-ui, sans-serif";

interface AssignmentRow {
  id:                 string;
  chapter_id:         string;
  title:              string;
  instructions?:      string;
  due_date?:          string;
  created_at:         string;
  chapter_title?:     string;
  subject?:           string;
  students_submitted: number;
  students_passed:    number;
  avg_score_pct:      number;
}

function ScoreBar({ pct, width = 56 }: { pct: number; width?: number }) {
  const color      = pct >= 70 ? "#16A34A" : pct >= 40 ? "#D97706" : "#DC2626";
  const trackColor = pct >= 70 ? "#DCFCE7" : pct >= 40 ? "#FEF3C7" : "#FEE2E2";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{ width, height: 5, borderRadius: 99, background: trackColor, flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: color }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 30 }}>{pct}%</span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── New Assignment modal ────────────────────────────────────────────────────
function NewAssignmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (a: AssignmentRow) => void }) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/classroom/chapters").then(r => r.ok ? r.json() : { chapters: [] })
      .then(d => setChapters(d.chapters ?? [])).catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Chapter[]> = {};
    for (const ch of chapters) {
      if (!map[ch.subject]) map[ch.subject] = [];
      map[ch.subject]!.push(ch);
    }
    return map;
  }, [chapters]);

  const handleCreate = async () => {
    if (!chapterId)     { setError("Select a chapter."); return; }
    if (!title.trim())  { setError("Enter a title."); return; }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/teacher/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapter_id: chapterId,
          title: title.trim(),
          instructions: instructions.trim() || undefined,
          due_date: dueDate || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { assignment } = await res.json();
      const chapter = chapters.find(c => c.id === chapterId);
      onCreated({
        ...assignment,
        chapter_title: chapter?.chapter_title,
        subject: chapter?.subject,
        students_submitted: 0,
        students_passed: 0,
        avg_score_pct: 0,
      });
    } catch (e: any) {
      setError(e.message || "Failed to create assignment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480, background: "#fff", borderRadius: 16,
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", maxHeight: "90vh",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>New Assignment</h3>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E5E7EB", background: "#F9FAFB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ width: 15, height: 15, color: "#6B7280" }} />
          </button>
        </div>

        <div style={{ padding: 20, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Chapter</label>
            <select value={chapterId} onChange={e => setChapterId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, color: "#111827", background: "#fff" }}>
              <option value="">Select a chapter…</option>
              {Object.entries(grouped).map(([subject, chs]) => (
                <optgroup key={subject} label={subject}>
                  {chs.map(ch => (
                    <option key={ch.id} value={ch.id}>
                      Ch {ch.chapter_number} — {ch.chapter_title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 3 classwork notes"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, color: "#111827" }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Instructions (optional)</label>
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3}
              placeholder="e.g. Write notes covering all definitions and examples from the chapter."
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, color: "#111827", resize: "vertical", fontFamily: INTER }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Due date (optional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, color: "#111827" }} />
          </div>

          {error && <p style={{ margin: 0, fontSize: 12, color: "#DC2626" }}>{error}</p>}
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Creating…" : "Create Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function TeacherAssignmentsPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch("/api/teacher/assignments").then(r => r.ok ? r.json() : { assignments: [] })
      .then(d => setAssignments(d.assignments ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: INTER }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Assignments</h1>
          <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
            Classwork assignments that students complete and submit for auto-grading.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 16px", borderRadius: 8, border: "none",
          background: "#2563EB", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          <Plus style={{ width: 14, height: 14 }} /> New Assignment
        </button>
      </div>

      {loading && <p style={{ fontSize: 13, color: "#9CA3AF" }}>Loading…</p>}

      {!loading && assignments.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", padding: 32, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No assignments yet. Create one to get started.</p>
        </div>
      )}

      {!loading && assignments.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Title", "Chapter", "Created", "Submitted", "Passed", "Avg Score", ""].map((h, i) => (
                  <th key={i} style={{
                    padding: "10px 16px", textAlign: "left",
                    fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                    color: "#9CA3AF", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB",
                    whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a, i) => (
                <tr key={a.id} onClick={() => router.push(`/teacher/assignments/${a.id}`)}
                  style={{ cursor: "pointer", borderBottom: i < assignments.length - 1 ? "1px solid #F3F4F6" : "none" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{a.title}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>{a.chapter_title ?? "—"}</span>
                    {a.subject && <span style={{ fontSize: 12, color: "#9CA3AF" }}> · {a.subject}</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 13, color: "#6B7280" }}>{timeAgo(a.created_at)}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>{a.students_submitted}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>{a.students_passed}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {a.students_submitted > 0 ? <ScoreBar pct={a.avg_score_pct} /> : <span style={{ color: "#D1D5DB", fontSize: 13 }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <ChevronRight style={{ width: 14, height: 14, color: "#D1D5DB" }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <NewAssignmentModal
          onClose={() => setShowModal(false)}
          onCreated={(a) => { setAssignments(prev => [a, ...prev]); setShowModal(false); }}
        />
      )}
    </div>
  );
}
