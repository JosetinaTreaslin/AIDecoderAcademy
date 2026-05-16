/**
 * POST /api/classroom/evaluate-written
 * Body: { paper_id, image_urls: string[], time_taken_secs?: number }
 *
 * Gate 1: Validates the image is actually a handwritten answer sheet.
 * Gate 2: Transcribe-first strict evaluation with GPT-4o-mini vision.
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import OpenAI from "openai";
import type { WrittenFeedbackItem } from "@/types";

export const runtime     = "nodejs";
export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ── Fetch and convert a URL to a base64 image part ───────────────────────────
async function toBase64Part(url: string): Promise<OpenAI.Chat.ChatCompletionContentPart> {
  const res    = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const buffer = await res.arrayBuffer();
  const mime   = res.headers.get("content-type") ?? "image/jpeg";
  const b64    = Buffer.from(buffer).toString("base64");
  return {
    type:      "image_url",
    image_url: { url: `data:${mime};base64,${b64}`, detail: "high" },
  };
}

// ── Gate 1: Is this actually a handwritten answer sheet? ─────────────────────
async function validateAnswerSheet(
  imageParts: OpenAI.Chat.ChatCompletionContentPart[]
): Promise<{ valid: boolean; reason: string }> {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: [
        ...imageParts,
        {
          type: "text",
          text: `Look at this image carefully.

Does this image show a handwritten answer sheet — i.e., paper with handwritten text that appears to be exam answers or science notes?

Answer with JSON only, no markdown:
{ "is_answer_sheet": true/false, "reason": "one sentence describing what you actually see" }

Be strict. If you see a photograph, scenery, food, printed text only, a blank page, or anything other than handwritten exam answers on paper — answer false.`,
        },
      ],
    }],
    max_tokens: 100,
    temperature: 0,
  });

  const raw   = res.choices[0].message.content ?? "{}";
  const clean = raw.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim();
  try {
    const parsed = JSON.parse(clean);
    return { valid: !!parsed.is_answer_sheet, reason: parsed.reason ?? "" };
  } catch {
    return { valid: false, reason: "Could not parse validation response." };
  }
}

// ── Gate 2: Strict transcribe-first evaluation ───────────────────────────────
const EVAL_SYSTEM = `You are a strict CBSE Class 10 Science examiner marking a handwritten answer sheet.

YOU MUST FOLLOW THIS TWO-STEP PROCESS FOR EVERY QUESTION:

STEP 1 — TRANSCRIBE: Write out word-for-word exactly what the student has written for that question. For equations, copy each one exactly. Do not paraphrase. Do not assume. If illegible, write "[illegible]".

STEP 2 — SCORE: Based ONLY on your transcription, compare against the marking scheme and award marks.

STRICT RULES:
- For list-based questions (equations, points): count transcribed items first. Score CANNOT exceed count. 3 equations transcribed = max 3 marks.
- Each mark point must be EXPLICITLY in your transcription to earn that mark.
- Do NOT award marks for anything not in your transcription.
- Do NOT give benefit of the doubt or infer meaning.
- A chemical equation is correct only if formulae AND balancing are both right. Unbalanced = 0.
- Blank or illegible = 0. Never exceed the stated maximum.

RESPONSE FORMAT — valid JSON only, no markdown:
{
  "w1": { "read": "Exactly what student wrote.", "score": 1, "max": 2, "feedback": "What was correct and what mark point was missing." }
}

The "read" field is mandatory and anchors the score.`;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { paper_id, image_urls, time_taken_secs } = await req.json() as {
      paper_id:         string;
      image_urls:       string[];
      time_taken_secs?: number;
    };

    if (!paper_id || !image_urls?.length)
      return new Response("paper_id and image_urls required", { status: 400 });

    const supabase = createAdminClient();

    const { data: profileRow } = await supabase
      .from("profiles").select("id").eq("clerk_user_id", userId).single();
    if (!profileRow) return new Response("Profile not found", { status: 404 });

    const { data: paper } = await supabase
      .from("question_papers").select("id, questions, total_marks").eq("id", paper_id).single();
    if (!paper) return new Response("Paper not found", { status: 404 });

    const questions: any[] = paper.questions as any[];

    // Convert all images to base64 once — reused across both calls
    const imageParts = await Promise.all(image_urls.map(toBase64Part));

    // ── Gate 1: reject non-answer-sheet images immediately ───────────────────
    const { valid, reason } = await validateAnswerSheet(imageParts);

    if (!valid) {
      // Build zero-score feedback for every question
      const maxScore = questions.reduce((s: number, q: any) => s + q.marks, 0);
      const feedback: Record<string, WrittenFeedbackItem> = {};
      for (const q of questions) {
        feedback[q.id] = {
          score:    0,
          max:      q.marks,
          feedback: `No handwritten answers detected. The uploaded image does not appear to be an answer sheet (${reason}). Please upload a clear photo of your written answers.`,
        };
      }

      await supabase.from("student_attempts").insert({
        profile_id:        profileRow.id,
        question_paper_id: paper_id,
        question_ids:      questions.map((q: any) => q.id),
        answers:           { image_urls },
        score:             0,
        max_score:         maxScore,
        feedback,
        time_taken_secs:   time_taken_secs ?? null,
      });

      return Response.json({ score: 0, max_score: maxScore, feedback });
    }

    // ── Gate 2: full evaluation ───────────────────────────────────────────────
    const questionsBlock = questions.map((q: any) => [
      `[${q.id} | Section ${q.section} | ${q.marks} marks]`,
      `Question: ${q.question}`,
      `Expected answer: ${q.expected_answer}`,
      `Marking scheme: ${q.marking_scheme}`,
    ].join("\n")).join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: EVAL_SYSTEM },
        {
          role: "user",
          content: [
            ...imageParts,
            {
              type: "text",
              text: `Questions and marking schemes:\n\n${questionsBlock}\n\nEvaluate the handwritten answers from the image(s) above.`,
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.2,
    });

    const raw   = completion.choices[0].message.content ?? "{}";
    const clean = raw.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim();

    let rawFeedback: Record<string, any>;
    try {
      rawFeedback = JSON.parse(clean);
    } catch {
      console.error("[evaluate-written] Parse failed:", raw.slice(0, 300));
      return new Response("Evaluation parsing failed", { status: 500 });
    }

    // Strip "read" field, cap score at question max
    const feedback: Record<string, WrittenFeedbackItem> = {};
    for (const q of questions) {
      const fb = rawFeedback[q.id];
      if (!fb) continue;
      feedback[q.id] = {
        score:    Math.min(Math.max(0, fb.score ?? 0), q.marks),
        max:      q.marks,
        feedback: fb.feedback ?? "",
      };
    }

    let score = 0, maxScore = 0;
    for (const q of questions) {
      const fb = feedback[q.id];
      if (fb) { score += fb.score; maxScore += q.marks; }
    }

    await supabase.from("student_attempts").insert({
      profile_id:        profileRow.id,
      question_paper_id: paper_id,
      question_ids:      questions.map((q: any) => q.id),
      answers:           { image_urls },
      score,
      max_score:         maxScore,
      feedback,
      time_taken_secs:   time_taken_secs ?? null,
    });

    return Response.json({ score, max_score: maxScore, feedback });
  } catch (err) {
    console.error("[classroom/evaluate-written]", err);
    return new Response("Internal error", { status: 500 });
  }
}
