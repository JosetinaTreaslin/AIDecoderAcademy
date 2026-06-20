/**
 * GET /api/teacher/assignments/[id]
 * Returns the assignment (with chapter info) plus every submission,
 * each joined with the student's profile (display_name, avatar).
 *
 * Response: {
 *   assignment: Assignment,
 *   submissions: (AssignmentSubmission & { student: { id, display_name, avatar_emoji, avatar_url } })[]
 * }
 */

import { auth }              from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import type { Assignment, AssignmentSubmission } from "@/types";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const supabase = createAdminClient();

  const { data: teacherRow } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!teacherRow) return new Response("Forbidden — teacher profile required", { status: 403 });

  const { data: assignmentRow, error: assignmentErr } = await supabase
    .from("assignments")
    .select("id, chapter_id, teacher_id, title, instructions, due_date, created_at, chapters ( chapter_title, subject )")
    .eq("id", id)
    .single();

  if (assignmentErr || !assignmentRow) return new Response("Assignment not found", { status: 404 });

  const chapter = Array.isArray(assignmentRow.chapters) ? assignmentRow.chapters[0] : assignmentRow.chapters;

  const assignment: Assignment = {
    id:            assignmentRow.id,
    chapter_id:    assignmentRow.chapter_id,
    teacher_id:    assignmentRow.teacher_id,
    title:         assignmentRow.title,
    instructions:  assignmentRow.instructions ?? undefined,
    due_date:      assignmentRow.due_date ?? undefined,
    created_at:    assignmentRow.created_at,
    chapter_title: chapter?.chapter_title,
    subject:       chapter?.subject,
  };

  const { data: subRows, error: subsErr } = await supabase
    .from("assignment_submissions")
    .select("*")
    .eq("assignment_id", id)
    .order("profile_id", { ascending: true })
    .order("attempt_number", { ascending: true });

  if (subsErr) {
    console.error("[teacher/assignments/[id] GET]", subsErr);
    return new Response("Internal error", { status: 500 });
  }

  let students: Record<string, { id: string; display_name: string; avatar_emoji: string; avatar_url?: string }> = {};

  if (subRows?.length) {
    const profileIds = [...new Set(subRows.map(s => s.profile_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_emoji, avatar_url")
      .in("id", profileIds);

    for (const p of profiles ?? []) {
      students[p.id] = {
        id:           p.id,
        display_name: p.display_name,
        avatar_emoji: p.avatar_emoji,
        avatar_url:   p.avatar_url ?? undefined,
      };
    }
  }

  const submissions = (subRows ?? []).map(s => ({
    ...(s as AssignmentSubmission),
    student: students[s.profile_id],
  }));

  return Response.json({ assignment, submissions });
}
