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

    const systemPrompt = `You are a strict CBSE Class 10 Science examiner marking a handwritten answer sheet.

YOU MUST FOLLOW THIS TWO-STEP PROCESS FOR EVERY QUESTION:

STEP 1 — TRANSCRIBE: Read the student's handwriting carefully and write out word-for-word exactly what the student has written for that question. For chemical equations, copy each equation exactly as written, one by one. Do not paraphrase. Do not assume. If something is illegible, write "[illegible]".

STEP 2 — SCORE: Based ONLY on your transcription, compare against the marking scheme and award marks.

STRICT RULES:
- For list-based questions (equations, points, methods): count your transcribed items first. The score CANNOT exceed the number of items you transcribed. If you transcribed 3 equations, maximum score is 3.
- Each mark point must be EXPLICITLY present in your transcription to earn that mark.
- Do NOT award marks for anything not in your transcription.
- Do NOT give benefit of the doubt or infer meaning.
- A chemical equation is correct only if the formulae AND balancing are both right. If it is unbalanced, award 0 for that equation.
- Blank or illegible answers = 0.
- Never award more than the stated maximum.

RESPONSE FORMAT — return ONLY a valid JSON object, no markdown, no extra text:
{
  "w1": {
    "read": "Exactly what the student wrote for question w1.",
    "score": 1,
    "max": 2,
    "feedback": "1-3 sentences: what was correct and exactly which mark point was missing."
  }
}

The "read" field is mandatory. It anchors the score — your score must be consistent with what you wrote in "read".`;

    // Fetch images server-side and convert to base64 — OpenAI can't reach Supabase Storage URLs directly
    const imageparts: OpenAI.Chat.ChatCompletionContentPart[] = await Promise.all(
      image_urls.map(async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
        const buffer = await res.arrayBuffer();
        const mime   = res.headers.get("content-type") ?? "image/jpeg";
        const b64    = Buffer.from(buffer).toString("base64");
        return {
          type: "image_url" as const,
          image_url: { url: `data:${mime};base64,${b64}`, detail: "high" as const },
        };
      })
    );

    const orderedContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      ...imageparts,
      {
        type: "text" as const,
        text: `Here are the questions and marking schemes:\n\n${questionsBlock}\n\nEvaluate the student's handwritten answers from the image(s) above.`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: orderedContent },
      ],
      max_tokens: 2000,
      temperature: 0.2,
    });

    const raw = completion.choices[0].message.content ?? "{}";
    const clean = raw.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim();

    let rawFeedback: Record<string, any>;
    try {
      rawFeedback = JSON.parse(clean);
    } catch {
      console.error("[evaluate-written] Failed to parse GPT response:", raw.slice(0, 300));
      return new Response("Evaluation parsing failed", { status: 500 });
    }

    // Strip the "read" field from the response (internal reasoning, not shown to student)
    // and cap score at max per question as a server-side safety net
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

    // Calculate total score
    let score    = 0;
    let maxScore = 0;
    for (const q of questions) {
      const fb = feedback[q.id];
      if (fb) {
        score    += fb.score;
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
