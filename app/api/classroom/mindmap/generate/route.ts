/**
 * POST /api/classroom/mindmap/generate
 *
 * Generates a hierarchical mindmap tree for a given topic using gpt-4o-mini.
 * Returns a 3-level tree: branches → topics → leaf concepts.
 *
 * Body:    { topic, chapterTitle, subject?, gradeLevel? }
 * Returns: { valid: false; reason: string }
 *       OR { valid: true; topic; root: MindMapNode }
 */

import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { generateImage } from "@/lib/imageGenerator";
import { createAdminClient } from "@/lib/supabase";

export const runtime     = "nodejs";
export const maxDuration = 180;

// Same cartoon style used by flashcards — keeps visual language consistent.
const CARTOON_STYLE_PREFIX =
  "Fun and vibrant educational cartoon illustration, clean bold outlines, " +
  "bright cheerful color palette, expressive friendly characters, modern cartoon aesthetic, " +
  "simple thematic background, no text or labels, high quality: ";

interface RawNode {
  id:            string;
  label:         string;
  explanation?:  string;
  imageConcept?: string;
  imageUrl?:     string;
  children?:     RawNode[];
}

function collectLeaves(node: RawNode, depth = 0): RawNode[] {
  if (depth === 3) return [node];
  return (node.children ?? []).flatMap(c => collectLeaves(c, depth + 1));
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const { topic, chapterTitle, subject, gradeLevel = "CBSE Class 10" } =
      await req.json() as { topic: string; chapterTitle: string; subject?: string; gradeLevel?: string };

    if (!topic?.trim())        return new Response("topic required",        { status: 400 });
    if (!chapterTitle?.trim()) return new Response("chapterTitle required", { status: 400 });

    const systemPrompt =
      "You are an expert educational content designer. Generate a structured mind map for a student's study topic.\n\n" +

      "You will receive a CHAPTER and a TOPIC. " +
      "First decide if the TOPIC is part of, or closely related to, the CHAPTER. " +
      'If NOT related, return: { "valid": false, "reason": "<one friendly sentence suggesting a relevant topic>" }\n\n' +

      "If related, return JSON with this EXACT structure:\n" +
      '{ "valid": true, "topic": "<clean topic name>", "root": <MindMapNode> }\n\n' +

      "MindMapNode: { \"id\": string, \"label\": string, \"children\"?: MindMapNode[], \"explanation\"?: string }\n\n" +

      "Tree rules:\n" +
      "- Root (depth 0): topic itself. id='root'. No explanation.\n" +
      "- Depth 1 (branches): 4-5 major themes. Short labels 2-4 words. id='b0','b1',… No explanation.\n" +
      "- Depth 2 (topics): 2-3 sub-topics per branch. id='b0-0','b0-1',… No explanation.\n" +
      "- Depth 3 (leaves): 1-2 specific concepts per topic. id='b0-0-0',… MUST include both:\n" +
      "  'explanation': 2-3 sentences written IN THE CONTEXT of the full ancestor path " +
      "(chapter → branch → sub-topic → this concept). " +
      "NEVER write a standalone dictionary definition. " +
      "Explain how the concept applies specifically within this context, " +
      "and include at least one concrete example with real numbers, a formula, or a worked scenario. " +
      "For example — leaf 'sin 30°' under chapter 'Trigonometry', branch 'Trigonometric Ratios', topic 'Standard Angles': " +
      "'In a right triangle, sin 30° = 0.5, meaning the side opposite the 30° angle is exactly half the hypotenuse. " +
      "This is one of the most tested values in CBSE exams — pair it with cos 30° = √3/2 and tan 30° = 1/√3 to ace standard angle questions.'\n" +
      "  'imageConcept': 1-2 sentences describing a vivid, concrete scene a cartoon illustrator can draw " +
      "to represent this concept in context — use relatable characters, objects, or real-world situations. No text or labels.\n" +
      "  No 'children' field on leaves.\n\n" +

      "Labels: concise. Explanations: contextual and specific, never generic. " +
      "Respond ONLY with valid JSON — no markdown, no code fences.";

    const userMessage =
      `Topic: ${topic}\n` +
      `Chapter: "${chapterTitle}"${subject ? ` | Subject: ${subject}` : ""}\n` +
      `Grade Level: ${gradeLevel}`;

    const response = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      temperature:     0.6,
      max_tokens:      4000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    let parsed: { valid?: boolean; reason?: string; topic?: string; root?: object } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[mindmap/generate] JSON parse error, raw:", raw.slice(0, 200));
      return new Response("Failed to parse mindmap", { status: 500 });
    }

    if (parsed.valid === false) {
      return Response.json({ valid: false, reason: parsed.reason ?? "Topic not related to this chapter." });
    }

    if (!parsed.root) {
      return new Response("No mindmap data returned", { status: 500 });
    }

    // Generate cartoon illustrations for every leaf node.
    // Process in batches of 6 to avoid fal.ai rate limits —
    // each batch runs in parallel, batches run sequentially.
    const rootNode  = parsed.root as RawNode;
    const leaves    = collectLeaves(rootNode);
    const BATCH     = 6;

    if (leaves.length > 0) {
      const supabase = createAdminClient();

      for (let b = 0; b < leaves.length; b += BATCH) {
        const batch = leaves.slice(b, b + BATCH);
        await Promise.all(batch.map(async (leaf, i) => {
          const concept = leaf.imageConcept ?? leaf.label;
          try {
            const imagePrompt = CARTOON_STYLE_PREFIX + concept;
            const buffer      = await generateImage(imagePrompt, "fal-flux2pro", false);
            const filename    = `images/${userId}/mindmap-${Date.now()}-${b + i}-${leaf.id}.png`;

            const { error: uploadErr } = await supabase.storage
              .from("creations-media")
              .upload(filename, buffer, { contentType: "image/png", upsert: false });

            if (!uploadErr) {
              const { data } = supabase.storage.from("creations-media").getPublicUrl(filename);
              leaf.imageUrl = data.publicUrl;
            }
          } catch (e) {
            console.error("[mindmap/generate] image gen failed for leaf", leaf.id, e);
          }
        }));
      }
    }

    return Response.json({
      valid: true,
      topic: parsed.topic?.toString().trim() || topic,
      root:  rootNode,
    });
  } catch (err) {
    console.error("[mindmap/generate]", err);
    return new Response("Internal error", { status: 500 });
  }
}
