/**
 * annotateNotesSheet.ts
 *
 * Teacher-style annotation for classwork notes:
 *   - Red underline under spelling mistakes
 *   - Red circle/ellipse around wrong formulas or conceptual errors
 *   - Red V-tick in the left margin next to correct sections
 *
 * Uses Claude Sonnet 4.6 (via OpenRouter) to locate where each issue's text
 * appears on the page, then sharp + SVG to draw the annotations.
 */

import sharp  from "sharp";
import OpenAI from "openai";
import { createAdminClient } from "./supabase";
import type { CorrectionIssue } from "@/types";

const openai = new OpenAI({
  apiKey:  process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://ai-decoder-academy.vercel.app",
    "X-Title":      "AI Decoder Academy",
  },
});

const MODEL = "anthropic/claude-sonnet-4-6";
const RED   = "#cc0000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LocatedIssue {
  id:          number;
  found:       boolean;
  line_num:    number;   // which text line from top (1-indexed)
  total_lines: number;   // total text lines visible on this page
  x_pct:       number;   // horizontal centre of fragment (0=left, 100=right)
  w_pct:       number;   // width of fragment as % of page width
}

interface LocationResponse {
  issues:          LocatedIssue[];
  tick_line:       number;   // line number for the single tick mark (0 = no tick)
  total_lines:     number;   // total lines on page (used to compute tick y)
}

// ── Robust JSON extractor ────────────────────────────────────────────────────
function extractJson(raw: string): LocationResponse | null {
  const attempts = [
    raw.trim(),
    raw.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim(),
    (() => { const s = raw.indexOf("{"), e = raw.lastIndexOf("}"); return s !== -1 && e > s ? raw.slice(s, e + 1) : ""; })(),
  ];
  for (const attempt of attempts) {
    if (!attempt) continue;
    try { return JSON.parse(attempt); } catch {}
  }
  return null;
}

// Convert line number to y_pct
function lineToY(lineNum: number, totalLines: number): number {
  if (totalLines <= 0) return 50;
  return Math.round(((lineNum - 0.5) / totalLines) * 100);
}

// ── Step 1: Ask Claude to locate issues by understanding, not text-matching ───
async function locateIssuesOnPage(
  b64:    string,
  mime:   string,
  issues: Array<{ id: number; type: string; student_wrote: string; description: string }>,
): Promise<LocationResponse> {
  const issuesList = issues.map(i =>
    `  Issue ${i.id}: LOCATE THIS LINE — "${i.description}"\n             Then underline just this fragment within that line: "${i.student_wrote}"`
  ).join("\n\n");

  try {
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a JSON-only responder. Output a single valid JSON object starting with '{' and ending with '}'. No reasoning, no explanation, no markdown.",
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mime};base64,${b64}`, detail: "high" } },
            {
              type: "text",
              text: `You are annotating a handwritten notes page. Count every text line from top to bottom (total_lines).

Each issue below tells you:
- The WRONG FRAGMENT the student wrote (student_wrote)
- The DESCRIPTION that explains which equation or context it is in — use this to find the RIGHT LINE

${issuesList}

CRITICAL RULES:
1. Use the DESCRIPTION to identify which specific line/equation contains the error.
   The description will mention the equation (e.g. "equation a", "2Mg + O → 2MgO") — find THAT line.
2. DO NOT annotate a fragment just because the same characters appear elsewhere on the page.
   For example: if looking for "O" in "equation a (2Mg + O → 2MgO)", do NOT mark "O" in "O₂" of another correct equation.
3. The wrong fragment appears SPECIFICALLY in the equation or context described — locate ONLY that occurrence.
4. Set found=false if the described equation is not visible on this page.

For each issue return:
- line_num: line number (1=top) of the SPECIFIC line described — not just any line with that character
- total_lines: total text lines on this page
- found: true only if the described equation/context is on this page
- x_pct: horizontal centre of JUST THE WRONG FRAGMENT within that line (0=left, 100=right)
- w_pct: width of the fragment as % of page width

For tick_line: pick ONE line that is entirely correct (no errors). Avoid lines with any identified error.
Use tick_line=0 if no clearly correct line exists.

Output JSON only:
{"issues":[{"id":0,"found":true,"line_num":14,"total_lines":28,"x_pct":42,"w_pct":6},{"id":1,"found":false,"line_num":0,"total_lines":28,"x_pct":0,"w_pct":0}],"tick_line":8,"total_lines":28}`,
            },
          ],
        },
      ],
      max_tokens:  800,
      temperature: 0,
    });

    const raw = res.choices[0]?.message?.content ?? "";
    console.log("[annotateNotes] raw locate response:", raw.slice(0, 400));

    const parsed = extractJson(raw);
    if (!parsed) {
      console.warn("[annotateNotes] JSON parse failed, raw:", raw.slice(0, 300));
      return { issues: [], tick_line: 0, total_lines: 1 };
    }
    console.log("[annotateNotes] parsed location:", JSON.stringify(parsed));
    return parsed;
  } catch (e: any) {
    console.error("[annotateNotes] locate API error:", e.message);
    return { issues: [], tick_line: 0, total_lines: 1 };
  }
}

// ── Step 2: Build SVG overlay ────────────────────────────────────────────────
function buildSvgOverlay(
  width:       number,
  height:      number,
  located:     LocatedIssue[],
  issueTypes:  Record<number, string>,
  tickLine:    number,
  totalLines:  number,
): string {
  const elements: string[] = [];
  // Estimate line height from total lines (with top/bottom padding)
  const lineHeight = height / Math.max(totalLines, 1);

  for (const loc of located) {
    if (!loc.found || loc.line_num <= 0) continue;

    // y is computed from line number — much more reliable than raw %
    const cy  = lineToY(loc.line_num, loc.total_lines || totalLines) / 100 * height;
    const cx  = (loc.x_pct / 100) * width;
    const hw  = (loc.w_pct / 200) * width;       // half-width of fragment
    const hh  = Math.min(lineHeight * 0.4, 18);  // half line height, capped

    const x1  = cx - hw;
    const x2  = cx + hw;
    const y1u = cy + hh + 4;   // just below the text baseline

    const type = issueTypes[loc.id] ?? "conceptual_error";

    // Single underline for spelling, double underline for formula/conceptual errors
    elements.push(`
      <line x1="${x1}" y1="${y1u}" x2="${x2}" y2="${y1u}"
        stroke="${RED}" stroke-width="5" stroke-linecap="round"/>`);

    if (type !== "spelling") {
      elements.push(`
        <line x1="${x1}" y1="${y1u + 8}" x2="${x2}" y2="${y1u + 8}"
          stroke="${RED}" stroke-width="4" stroke-linecap="round"/>`);
    }
  }

  // Single left-margin V-tick for one correct section
  if (tickLine > 0 && totalLines > 0) {
    const y    = lineToY(tickLine, totalLines) / 100 * height;
    const tx0  = Math.round(width * 0.03);
    const tx1  = Math.round(width * 0.08);
    const tx2  = Math.round(width * 0.14);
    elements.push(`
      <polyline
        points="${tx0},${y - 14} ${tx1},${y + 18} ${tx2},${y - 26}"
        stroke="${RED}" stroke-width="7" fill="none"
        stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${elements.join("\n")}
</svg>`;
}

// ── Main export ──────────────────────────────────────────────────────────────
export async function annotateNotesSheets(
  imageUrls: string[],
  issues:    CorrectionIssue[],
  profileId: string,
): Promise<string[]> {
  const supabase = createAdminClient();

  // Only annotate issues that have student_wrote text (skip missing_content)
  const annotatableIssues = issues
    .map((iss, i) => ({
      id:            i,
      type:          iss.type,
      student_wrote: iss.student_wrote,
      description:   iss.description,
    }))
    .filter((iss): iss is { id: number; type: string; student_wrote: string; description: string } =>
      !!iss.student_wrote
    );

  // id → type map for SVG drawing
  const issueTypes: Record<number, string> = {};
  for (const iss of annotatableIssues) issueTypes[iss.id] = iss.type;

  const annotatedUrls: string[] = [];

  for (let pageIdx = 0; pageIdx < imageUrls.length; pageIdx++) {
    const url = imageUrls[pageIdx]!;
    console.log(`[annotateNotes] page ${pageIdx + 1}/${imageUrls.length}`);

    try {
      // Fetch image
      const imgRes    = await fetch(url);
      if (!imgRes.ok) throw new Error(`Fetch failed (${imgRes.status})`);
      const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
      const mime      = imgRes.headers.get("content-type") ?? "image/jpeg";
      const b64       = imgBuffer.toString("base64");

      // Dimensions
      const meta   = await sharp(imgBuffer).metadata();
      const width  = meta.width  ?? 1080;
      const height = meta.height ?? 1440;

      // Skip location call if no annotatable issues
      if (annotatableIssues.length === 0) {
        annotatedUrls.push(url);
        continue;
      }

      // Ask Claude to locate issues + good sections on this page
      const location = await locateIssuesOnPage(b64, mime, annotatableIssues);
      console.log(`[annotateNotes] page ${pageIdx + 1} located:`, JSON.stringify(location));

      const totalLines = location.total_lines ?? 1;
      const hasAnnotations =
        location.issues.some(l => l.found && l.line_num > 0) ||
        (location.tick_line ?? 0) > 0;

      if (!hasAnnotations) {
        console.log(`[annotateNotes] page ${pageIdx + 1}: nothing to annotate — using original`);
        annotatedUrls.push(url);
        continue;
      }

      // Build and composite SVG
      const svg = buildSvgOverlay(
        width, height,
        location.issues,
        issueTypes,
        location.tick_line ?? 0,
        totalLines,
      );

      const annotatedBuffer = await sharp(imgBuffer)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .jpeg({ quality: 93 })
        .toBuffer();

      // Upload
      const path = `answer-sheets/${profileId}/notes-annotated-p${pageIdx}-${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("creations-media")
        .upload(path, annotatedBuffer, { contentType: "image/jpeg", upsert: true });

      if (uploadErr) {
        console.error(`[annotateNotes] upload error:`, uploadErr.message);
        annotatedUrls.push(url);
        continue;
      }

      const { data: pub } = supabase.storage.from("creations-media").getPublicUrl(path);
      annotatedUrls.push(pub.publicUrl);

    } catch (err: any) {
      console.error(`[annotateNotes] page ${pageIdx + 1} error:`, err.message);
      annotatedUrls.push(url);
    }
  }

  return annotatedUrls;
}
