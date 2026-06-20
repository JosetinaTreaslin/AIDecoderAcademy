/**
 * GET /api/classroom/assignments?chapter_id=<uuid>
 *
 * Returns assignments for a chapter plus the current student's own
 * submission history for each one (so the UI can show
 * "Not started" / "Needs resubmit (N attempts)" / "Passed").
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import type { Assignment, AssignmentSubmission } from "@/types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get("chapter_id");
    if (!chapterId) return new Response("chapter_id required", { status: 400 });

    const supabase = createAdminClient();

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    if (!profileRow) return new Response("Profile not found", { status: 404 });

    const { data: assignments, error: assignmentsErr } = await supabase
      .from("assignments")
      .select("id, chapter_id, teacher_id, title, instructions, due_date, created_at")
      .eq("chapter_id", chapterId)
      .order("created_at", { ascending: false });

    if (assignmentsErr) throw assignmentsErr;

    const submissions: Record<string, AssignmentSubmission[]> = {};

    if (assignments?.length) {
      const assignmentIds = assignments.map(a => a.id);

      const { data: subRows, error: subsErr } = await supabase
        .from("assignment_submissions")
        .select("*")
        .eq("profile_id", profileRow.id)
        .in("assignment_id", assignmentIds)
        .order("attempt_number", { ascending: true });

      if (subsErr) throw subsErr;

      for (const sub of subRows ?? []) {
        if (!submissions[sub.assignment_id]) submissions[sub.assignment_id] = [];
        submissions[sub.assignment_id].push(sub as AssignmentSubmission);
      }
    }

    return Response.json({ assignments: (assignments ?? []) as Assignment[], submissions });
  } catch (err) {
    console.error("[classroom/assignments]", err);
    return new Response("Internal error", { status: 500 });
  }
}
