/**
 * POST /api/classroom/infographic/generate
 *
 * Validates a student-typed topic against the chapter, then generates a
 * premium claymation-style educational infographic via OpenRouter →
 * openai/gpt-image-2 (portrait 1024×1792, b64_json response).
 *
 * Body:    { topic, chapterTitle, subject?, gradeLevel? }
 * Returns: { valid: false; reason: string }
 *       OR { valid: true; topic: string; imageUrl: string }
 */

import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 120;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const INFOGRAPHIC_PROMPT_TEMPLATE = `Create a premium educational infographic with a fixed 6-section vertical layout. Render every element in a 3D claymation style — handcrafted polymer clay textures, Pixar-quality lighting, soft studio shadows on all clay objects, rounded edges on everything. The background is warm beige (#F5F0E8). Typography is large, bold, sans-serif and must be highly legible. Overall aesthetic: premium Canva-style educational poster, print-ready.

The infographic has exactly these 6 sections from top to bottom, in this order:

SECTION 1 — HERO (top 30% of image):
Deep-colored clay background (navy or forest green). Center: topic title in oversized 3D clay block letters with drop shadow. Below the title: 2-3 line plain-language summary of the single most important concept or formula. Small 3D clay icons related to the subject fill the corners (beakers, rulers, planets, etc).

SECTION 2 — KEY CONCEPTS (row of 4 equal rounded clay cards, white background):
Each card has: colored clay top stripe, bold concept name, a small 3D clay illustration of that concept in the middle, and 2-3 lines of plain-text explanation at the bottom. No jargon.

SECTION 3 — WORKED EXAMPLES (2 equal clay cards side by side, cream background):
Left card: "Example 1" — step-by-step clay illustration showing a full worked solution. Right card: "Example 2" — a different scenario, same format. Each card has a yellow highlight box at the bottom showing the final answer in bold.

SECTION 4 — REAL-LIFE APPLICATIONS (row of 3 cards):
Each card: colorful clay icon of a real-world object, 1-line caption showing how the concept appears in everyday life or nature.

SECTION 5 — QUICK RECAP (row of 4 compact clay cards):
Each card: simple clay icon plus 1 bold takeaway sentence (8 words max). Acts as a memory cheat-sheet.

SECTION 6 — FOOTER:
Thin decorative clay border. Small label: "Quick Study Guide — {TOPIC}".

Strictly follow this layout for topic: {TOPIC}`;

function buildPrompt(topic: string): string {
  return INFOGRAPHIC_PROMPT_TEMPLATE.replace(/{TOPIC}/g, topic);
}

async function downloadBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Download failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { topic, chapterTitle, subject, gradeLevel = "CBSE Class 10" } =
      await req.json() as { topic: string; chapterTitle: string; subject?: string; gradeLevel?: string };

    if (!topic?.trim())        return new Response("topic required",        { status: 400 });
    if (!chapterTitle?.trim()) return new Response("chapterTitle required", { status: 400 });

    // ── Step 1: validate topic against chapter ────────────────────────────────
    const validation = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      temperature:     0.3,
      response_format: { type: "json_object" },
      max_tokens:      200,
      messages: [
        {
          role:    "system",
          content:
            "You are a curriculum validator. Decide whether a student's topic is part of or closely related to a given chapter. " +
            'If NOT related, return: { "valid": false, "reason": "<one friendly sentence suggesting a relevant topic>" }. ' +
            'If related, return: { "valid": true, "topic": "<clean topic name>" }. Respond only with JSON.',
        },
        {
          role:    "user",
          content:
            `Chapter: "${chapterTitle}"${subject ? ` | Subject: ${subject}` : ""}\n` +
            `Grade: ${gradeLevel}\n` +
            `Student topic: "${topic}"`,
        },
      ],
    });

    let parsed: { valid?: boolean; reason?: string; topic?: string } = {};
    try {
      parsed = JSON.parse(validation.choices[0]?.message?.content ?? "{}");
    } catch {
      return new Response("Validation failed", { status: 500 });
    }

    if (parsed.valid === false) {
      return Response.json({ valid: false, reason: parsed.reason ?? "That topic doesn't seem to be part of this chapter — try a topic from this chapter." });
    }

    const resolvedTopic = parsed.topic?.trim() || topic.trim();

    // ── Step 2: generate infographic via OpenRouter → gpt-image-2 ────────────
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey) throw new Error("OPENROUTER_API_KEY not set");

    const imagePrompt = buildPrompt(resolvedTopic);

    const imageResp = await fetch("https://openrouter.ai/api/v1/images", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type":  "application/json",
        "HTTP-Referer":  "https://ai-decoder-academy.vercel.app",
        "X-Title":       "AI Decoder Academy",
      },
      body: JSON.stringify({
        model:   "openai/gpt-image-2",
        prompt:  imagePrompt,
        size:    "1024x1792",
        quality: "medium",
        n:       1,
      }),
    });

    const imageData = await imageResp.json() as { data?: { b64_json?: string; url?: string }[]; error?: { message: string } };
    if (!imageResp.ok) {
      throw new Error(imageData.error?.message ?? `OpenRouter image failed: ${imageResp.status}`);
    }

    const img = imageData.data?.[0];
    if (!img?.b64_json) throw new Error("No b64_json in OpenRouter response");
    const buffer = Buffer.from(img.b64_json, "base64");

    // ── Step 3: upload to Supabase Storage ───────────────────────────────────
    const supabase  = createAdminClient();
    const filename  = `images/${userId}/infographic-${Date.now()}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("creations-media")
      .upload(filename, buffer, { contentType: "image/png", upsert: false });

    if (uploadErr) {
      console.error("[infographic/generate] upload error:", uploadErr.message);
      throw new Error("Upload failed");
    }

    const { data } = supabase.storage.from("creations-media").getPublicUrl(filename);

    return Response.json({ valid: true, topic: resolvedTopic, imageUrl: data.publicUrl });
  } catch (err) {
    console.error("[infographic/generate]", err);
    return new Response("Internal error", { status: 500 });
  }
}
