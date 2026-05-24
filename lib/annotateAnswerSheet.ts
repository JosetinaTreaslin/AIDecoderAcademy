/**
 * annotateAnswerSheet.ts
 *
 * Teacher-style annotation matching CBSE graded answer sheet style:
 *   - Large red V-tick ON the answer (at midpoint, not bottom)
 *   - Score in a red oval on the far-right margin at the same y-level
 *   - Short red italic teacher comment for wrong/partial answers
 *   - Total score in a large circle top-right of the first page only
 *
 * Uses Claude Opus via OpenRouter for best handwriting + layout understanding.
 */

import sharp from "sharp";
import OpenAI from "openai";
import { createAdminClient } from "./supabase";

const openai = new OpenAI({
  apiKey:  process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://ai-decoder-academy.vercel.app",
    "X-Title":      "AI Decoder Academy",
  },
});

const MODEL = "anthropic/claude-sonnet-4-6";

// ── Types ─────────────────────────────────────────────────────────────────────
type AnswerColumn = "left" | "right" | "full";

interface AnswerPosition {
  q:         number;          // question number (1-indexed)
  y_mid_pct: number;          // vertical midpoint of answer block (0–100% from top)
  column:    AnswerColumn;    // which column the answer occupies
}

interface AnnotationData {
  q:         number;
  y_mid_pct: number;
  column:    AnswerColumn;
  score:     number;
  max:       number;
  comment:   string;
}

// ── Robust JSON array extractor ───────────────────────────────────────────────
// Handles: plain JSON, code-fenced JSON, JSON embedded in prose
function extractJsonArray(raw: string): AnswerPosition[] {
  // Try the whole string first
  try { const p = JSON.parse(raw.trim()); if (Array.isArray(p)) return p; } catch {}

  // Strip code fences
  const fenced = raw.replace(/^```(?:json)?\s*/m, "").replace(/```\s*$/m, "").trim();
  try { const p = JSON.parse(fenced); if (Array.isArray(p)) return p; } catch {}

  // Find first [...] block in the string
  const start = raw.indexOf("[");
  const end   = raw.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const p = JSON.parse(raw.slice(start, end + 1));
      if (Array.isArray(p)) return p;
    } catch {}
  }

  return [];
}

// ── Step 1: Ask Claude Opus which questions are on this page and where ────────
async function locateAnswersOnPage(
  b64:  string,
  mime: string,
  questionNumbers: Array<{ number: number; marks: number }>,
): Promise<AnswerPosition[]> {
  const qList = questionNumbers.map(q => `Q${q.number} (${q.marks} marks)`).join(", ");

  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mime};base64,${b64}`, detail: "high" },
          },
          {
            type: "text",
            text: `You are examining a handwritten exam answer sheet image.

Your task: find which of these questions have their answer marker explicitly written on THIS image: ${qList}.

STRICT RULE — only include a question if ALL of these are true:
1. You can physically see the student's handwritten question number marker on this image.
   Valid markers for question N:  N)   N.   QN   Q.N   (N)
2. The marker is a standalone question number — NOT a sub-part label like i., ii., (a), (b).
3. Do NOT include a question just because its answer content appears on this page.
   Content without an explicit marker = continuation from a previous page = do NOT annotate.

For each question whose EXPLICIT MARKER you can see on this image, report:
- q: the question number
- y_mid_pct: vertical midpoint of that answer block as % from TOP of image (0=top, 100=bottom)
- column: "left" (answer in left half ~0-50%), "right" (right half ~50-100%), or "full" (full width)

The answer block starts at the marker and ends just before the next question marker or page edge.
The midpoint is halfway between where the answer starts and where it ends on THIS page only.

KEY DISTINCTION:
• Arabic numerals 1), 2), 3)... = question markers ✓
• Roman numerals i., ii., iii. or letters a., b. = sub-parts within a question, NOT question markers ✗

Examples:
[{ "q": 1, "y_mid_pct": 30, "column": "full" }, { "q": 2, "y_mid_pct": 75, "column": "full" }]

Return ONLY the JSON array — no explanation, no markdown fences. If no question markers are found, return [].`,
          },
        ],
      }],
      max_tokens:  400,
      temperature: 0,
    });

    const raw = res.choices[0]?.message?.content ?? "[]";
    console.log(`[annotate] page locate raw response:`, raw.slice(0, 300));
    return extractJsonArray(raw);
  } catch (e: any) {
    console.error("[annotate] locateAnswers API error:", e.message);
    return [];
  }
}

// ── Step 2: Build SVG overlay ─────────────────────────────────────────────────
function buildSvgOverlay(
  width:       number,
  height:      number,
  annotations: AnnotationData[],
  totalScore:  number,
  totalMax:    number,
  isFirstPage: boolean,
): string {
  const RED      = "#cc0000";
  const elements: string[] = [];

  // Total score circle — top-right of first page only
  if (isFirstPage) {
    const tx          = width - 95;
    const ty          = 85;
    const totalLabel  = `${totalScore}`;
    elements.push(`
      <ellipse cx="${tx}" cy="${ty}" rx="65" ry="52"
        stroke="${RED}" stroke-width="4" fill="none"/>
      <text x="${tx}" y="${ty + 14}"
        font-family="Arial, sans-serif" font-size="38" font-weight="bold"
        fill="${RED}" text-anchor="middle">${totalLabel}</text>`);
  }

  // ── Column geometry ─────────────────────────────────────────────────────────
  // For a two-column page the divider sits at ~50% of width.
  // Tick is drawn near the LEFT edge of the answer's column.
  // Score circle is drawn near the RIGHT edge of the answer's column.
  const colGeometry: Record<AnswerColumn, {
    tickStartPct: number;   // x of first point of V-tick (fraction of width)
    tickMidPct:   number;   // x of V bottom
    tickEndPct:   number;   // x of last point of V-tick
    scorePct:     number;   // x of score circle centre
    commentPct:   number;   // x of comment text start
  }> = {
    left:  { tickStartPct: 0.04, tickMidPct: 0.11, tickEndPct: 0.20, scorePct: 0.47, commentPct: 0.04 },
    right: { tickStartPct: 0.54, tickMidPct: 0.61, tickEndPct: 0.70, scorePct: 0.95, commentPct: 0.54 },
    full:  { tickStartPct: 0.04, tickMidPct: 0.11, tickEndPct: 0.20, scorePct: 0.95, commentPct: 0.04 },
  };

  for (const { y_mid_pct, column, score, max, comment } of annotations) {
    const yMid    = Math.round(Math.min(94, Math.max(6, y_mid_pct)) / 100 * height);
    const correct = score >= max;
    const partial = score > 0 && score < max;
    const geo     = colGeometry[column] ?? colGeometry.full;

    const t0x = Math.round(geo.tickStartPct * width);
    const t1x = Math.round(geo.tickMidPct   * width);
    const t2x = Math.round(geo.tickEndPct   * width);

    // ── Large V-tick or X drawn ON the answer ─────────────────────────────
    if (correct || partial) {
      elements.push(`
        <polyline
          points="${t0x},${yMid - 18} ${t1x},${yMid + 28} ${t2x},${yMid - 52}"
          stroke="${RED}" stroke-width="7.5" fill="none"
          stroke-linecap="round" stroke-linejoin="round"/>`);
    } else {
      const cx = t1x;
      elements.push(`
        <line x1="${cx - 28}" y1="${yMid - 28}" x2="${cx + 28}" y2="${yMid + 28}"
          stroke="${RED}" stroke-width="7.5" stroke-linecap="round"/>
        <line x1="${cx + 28}" y1="${yMid - 28}" x2="${cx - 28}" y2="${yMid + 28}"
          stroke="${RED}" stroke-width="7.5" stroke-linecap="round"/>`);
    }

    // ── Circled score at right edge of the answer's column ────────────────
    const scoreX     = Math.round(geo.scorePct * width) - (column === "right" || column === "full" ? 45 : 0);
    const scoreLabel = `${score}`;
    const rx         = scoreLabel.length > 1 ? 42 : 34;
    elements.push(`
      <ellipse cx="${scoreX}" cy="${yMid}" rx="${rx}" ry="30"
        stroke="${RED}" stroke-width="3.5" fill="none"/>
      <text x="${scoreX}" y="${yMid + 12}"
        font-family="Arial, sans-serif" font-size="32" font-weight="bold"
        fill="${RED}" text-anchor="middle">${scoreLabel}</text>`);

    // ── Short red italic comment for wrong/partial answers ────────────────
    if (comment && !correct) {
      const short  = comment.length > 45 ? comment.slice(0, 42) + "…" : comment;
      const textX  = Math.round(geo.commentPct * width);
      elements.push(`
        <text x="${textX}" y="${yMid + 55}"
          font-family="Arial, sans-serif" font-style="italic" font-size="20"
          fill="${RED}">${short}</text>`);
    }
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${elements.join("\n")}
</svg>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function annotateAnswerSheets(
  imageUrls: string[],
  feedback:  Record<string, { score: number; max: number; feedback: string }>,
  questions: any[],
  profileId: string,
): Promise<string[]> {
  const supabase = createAdminClient();

  // Build question map: number (1-indexed) → details
  const qByNum: Record<number, {
    id: string; marks: number; score: number; max: number; comment: string;
  }> = {};
  questions.forEach((q: any, i: number) => {
    const fb = feedback[q.id];
    qByNum[i + 1] = {
      id:      q.id,
      marks:   q.marks,
      score:   fb?.score    ?? 0,
      max:     fb?.max      ?? q.marks,
      comment: fb?.feedback ?? "",
    };
  });

  const allQNums = Object.entries(qByNum).map(([num, info]) => ({
    number: Number(num),
    marks:  info.marks,
  }));

  const totalScore = Object.values(qByNum).reduce((s, q) => s + q.score, 0);
  const totalMax   = Object.values(qByNum).reduce((s, q) => s + q.max,   0);

  const annotatedUrls: string[] = [];

  for (let pageIdx = 0; pageIdx < imageUrls.length; pageIdx++) {
    const url = imageUrls[pageIdx]!;
    console.log(`[annotate] processing page ${pageIdx + 1}/${imageUrls.length}: ${url.slice(-40)}`);

    try {
      // Fetch image
      const imgRes = await fetch(url);
      if (!imgRes.ok) throw new Error(`Image fetch failed (${imgRes.status}): ${url}`);
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      const mime      = imgRes.headers.get("content-type") ?? "image/jpeg";
      const b64       = imgBuffer.toString("base64");

      // Dimensions
      const meta   = await sharp(imgBuffer).metadata();
      const width  = meta.width  ?? 1240;
      const height = meta.height ?? 1754;
      console.log(`[annotate] page ${pageIdx + 1} dims: ${width}×${height}`);

      // Locate answers via Claude Opus
      const positions = await locateAnswersOnPage(b64, mime, allQNums);
      console.log(`[annotate] page ${pageIdx + 1} positions:`, JSON.stringify(positions));

      if (positions.length === 0) {
        console.warn(`[annotate] page ${pageIdx + 1}: no positions found — using original`);
        annotatedUrls.push(url);
        continue;
      }

      // Build annotation data
      const annotations: AnnotationData[] = positions
        .filter(p => qByNum[p.q] != null)
        .map(p => ({
          q:         p.q,
          y_mid_pct: p.y_mid_pct,
          column:    (["left","right","full"].includes(p.column) ? p.column : "full") as AnswerColumn,
          score:     qByNum[p.q]!.score,
          max:       qByNum[p.q]!.max,
          comment:   qByNum[p.q]!.comment,
        }));

      if (annotations.length === 0) {
        console.warn(`[annotate] page ${pageIdx + 1}: positions found but no matching questions — using original`);
        annotatedUrls.push(url);
        continue;
      }

      console.log(`[annotate] page ${pageIdx + 1}: drawing ${annotations.length} annotations`);

      // Draw SVG + composite
      const svg = buildSvgOverlay(width, height, annotations, totalScore, totalMax, pageIdx === 0);
      const annotatedBuffer = await sharp(imgBuffer)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .jpeg({ quality: 93 })
        .toBuffer();

      // Upload
      const path = `answer-sheets/${profileId}/annotated-p${pageIdx}-${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("creations-media")
        .upload(path, annotatedBuffer, { contentType: "image/jpeg", upsert: true });

      if (uploadErr) {
        console.error(`[annotate] page ${pageIdx + 1} upload error:`, uploadErr.message);
        annotatedUrls.push(url);
        continue;
      }

      const { data: pub } = supabase.storage.from("creations-media").getPublicUrl(path);
      console.log(`[annotate] page ${pageIdx + 1} annotated → ${pub.publicUrl.slice(-40)}`);
      annotatedUrls.push(pub.publicUrl);

    } catch (err: any) {
      console.error(`[annotate] page ${pageIdx + 1} fatal error:`, err.message);
      annotatedUrls.push(url);
    }
  }

  return annotatedUrls;
}
