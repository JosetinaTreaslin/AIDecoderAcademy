/**
 * POST /api/classroom/correct-notes
 * Body: { chapter_id: string, image_urls: string[] }
 *
 * Thin wrapper around lib/correctNotes.ts — see that file for the full
 * Kannada (Sarvam hybrid) / Chemistry-Maths (Gemini vision) pipeline.
 *
 * Returns: { accuracy_score, teacher_summary, issues[], positives[], image_urls, annotated_image_urls }
 */

import { auth }              from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import { runNotesCorrection } from "@/lib/correctNotes";

export const runtime     = "nodejs";
export const maxDuration = 180;   // Sarvam async OCR jobs can take ~30-60 s each

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { chapter_id, image_urls } = await req.json() as {
      chapter_id:  string;
      image_urls:  string[];
    };

    if (!chapter_id)         return new Response("chapter_id required", { status: 400 });
    if (!image_urls?.length) return new Response("image_urls required", { status: 400 });
    if (image_urls.length > 5) return new Response("Maximum 5 images allowed", { status: 400 });

    const supabase = createAdminClient();

    // Get profileId (needed for annotation uploads)
    const { data: profileRow } = await supabase
      .from("profiles").select("id").eq("clerk_user_id", userId).single();
    const profileId = profileRow?.id ?? userId;

    // Fetch chapter with content for the teacher reference
    const { data: chapter } = await supabase
      .from("chapters")
      .select("id, chapter_title, subject, content_text")
      .eq("id", chapter_id)
      .single();

    if (!chapter) return new Response("Chapter not found", { status: 404 });

    if (!chapter.content_text) {
      return new Response("Chapter has no reference content", { status: 422 });
    }

    const result = await runNotesCorrection(image_urls, chapter, profileId);

    return Response.json({ ...result, image_urls });

  } catch (err: any) {
    const detail = err?.error ?? err?.message ?? err;
    console.error("[classroom/correct-notes]", JSON.stringify(detail, null, 2));
    const msg = err?.error?.message ?? err?.message ?? "Internal error";
    return new Response(msg, { status: err?.status ?? 500 });
  }
}
