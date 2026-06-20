"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, ChevronLeft as PrevIcon, ChevronRight as NextIcon } from "lucide-react";
import type { Assignment, AssignmentSubmission, CorrectionIssue } from "@/types";

const INTER = "var(--font-inter), system-ui, sans-serif";

type Student = { id: string; display_name: string; avatar_emoji: string; avatar_url?: string };
type SubmissionRow = AssignmentSubmission & { student: Student };

interface AssignmentDetail {
  assignment:  Assignment;
  submissions: SubmissionRow[];
}

function scoreColor(pct: number) {
  return pct >= 80 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";
}
function scoreTrack(pct: number) {
  return pct >= 80 ? "#DCFCE7" : pct >= 50 ? "#FEF3C7" : "#FEE2E2";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  passed:         { label: "Passed",         color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  needs_resubmit: { label: "Needs Resubmit", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.needs_resubmit!;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 20,
      fontSize: 12, fontWeight: 500,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function AvatarCell({ student }: { student: Student }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {student.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={student.avatar_url} alt=""
          style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #E5E7EB" }} />
      ) : (
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 15, background: "#EFF6FF", border: "1px solid #E5E7EB",
        }}>
          {student.avatar_emoji}
        </div>
      )}
      <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{student.display_name}</span>
    </div>
  );
}

// ── Submission detail modal ──────────────────────────────────────────────────
function SubmissionModal({ submission, onClose }: { submission: SubmissionRow; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const images = submission.annotated_image_urls?.length ? submission.annotated_image_urls : submission.image_urls;
  const issues: CorrectionIssue[] = submission.issues ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")     onClose();
      if (e.key === "ArrowRight") setPage(p => Math.min(p + 1, images.length - 1));
      if (e.key === "ArrowLeft")  setPage(p => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 50,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 900, maxHeight: "90vh",
        background: "#fff", borderRadius: 16, overflow: "hidden",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid #E5E7EB", flexShrink: 0,
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111827" }}>
              {submission.student.display_name} — Attempt #{submission.attempt_number}
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: 13, color: "#6B7280" }}>
              {submission.accuracy_score}/100 · {timeAgo(submission.submitted_at)}
            </p>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: "1px solid #E5E7EB",
            background: "#F9FAFB", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <X style={{ width: 15, height: 15, color: "#6B7280" }} />
          </button>
        </div>

        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Left: images */}
          <div style={{ flex: "0 0 55%", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column" }}>
            {images.length > 0 ? (
              <>
                <div style={{ flex: 1, minHeight: 0, overflow: "hidden", position: "relative", background: "#F3F4F6" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={images[page]} alt={`Page ${page + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                </div>
                {images.length > 1 && (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                    padding: "10px 16px", borderTop: "1px solid #E5E7EB", flexShrink: 0,
                    background: "#fff",
                  }}>
                    <button onClick={() => setPage(p => Math.max(p - 1, 0))} disabled={page === 0}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", cursor: page === 0 ? "not-allowed" : "pointer", background: page === 0 ? "#F9FAFB" : "#fff" }}>
                      <PrevIcon style={{ width: 14, height: 14, color: page === 0 ? "#D1D5DB" : "#374151" }} />
                    </button>
                    <span style={{ fontSize: 13, color: "#6B7280" }}>Page {page + 1} of {images.length}</span>
                    <button onClick={() => setPage(p => Math.min(p + 1, images.length - 1))} disabled={page === images.length - 1}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", cursor: page === images.length - 1 ? "not-allowed" : "pointer", background: page === images.length - 1 ? "#F9FAFB" : "#fff" }}>
                      <NextIcon style={{ width: 14, height: 14, color: page === images.length - 1 ? "#D1D5DB" : "#374151" }} />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 14 }}>
                No images available.
              </div>
            )}
          </div>

          {/* Right: summary + issues */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 20px" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Teacher Summary
            </h4>
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6B7280", lineHeight: 1.6, background: "#F9FAFB", padding: "8px 10px", borderRadius: 6 }}>
              {submission.teacher_summary || "—"}
            </p>

            {submission.positives?.length > 0 && (
              <>
                <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  What went well
                </h4>
                <ul style={{ margin: "0 0 16px", paddingLeft: 18 }}>
                  {submission.positives.map((p, i) => (
                    <li key={i} style={{ fontSize: 13, color: "#16A34A", marginBottom: 4 }}>{p}</li>
                  ))}
                </ul>
              </>
            )}

            <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Issues ({issues.length})
            </h4>
            {issues.length === 0 && (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>No issues found.</p>
            )}
            {issues.map((issue, i) => (
              <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #F3F4F6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em",
                    padding: "2px 6px", borderRadius: 4,
                    color: issue.severity === "high" ? "#DC2626" : "#D97706",
                    background: issue.severity === "high" ? "#FEF2F2" : "#FFFBEB",
                  }}>
                    {issue.type.replace(/_/g, " ")}
                  </span>
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>{issue.severity}</span>
                </div>
                {issue.student_wrote && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontFamily: "monospace", color: "#DC2626", textDecoration: "line-through", background: "#FEF2F2", padding: "2px 6px", borderRadius: 4 }}>
                      {issue.student_wrote}
                    </span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>→</span>
                    <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#16A34A", background: "#F0FDF4", padding: "2px 6px", borderRadius: 4 }}>
                      {issue.correct_version}
                    </span>
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>{issue.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function TeacherAssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SubmissionRow | null>(null);

  useEffect(() => {
    fetch(`/api/teacher/assignments/${id}`)
      .then(r => { if (!r.ok) throw new Error("Failed to load assignment"); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: INTER }}>
      <p style={{ fontSize: 13, color: "#9CA3AF" }}>Loading…</p>
    </div>;
  }

  if (error || !data) {
    return <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: INTER }}>
      <p style={{ fontSize: 13, color: "#DC2626" }}>{error || "Assignment not found."}</p>
    </div>;
  }

  const { assignment, submissions } = data;

  // Group submissions by student, latest attempt first per group
  const byStudent = new Map<string, SubmissionRow[]>();
  for (const s of submissions) {
    if (!byStudent.has(s.profile_id)) byStudent.set(s.profile_id, []);
    byStudent.get(s.profile_id)!.push(s);
  }
  const studentGroups = [...byStudent.values()].map(group =>
    [...group].sort((a, b) => b.attempt_number - a.attempt_number)
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: INTER }}>
      <button onClick={() => router.push("/teacher/assignments")} style={{
        display: "flex", alignItems: "center", gap: 4, marginBottom: 14,
        fontSize: 13, color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: 0,
      }}>
        <ChevronLeft style={{ width: 14, height: 14 }} /> Back to Assignments
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>{assignment.title}</h1>
      <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
        {assignment.chapter_title} {assignment.subject ? `· ${assignment.subject}` : ""}
      </p>
      {assignment.instructions && (
        <div style={{ marginTop: 12, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>{assignment.instructions}</p>
        </div>
      )}

      <div style={{ marginTop: 20, background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Student", "Attempts", "Latest Score", "Status", "Last Submitted", ""].map((h, i) => (
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
            {studentGroups.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "#9CA3AF" }}>
                No submissions yet.
              </td></tr>
            )}
            {studentGroups.map((group, i) => {
              const latest = group[0]!;
              return (
                <tr key={latest.profile_id} onClick={() => setSelected(latest)}
                  style={{ cursor: "pointer", borderBottom: i < studentGroups.length - 1 ? "1px solid #F3F4F6" : "none" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "12px 16px" }}><AvatarCell student={latest.student} /></td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 13, color: "#374151" }}>{group.length}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: scoreColor(latest.accuracy_score),
                      padding: "1px 8px", borderRadius: 6, background: scoreTrack(latest.accuracy_score),
                    }}>
                      {latest.accuracy_score}%
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}><StatusChip status={latest.status} /></td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 13, color: "#6B7280" }}>{timeAgo(latest.submitted_at)}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <ChevronRight style={{ width: 14, height: 14, color: "#D1D5DB" }} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected && <SubmissionModal submission={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
