/**
 * POST /api/classroom/evaluate-written
 * Body: { paper_id, image_urls: string[], time_taken_secs?: number }
 *
 * Sends the question paper + marking scheme + uploaded answer-sheet images
 * to GPT-4o vision for evaluation.
 * Returns: { score, max_score, feedback: Record<qId, { score, max, feedback }> }
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import OpenAI from "openai";
import type { WrittenFeedbackItem } from "@/types";

export const runtime  = "nodejs";
export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { paper_id, image_urls, time_taken_secs } = await req.json() as {
      paper_id:          string;
      image_urls:        string[];
      time_taken_secs?:  number;
    };

    if (!paper_id || !image_urls?.length) {
      return new Response("paper_id and image_urls required", { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    if (!profileRow) return new Response("Profile not found", { status: 404 });

    // Fetch the written paper (includes expected_answer + marking_scheme)
    const { data: paper } = await supabase
      .from("question_papers")
      .select("id, questions, total_marks")
      .eq("id", paper_id)
      .single();

    if (!paper) return new Response("Paper not found", { status: 404 });

    const questions: any[] = paper.questions as any[];

    // Build the evaluation prompt
    const questionsBlock = questions.map(q => {
      const sectionLabel = q.marks <= 2 ? "Short answer" : q.marks <= 4 ? "Medium answer" : "Long answer";
      return [
        `[${q.id} | Section ${q.section} | ${q.marks} marks | ${sectionLabel}]`,
        `Question: ${q.question}`,
        `Expected answer: ${q.expected_answer}`,
        `Marking scheme: ${q.marking_scheme}`,
      ].join("\n");
    }).join("\n\n");

    const systemPrompt = `You are an experienced CBSE Class 10 Science examiner evaluating a student's handwritten answer sheet.

You will be shown images of the student's handwritten answers, followed by the questions and marking schemes.

Your task:
- Carefully read each handwritten answer in the images
- Evaluate it against the expected answer and marking scheme
- Award marks fairly — give partial credit where the student shows partial understanding
- Be strict about factual accuracy but fair about expression

Return ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "w1": { "score": 1, "max": 2, "feedback": "One or two sentences of specific feedback." },
  "w2": { "score": 2, "max": 2, "feedback": "..." },
  ...
}

The feedback should be specific — mention what the student got right and what was missing.`;

    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      {
        type: "text",
        text: `Here are the questions and marking schemes:\n\n${questionsBlock}\n\nPlease evaluate the student's handwritten answers shown in the image(s) above.`,
      },
      // Images first so GPT-4o sees them before the text prompt
      ...image_urls.map(url => ({
        type: "image_url" as const,
        image_url: { url, detail: "high" as const },
      })),
    ];

    // Reorder: images first, then text
    const orderedContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      ...image_urls.map(url => ({
        type: "image_url" as const,
        image_url: { url, detail: "high" as const },
      })),
      {
        type: "text" as const,
        text: `Here are the questions and marking schemes:\n\n${questionsBlock}\n\nEvaluate the student's handwritten answers from the image(s) above.`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: orderedContent },
      ],
      max_tokens: 2000,
      temperature: 0.2,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const clean = raw.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim();

    let feedback: Record<string, WrittenFeedbackItem>;
    try {
      feedback = JSON.parse(clean);
    } catch {
      console.error("[evaluate-written] Failed to parse GPT response:", raw.slice(0, 300));
      return new Response("Evaluation parsing failed", { status: 500 });
    }

    // Calculate total score
    let score    = 0;
    let maxScore = 0;
    for (const q of questions) {
      const fb = feedback[q.id];
      if (fb) {
        score    += Math.min(fb.score ?? 0, q.marks);
        maxScore += q.marks;
      }
    }

    const questionIds = questions.map(q => q.id);

    // Store attempt
    await supabase.from("student_attempts").insert({
      profile_id:        profileRow.id,
      question_paper_id: paper_id,
      question_ids:      questionIds,
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
