/**
 * GET  /api/teacher/assignments
 * Returns all assignments created by this teacher, joined with chapter
 * info and submission stats (total submitted, total passed, avg score).
 *
 * POST /api/teacher/assignments
 * Body: { chapter_id: string, title: string, instructions?: string, due_date?: string }
 * Creates a new assignment owned by this teacher.
 */

import { auth }              from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import type { Assignment } from "@/types";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const supabase = createAdminClient();

  const { data: teacherRow } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!teacherRow) return new Response("Forbidden — teacher profile required", { status: 403 });

  const { data: assignments, error } = await supabase
    .from("assignments")
    .select("id, chapter_id, teacher_id, title, instructions, due_date, created_at, chapters ( chapter_title, subject )")
    .eq("teacher_id", teacherRow.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[teacher/assignments GET]", error);
    return new Response("Internal error", { status: 500 });
  }

  if (!assignments?.length) return Response.json({ assignments: [] });

  const assignmentIds = assignments.map(a => a.id);

  const { data: submissions } = await supabase
    .from("assignment_submissions")
    .select("assignment_id, profile_id, accuracy_score, status")
    .in("assignment_id", assignmentIds);

  type Stat = { submittedCount: number; passedCount: number; totalScore: number; students: Set<string> };
  const statMap = new Map<string, Stat>();
  for (const sub of submissions ?? []) {
    const s = statMap.get(sub.assignment_id) ?? { submittedCount: 0, passedCount: 0, totalScore: 0, students: new Set() };
    s.submittedCount += 1;
    s.totalScore     += sub.accuracy_score ?? 0;
    if (sub.status === "passed") s.passedCount += 1;
    s.students.add(sub.profile_id);
    statMap.set(sub.assignment_id, s);
  }

  const result = assignments.map(a => {
    const chapter = Array.isArray(a.chapters) ? a.chapters[0] : a.chapters;
    const s = statMap.get(a.id);
    return {
      id:             a.id,
      chapter_id:     a.chapter_id,
      teacher_id:     a.teacher_id,
      title:          a.title,
      instructions:   a.instructions ?? undefined,
      due_date:       a.due_date ?? undefined,
      created_at:     a.created_at,
      chapter_title:  chapter?.chapter_title,
      subject:        chapter?.subject,
      students_submitted: s?.students.size ?? 0,
      students_passed:    s?.passedCount ?? 0,
      avg_score_pct:      s ? Math.round(s.totalScore / s.submittedCount) : 0,
    };
  });

  return Response.json({ assignments: result });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { chapter_id, title, instructions, due_date } = await req.json() as {
    chapter_id:    string;
    title:         string;
    instructions?: string;
    due_date?:     string;
  };

  if (!chapter_id)   return new Response("chapter_id required", { status: 400 });
  if (!title?.trim()) return new Response("title required", { status: 400 });

  const supabase = createAdminClient();

  const { data: teacherRow } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!teacherRow) return new Response("Forbidden — teacher profile required", { status: 403 });

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      chapter_id,
      teacher_id:   teacherRow.id,
      title:        title.trim(),
      instructions: instructions?.trim() || null,
      due_date:     due_date || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("[teacher/assignments POST]", error);
    return new Response("Internal error", { status: 500 });
  }

  return Response.json({ assignment: data as Assignment });
}
