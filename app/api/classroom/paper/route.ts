/**
 * GET /api/classroom/paper?chapter_id=X&type=mcq
 *
 * Returns a randomly selected subset of questions (no correct_index sent to client).
 * MCQ: picks 7 easy + 5 medium + 3 hard from the cached 40.
 * Generates the 40-question bank on first request if it doesn't exist.
 */

import { auth } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase";
import OpenAI from "openai";

export const runtime = "nodejs";
// Generation can take up to 60s on first load
export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const EASY_COUNT   = 7;
const MEDIUM_COUNT = 5;
const HARD_COUNT   = 3;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

export async function GET(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const chapterId = searchParams.get("chapter_id");
    const type      = searchParams.get("type") ?? "mcq";

    if (!chapterId) return new Response("chapter_id required", { status: 400 });

    const supabase = createAdminClient();

    // Fetch chapter
    const { data: chapter } = await supabase
      .from("chapters")
      .select("id, subject, chapter_number, chapter_title, grade, board, content_text")
      .eq("id", chapterId)
      .single();

    if (!chapter) return new Response("Chapter not found", { status: 404 });

    // Get or generate question paper
    let { data: paper } = await supabase
      .from("question_papers")
      .select("id, questions, total_marks")
      .eq("chapter_id", chapterId)
      .eq("type", type)
      .maybeSingle();

    if (!paper) {
      // Generate 40 MCQs on first request
      paper = await generateAndStorePaper(supabase, chapter);
    }

    const allQuestions: any[] = paper.questions as any[];

    // Randomly pick the subset for this attempt
    const easy   = pickRandom(allQuestions.filter(q => q.difficulty === "easy"),   EASY_COUNT);
    const medium = pickRandom(allQuestions.filter(q => q.difficulty === "medium"), MEDIUM_COUNT);
    const hard   = pickRandom(allQuestions.filter(q => q.difficulty === "hard"),   HARD_COUNT);

    // Shuffle the combined set so difficulty isn't obvious by position
    const selected = shuffle([...easy, ...medium, ...hard]);

    // Strip server-only fields before sending to client
    const clientQuestions = selected.map(({ correct_index: _ci, explanation: _ex, ...q }) => q);

    return Response.json({
      paper_id:       paper.id,
      question_ids:   selected.map(q => q.id),
      questions:      clientQuestions,
      total_marks:    selected.length,
      chapter: {
        id:            chapter.id,
        subject:       chapter.subject,
        chapter_number: chapter.chapter_number,
        chapter_title: chapter.chapter_title,
        grade:         chapter.grade,
        board:         chapter.board,
      },
    });
  } catch (err) {
    console.error("[classroom/paper]", err);
    return new Response("Internal error", { status: 500 });
  }
}

async function generateAndStorePaper(supabase: ReturnType<typeof createAdminClient>, chapter: any) {
  const prompt = buildMCQPrompt(chapter.content_text, chapter.chapter_title);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 8000,
  });

  const raw = completion.choices[0].message.content ?? "";
  const clean = raw.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim();
  const questions = JSON.parse(clean);

  const { data, error } = await supabase
    .from("question_papers")
    .insert({ chapter_id: chapter.id, type: "mcq", questions, total_marks: 40 })
    .select("id, questions, total_marks")
    .single();

  if (error) throw error;
  return data;
}

function buildMCQPrompt(content: string, chapterTitle: string): string {
  return `You are an expert CBSE Class 10 Science question paper setter.

Using the chapter content below, generate exactly 40 MCQ questions for "${chapterTitle}":
- 20 EASY questions (recall, one-concept)
- 10 MEDIUM questions (application, two-step)
- 10 HARD questions (higher-order, equation-balancing, multi-concept)

Return a JSON array with exactly 40 objects, each with this exact schema:
{
  "id": "q1",
  "difficulty": "easy",
  "marks": 1,
  "question": "...",
  "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
  "correct_index": 0,
  "explanation": "One sentence explaining the correct answer."
}

Easy: q1–q20, Medium: q21–q30, Hard: q31–q40.
Cover all topics. Vary which option is correct. Return ONLY the JSON array.

Chapter: ${content.slice(0, 6000)}`;
}
