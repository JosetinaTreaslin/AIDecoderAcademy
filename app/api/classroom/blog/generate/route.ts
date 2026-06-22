/**
 * POST /api/classroom/blog/generate
 *
 * Two-step pipeline (mirrors the Google Opal architecture):
 *
 *   Step 1 — Generate Comic Script (GPT gpt-4o-mini, JSON mode)
 *     Validates the topic against the chapter, then writes a full panel-by-panel
 *     comic script with scene descriptions, dialogue, and visual cues.
 *     Also outputs a locked character roster (name + detailed appearance) used
 *     to enforce visual consistency across all generated images.
 *
 *   Step 2 — Generate Comic Panels (fal.ai fal-flux2pro, parallel)
 *     Each panel's image prompt = Opal-style visual style spec
 *                                 + character roster (consistency anchor)
 *                                 + panel's sceneDescription + visualNotes
 *     Dialogue is intentionally excluded from image prompts to prevent the model
 *     rendering text/letters in the illustration.
 *
 * Body:    { topic, chapterTitle, subject?, gradeLevel? }
 * Returns: { valid: false; reason: string }
 *       OR { valid: true; topic; title; panels: BlogPanel[]; keyTakeaways: string[] }
 */

import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import { createAdminClient } from "@/lib/supabase";

export const runtime     = "nodejs";
export const maxDuration = 180;

const openrouter = new OpenAI({
  apiKey:  process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
});

interface RawCharacter {
  name:       string;
  appearance: string;  // locked description reused in every image prompt
}

interface RawPanel {
  panelNumber:      number;
  sceneDescription: string;
  characters?:      string;
  dialogue?:        string;
  visualNotes?:     string;
}

export interface BlogPanel {
  panelNumber:      number;
  sceneDescription: string;
  characters?:      string;
  dialogue?:        string;
  visualNotes?:     string;
  imageUrl?:        string;
}

// Builds the image prompt for a single panel.
// Mirrors Opal's approach: full script context + character roster + per-panel scene.
// Passing the full story context (all panel summaries) gives the model the narrative
// thread, producing images that feel part of a cohesive sequence.
function buildPanelImagePrompt(
  characterBlock: string,
  storyContext: string,
  sceneDescription: string,
  visualNotes?: string,
): string {
  return (
    // — Visual style spec —
    "Educational comic book panel illustration. " +
    "Art style: clean, vibrant, and engaging comic book illustration style suitable for educational materials. " +
    "Lines are clear, characters are friendly and approachable. " +
    "Color palette: bright and appealing, enhancing the learning experience. " +
    "Tone: educational, curious, and encouraging. " +
    "Absolutely no text, words, letters, numbers, signs, speech bubbles, or captions anywhere in the image. " +
    "Single panel only — do not combine into a grid or collage. " +

    // — Character consistency anchor —
    (characterBlock ? "Characters — maintain identical appearance throughout: " + characterBlock + ". " : "") +

    // — Full story context (Opal pattern: every image call sees the whole script) —
    (storyContext ? "Story context for visual coherence: " + storyContext + " " : "") +

    // — This panel's scene —
    "This panel: " + sceneDescription +
    (visualNotes ? ". " + visualNotes : "")
  );
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { topic, chapterTitle, subject, gradeLevel = "CBSE Class 10" } =
      await req.json() as { topic: string; chapterTitle: string; subject?: string; gradeLevel?: string };

    if (!topic?.trim())        return new Response("topic required",        { status: 400 });
    if (!chapterTitle?.trim()) return new Response("chapterTitle required", { status: 400 });

    // ── Step 1: Generate Comic Script (Gemini 2.5 Flash) ────────────────────
    // System prompt follows the Opal "Generate Comic Script" objective verbatim,
    // then adds the JSON contract and structural spec below it.
    const systemInstruction =
      // — Opal objective (verbatim) —
      "Objective: Create a detailed, educational comic strip script for a specific grade level. " +
      "The script must explain the study topic through a sequence of panels containing visual descriptions, dialogue, and visual cues.\n\n" +

      "Output Format: A panel-by-panel breakdown. Each panel must specify the scene description, characters involved, spoken text, and any technical visual instructions. " +
      "Ensure the complexity of the language and concepts matches the specified grade level.\n\n" +

      // — JSON contract —
      "Respond only with a single valid JSON object. " +
      "You will receive a CHAPTER and a TOPIC typed by the student. " +
      "First decide if the TOPIC is part of, or closely related to, the CHAPTER. " +
      'If NOT related, return: { "valid": false, "reason": "<one friendly sentence suggesting a relevant topic>" }. ' +

      'If related, return: { "valid": true, "topic": "<clean topic name>", ' +
      '"title": "<engaging 5-8 word comic title>", "characters": [...], "panels": [...], "keyTakeaways": [...] }. ' +

      // — Character roster spec (key to cross-panel consistency) —
      '"characters": array of all recurring characters in the story. ' +
      'Each entry: { "name": string, "appearance": string }. ' +
      'appearance must be a highly specific, locked physical description used to keep the character identical across every panel — ' +
      'include hair colour and style, skin tone, clothing (colours, style), accessories, build, and any distinctive features. ' +
      // "Example: 'Maya: teenage girl, olive skin, long black hair in a high ponytail, bright curious brown eyes, red zip-up hoodie, yellow backpack'. " +

      // — Panel spec —
      `The script is for ${gradeLevel} students (${subject ?? "Science"}). ` +
      "Use between 4 and 10 panels — scale to topic complexity. " +
      // "Simple concepts: 4-5 panels. Multi-step or complex topics: 6-10 panels. " +
      "The story must feel complete with no unfinished threads. " +
      // "Structure: (1) engaging hook, (2-N) core concepts explained through action and dialogue, (final) memorable takeaway. " +
      'Each panel object: { "panelNumber": number, "sceneDescription": string, "characters": string, "dialogue": string, "visualNotes": string }. ' +
      "sceneDescription: 2-3 vivid sentences — character actions, expressions, props, environment. " +
      "characters: comma-separated names of characters present in this panel. " +
      "dialogue: speech-bubble style" +
      "visualNotes: one sentence on camera angle, lighting, or mood (e.g. 'Close-up on the mirror; warm golden glow traces the reflected beam'). " +

      // — Key takeaways —
      '"keyTakeaways": array of exactly 4-5 concise plain-text bullet points summarising the key educational concepts taught. ' +
      "Make the story immersive, age-appropriate, scientifically accurate, and genuinely educational.";

    const userMessage =
      `Study Topic: ${topic}\n` +
      `Grade Level: ${gradeLevel}\n` +
      `Chapter context: "${chapterTitle}"${subject ? ` | Subject: ${subject}` : ""}`;

    const geminiResponse = await openrouter.chat.completions.create({
      model:           "google/gemini-3.5-flash",
      temperature:     0.7,
      max_tokens:      6000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user",   content: userMessage },
      ],
    });

    const raw = geminiResponse.choices[0]?.message?.content ?? "{}";
    let parsed: {
      valid?:        boolean;
      reason?:       string;
      topic?:        string;
      title?:        string;
      characters?:   RawCharacter[];
      panels?:       RawPanel[];
      keyTakeaways?: string[];
    } = {};
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("[blog/generate] JSON parse error", e);
      return new Response("Failed to generate blog script", { status: 500 });
    }

    if (parsed.valid === false) {
      return Response.json({
        valid:  false,
        reason: parsed.reason ?? "That topic doesn't seem to be part of this chapter — try a topic covered in this chapter.",
      });
    }

    let panels = Array.isArray(parsed.panels) ? parsed.panels : [];
    panels = panels.filter(p => p?.sceneDescription).slice(0, 10);
    if (panels.length === 0) return new Response("Failed to generate blog panels", { status: 500 });

    const keyTakeaways = Array.isArray(parsed.keyTakeaways)
      ? parsed.keyTakeaways.filter((t): t is string => typeof t === "string").slice(0, 5)
      : [];

    // Build the character consistency block injected into every image prompt.
    // This is the key cross-panel anchor — same description in every call keeps
    // the model rendering the same character appearance throughout the sequence.
    const characterBlock = Array.isArray(parsed.characters)
      ? parsed.characters
          .filter(c => c?.name && c?.appearance)
          .map(c => `${c.name}: ${c.appearance}`)
          .join(". ")
      : "";

    // ── Step 2: Generate Comic Panels (images) ───────────────────────────────
    // Build a compact story context string from all panels — passed into every
    // image call so the model sees the full narrative (Opal pattern).
    const storyContext = panels
      .map(p => `Panel ${p.panelNumber ?? "?"}: ${p.sceneDescription}`)
      .join(" | ");

    fal.config({ credentials: process.env.FAL_KEY });
    const supabase = createAdminClient();

    const withImages: BlogPanel[] = await Promise.all(
      panels.map(async (panel, i) => {
        const base: BlogPanel = {
          panelNumber:      panel.panelNumber ?? i + 1,
          sceneDescription: panel.sceneDescription,
          characters:       panel.characters,
          dialogue:         panel.dialogue,
          visualNotes:      panel.visualNotes,
        };
        try {
          const imagePrompt = buildPanelImagePrompt(
            characterBlock,
            storyContext,
            panel.sceneDescription,
            panel.visualNotes,
          );

          const result = await fal.subscribe("fal-ai/flux-pro/v1.1", {
            input: { prompt: imagePrompt, image_size: "landscape_16_9", output_format: "png" },
          }) as { data?: { images?: { url: string }[] } };
          const imageUrl = result.data?.images?.[0]?.url;
          if (!imageUrl) return base;
          const imgResp = await fetch(imageUrl);
          if (!imgResp.ok) return base;
          const buffer  = Buffer.from(await imgResp.arrayBuffer());
          const filename = `images/${userId}/blog-${Date.now()}-panel${i + 1}.png`;

          const { error: uploadErr } = await supabase.storage
            .from("creations-media")
            .upload(filename, buffer, { contentType: "image/png", upsert: false });

          if (uploadErr) {
            console.error("[blog/generate] upload error", uploadErr.message);
            return base;
          }
          const { data } = supabase.storage.from("creations-media").getPublicUrl(filename);
          return { ...base, imageUrl: data.publicUrl };
        } catch (e) {
          console.error("[blog/generate] image gen failed for panel", i + 1, e);
          return base;
        }
      })
    );

    return Response.json({
      valid:        true,
      topic:        parsed.topic?.trim() || topic,
      title:        parsed.title?.trim() || topic,
      panels:       withImages,
      keyTakeaways,
    });
  } catch (err) {
    console.error("[blog/generate]", err);
    return new Response("Internal error", { status: 500 });
  }
}
