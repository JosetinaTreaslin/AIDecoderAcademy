/**
 * POST /api/classroom/assignment-submit
 * Body: { assignment_id: string, image_urls: string[] }
 *
 * Runs the shared notes-correction pipeline (lib/correctNotes.ts) against
 * the assignment's chapter, computes the attempt number and pass/fail
 * status (>= 80% accuracy passes), and stores the submission.
 */

import { auth }               from "@clerk/nextjs/server";
import { createAdminClient }  from "@/lib/supabase";
import { runNotesCorrection } from "@/lib/correctNotes";
import type { AssignmentSubmission, AssignmentStatus } from "@/types";

export const runtime     = "nodejs";
export const maxDuration = 180;

const PASS_THRESHOLD = 80;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { assignment_id, image_urls } = await req.json() as {
      assignment_id: string;
      image_urls:    string[];
    };

    if (!assignment_id)      return new Response("assignment_id required", { status: 400 });
    if (!image_urls?.length) return new Response("image_urls required", { status: 400 });
    if (image_urls.length > 5) return new Response("Maximum 5 images allowed", { status: 400 });

    const supabase = createAdminClient();

    const { data: profileRow } = await supabase
      .from("profiles").select("id").eq("clerk_user_id", userId).single();
    if (!profileRow) return new Response("Profile not found", { status: 404 });

    const { data: assignment } = await supabase
      .from("assignments")
      .select("id, chapter_id, chapters ( chapter_title, subject, content_text )")
      .eq("id", assignment_id)
      .single();

    if (!assignment) return new Response("Assignment not found", { status: 404 });

    const chapter = Array.isArray(assignment.chapters) ? assignment.chapters[0] : assignment.chapters;
    if (!chapter?.content_text) {
      return new Response("Chapter has no reference content", { status: 422 });
    }

    const result = await runNotesCorrection(image_urls, chapter, profileRow.id);

    // Compute attempt number — count this student's prior submissions for this assignment
    const { count } = await supabase
      .from("assignment_submissions")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", assignment_id)
      .eq("profile_id", profileRow.id);

    const attemptNumber = (count ?? 0) + 1;
    const status: AssignmentStatus = result.accuracy_score >= PASS_THRESHOLD ? "passed" : "needs_resubmit";

    const { data: inserted, error: insertErr } = await supabase
      .from("assignment_submissions")
      .insert({
        assignment_id,
        profile_id:           profileRow.id,
        attempt_number:       attemptNumber,
        image_urls,
        annotated_image_urls: result.annotated_image_urls,
        accuracy_score:       result.accuracy_score,
        teacher_summary:      result.teacher_summary,
        issues:               result.issues,
        positives:            result.positives,
        status,
      })
      .select("*")
      .single();

    if (insertErr) throw insertErr;

    return Response.json({ submission: inserted as AssignmentSubmission });
  } catch (err: any) {
    const detail = err?.error ?? err?.message ?? err;
    console.error("[classroom/assignment-submit]", JSON.stringify(detail, null, 2));
    const msg = err?.error?.message ?? err?.message ?? "Internal error";
    return new Response(msg, { status: err?.status ?? 500 });
  }
}
