/**
 * POST /api/classroom/flashcards/generate
 *
 * Validates the student-typed topic against the chapter, then generates 6
 * flashcards — each with a Q/A pair and a cartoon illustration.
 *
 * Body:    { topic: string; chapterTitle: string; subject?: string; gradeLevel?: string }
 * Returns: { valid: false; reason: string }
 *       OR { valid: true; topic: string; cards: { question; answer; imageUrl? }[] }
 */

import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase";
import { generateImage } from "@/lib/imageGenerator";

export const runtime     = "nodejs";
export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Fixed cartoon-style prefix prepended to every image prompt in code.
// GPT only supplies the concept; the style is always consistent.
const CARTOON_STYLE_PREFIX =
  "Fun and vibrant educational cartoon illustration, clean bold outlines, " +
  "bright cheerful color palette, expressive friendly characters, modern cartoon aesthetic, " +
  "simple thematic background, no text or labels, high quality: ";

interface RawCard {
  question:      string;
  answer:        string;
  imageConcept:  string;   // what to depict — NOT a full styled prompt
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { topic, chapterTitle, subject, gradeLevel = "CBSE Class 10" } =
      await req.json() as { topic: string; chapterTitle: string; subject?: string; gradeLevel?: string };

    if (!topic?.trim())        return new Response("topic required",        { status: 400 });
    if (!chapterTitle?.trim()) return new Response("chapterTitle required", { status: 400 });

    // ── Step 1: validate topic + generate Q/A pairs ───────────────────────────
    //
    // Prompt design follows the educational illustrator spec:
    //   • Analyse the study material (chapter + topic + subject)
    //   • Tailor language/complexity to the grade level
    //   • Produce engaging, student-friendly Q/A pairs
    //   • Supply a concrete imageConcept per card (GPT describes the scene;
    //     the cartoon style is injected by code, not GPT)
    const completion = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      temperature:     0.65,
      response_format: { type: "json_object" },
      messages: [
        {
          role:    "system",
          content:
            "You are an expert educational content creator and flashcard designer. " +
            "Respond only with a single valid JSON object. " +

            // — Validation gate —
            "You will receive a CHAPTER and a TOPIC typed by the student. " +
            "First decide if the TOPIC is part of, or closely related to, the CHAPTER. " +
            'If NOT related, return: { "valid": false, "reason": "<one friendly sentence telling the student why and suggesting a relevant topic>" }. ' +

            // — Card generation —
            'If related, return: { "valid": true, "topic": "<clean topic name>", "cards": [...] }. ' +

            // — Q/A spec —
            `Analyse the chapter and topic as study material for ${gradeLevel} students (${subject ?? "Science"}). ` +
            "Generate exactly 6 engaging, student-friendly question-and-answer pairs tailored to this grade level. " +
            "Questions should be specific, exam-relevant, and varied (definition, application, comparison, fill-in-the-blank style). " +
            "Answers must be concise, accurate, and written in plain text — no LaTeX, no markdown, no bullet points inside answers. " +

            // — imageConcept spec —
            'Each card object is: { "question": string, "answer": string, "imageConcept": string }. ' +
            "imageConcept is a 1-2 sentence description of a SPECIFIC, concrete scene, character, or real-world situation " +
            "that vividly represents the concept — written so a cartoon illustrator can draw it instantly. " +
            "Think imaginatively: use relatable objects, animals, people, and actions. " +
            "Example — for 'angle of incidence': 'a cartoon ray of sunlight wearing sunglasses bouncing off a shiny mirror at an angle, with a dotted normal line'. " +
            "Example — for 'mitosis': 'a cheerful cartoon cell wearing a party hat splitting into two identical smiling baby cells'. " +
            "No text or labels should appear in the illustrated scene.",
        },
        {
          role:    "user",
          content:
            `Study material — Chapter: "${chapterTitle}"${subject ? ` | Subject: ${subject}` : ""}\n` +
            `Target grade: ${gradeLevel}\n` +
            `Topic requested by student: "${topic}"`,
        },
      ],
      max_tokens: 1200,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    let parsed: { valid?: boolean; reason?: string; topic?: string; cards?: RawCard[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("[flashcards/generate] JSON parse error", e);
      return new Response("Failed to generate flashcards", { status: 500 });
    }

    if (parsed.valid === false) {
      return Response.json({
        valid:  false,
        reason: parsed.reason ?? "That topic doesn't seem to be part of this chapter — try a topic covered in this chapter.",
      });
    }

    let cards = Array.isArray(parsed.cards) ? parsed.cards : [];
    cards = cards.filter(c => c?.question && c?.answer).slice(0, 6);
    if (cards.length === 0) return new Response("Failed to generate flashcards", { status: 500 });

    // ── Step 2: generate one cartoon illustration per card ────────────────────
    //
    // The full image prompt = CARTOON_STYLE_PREFIX + card.imageConcept.
    // Style is fixed in code; GPT only supplied the concept.
    const supabase = createAdminClient();

    const withImages = await Promise.all(
      cards.map(async (card, i) => {
        try {
          const imagePrompt = CARTOON_STYLE_PREFIX + (card.imageConcept || card.question);
          const buffer      = await generateImage(imagePrompt, "fal-flux2pro", false);
          const filename    = `images/${userId}/flashcard-${Date.now()}-${i}.png`;

          const { error: uploadErr } = await supabase.storage
            .from("creations-media")
            .upload(filename, buffer, { contentType: "image/png", upsert: false });

          if (uploadErr) {
            console.error("[flashcards/generate] upload error", uploadErr.message);
            return { question: card.question, answer: card.answer };
          }

          const { data } = supabase.storage.from("creations-media").getPublicUrl(filename);
          return { question: card.question, answer: card.answer, imageUrl: data.publicUrl };
        } catch (e) {
          console.error("[flashcards/generate] image gen failed for card", i, e);
          return { question: card.question, answer: card.answer };
        }
      })
    );

    return Response.json({ valid: true, topic: parsed.topic?.trim() || topic, cards: withImages });
  } catch (err) {
    console.error("[flashcards/generate]", err);
    return new Response("Internal error", { status: 500 });
  }
}
