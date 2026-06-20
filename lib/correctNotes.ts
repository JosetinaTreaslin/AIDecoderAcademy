/**
 * Shared notes-correction pipeline — extracted from
 * app/api/classroom/correct-notes/route.ts so it can be reused by the
 * teacher-assigned classwork flow (app/api/classroom/assignment-submit/route.ts).
 *
 * Kannada subject uses the Sarvam hybrid pipeline:
 *   1. Sarvam Vision (Document Intelligence) — job-based async OCR per page
 *   2. Gemini-3.5-flash text call — error detection on OCR'd text (no images)
 *   3. Gemini vision (getVisionBboxes) — pixel-precise annotation bboxes
 *   Falls back to Gemini vision (with images) if Sarvam OCR fails.
 *
 * Chemistry / Maths use the original OpenRouter Gemini vision path unchanged.
 */

import OpenAI                from "openai";
import AdmZip                from "adm-zip";
import { SarvamAIClient }    from "sarvamai";
import type { CorrectionIssue, CorrectionResult } from "@/types";
import { annotateNotesSheets } from "@/lib/annotateNotesSheet";

// OpenRouter — drop-in OpenAI-compatible client (same as evaluate-written)
const openai = new OpenAI({
  apiKey:  process.env.OPENROUTER_API_KEY!,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": "https://ai-decoder-academy.vercel.app",
    "X-Title":      "AI Decoder Academy",
  },
});

// OpenRouter model (Gemini) — used for bbox detection + Chemistry/Maths correction
const CLAUDE_MODEL = "google/gemini-3.5-flash";

// Sarvam SDK client (OCR only — chat uses the existing OpenRouter client)
const sarvamClient = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY ?? "",
});

// ── Sarvam Vision: OCR one image URL using the official sarvamai JS SDK ──────
// Flow: createJob → uploadFile(Blob) → start → waitUntilComplete
//       → getDownloadLinks → download ZIP → unzip → return markdown text
async function sarvamOCROnePage(imageUrl: string, pageNum: number): Promise<string> {
  // Fetch image bytes
  const imgFetch = await fetch(imageUrl);
  if (!imgFetch.ok) throw new Error(`Image fetch failed (${imgFetch.status}): ${imageUrl}`);
  const imgBuffer = await imgFetch.arrayBuffer();
  const mime      = imgFetch.headers.get("content-type") ?? "image/jpeg";
  const ext       = mime.includes("png") ? "png" : "jpg";

  // Wrap in a File so the SDK uses the correct filename (not "document.pdf")
  const file = new File([imgBuffer], `page${pageNum}.${ext}`, { type: mime });

  // Create job
  const job = await sarvamClient.documentIntelligence.createJob({
    language:     "kn-IN",
    outputFormat: "md",
  });

  // Upload, start, wait
  await job.uploadFile(file);
  await job.start();

  const status = await job.waitUntilComplete();
  if (status.job_state === "Failed") throw new Error(`Sarvam OCR job failed for page ${pageNum}`);

  // Get presigned download URL
  const dlResponse = await job.getDownloadLinks();
  const firstEntry = Object.values(dlResponse.download_urls ?? {})[0] as { file_url: string } | undefined;
  if (!firstEntry?.file_url) throw new Error(`No download URL returned for page ${pageNum}`);

  // Download ZIP and extract the .md entry
  const zipRes    = await fetch(firstEntry.file_url);
  if (!zipRes.ok) throw new Error(`ZIP download failed (${zipRes.status}) for page ${pageNum}`);
  const zipBuffer = Buffer.from(await zipRes.arrayBuffer());

  const zip     = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  const mdEntry = entries.find(e => e.entryName.endsWith(".md"))
               ?? entries.find(e => e.entryName.endsWith(".txt"))
               ?? entries[0];

  if (!mdEntry) throw new Error(`No readable entry in ZIP (entries: ${entries.map(e => e.entryName).join(", ")})`);

  return mdEntry.getData().toString("utf8");
}

// ── Sarvam-105B text prompt for Kannada error detection ───────────────────────
function buildKannadaTextPrompt(
  chapterTitle: string,
  contentText:  string,
  ocrPages:     { pageNum: number; text: string }[],
): string {
  const pagesBlock = ocrPages
    .map(p => `--- Page ${p.pageNum} ---\n${p.text}`)
    .join("\n\n");

  return `You are a strict CBSE Class 10 Kannada language teacher reviewing a student's handwritten classwork notes for the chapter "${chapterTitle}".

The notes were OCR-scanned — there may be minor OCR artefacts. Read charitably and focus on genuine student errors.

Reference material for this chapter:
---
${contentText}
---

Student's OCR-extracted notes (${ocrPages.length} page${ocrPages.length > 1 ? "s" : ""}):
---
${pagesBlock}
---

━━━ YOUR TASK: FIND ALL ERRORS ━━━

Go through the notes WORD BY WORD. For EACH line:

CHECK 1 — SPELLING (most important for Kannada):
Read every Kannada word and check if it is a real, correctly spelled Kannada word.
Flag if:
• The word does not exist in Kannada (garbled / wrong combinant)
• Wrong matra (ಮಾತ್ರೆ) — e.g. wrong vowel mark on a consonant
• Wrong anusvara (ಂ) or visarga (ಃ)
• Wrong letter — e.g. ದ vs ಧ, ಬ vs ಭ, ಗ vs ಘ, ಪ vs ಫ
• Wrong verb ending — e.g. ಸುತ್ತರೆ (wrong) vs ಸುತ್ತದೆ (correct)
• student_wrote: EXACT misspelled word as the student wrote it (single word only)
• correct_version: correct Kannada spelling

CHECK 2 — FACTUAL ACCURACY (compare with reference):
• Wrong poet name (e.g. pen name vs birth name)
• Wrong literary term or definition
• Wrong synonym / antonym pair
• Wrong meaning given for a word

CHECK 3 — GRAMMAR TERMS:
Verify all grammar term names and examples against the reference material.

━━━ DO NOT FLAG ━━━
✗ English words written for meanings (like "proud", "unity")
✗ Handwriting / OCR style differences that don't change meaning
✗ Correct content worded differently

━━━ CRITICAL RULES ━━━
• student_wrote MUST be a SINGLE word — the exact wrong word (not a whole sentence)
• page_number: which page the error appears on (matching the "--- Page N ---" label above)
• approx_line_pct: 0 = top of that page, 100 = bottom (estimate from context/line order)
• approx_x_pct: 0 = left, 100 = right (estimate from line context)
• Flag EVERY error you find — do not skip any

Return ONLY a valid JSON object, no markdown:
{
  "accuracy_score": <integer 0-100, deduct 5-10 per confirmed error>,
  "teacher_summary": "<2-3 sentences in English: mention specific errors and what was done well>",
  "issues": [
    {
      "type": "<spelling | conceptual_error | missing_content>",
      "student_wrote": "<EXACT wrong single word as the student wrote it>",
      "correct_version": "<correct Kannada word>",
      "description": "<one sentence in English explaining the error>",
      "severity": "<high for factual errors, low for spelling>",
      "page_number": <which page — integer matching Page N label>,
      "approx_line_pct": <0-100>,
      "approx_x_pct": <0-100>
    }
  ],
  "positives": [
    "<one specific correct thing the student wrote>"
  ]
}`;
}

// ── Sarvam hybrid: OCR all pages then run Gemini error detection ──────────────
// Returns null if OCR fails (caller should fall back to Gemini vision path).
async function runSarvamHybrid(
  imageUrls:    string[],
  chapterTitle: string,
  contentText:  string,
): Promise<{
  accuracy_score:  number;
  teacher_summary: string;
  issues:          CorrectionIssue[];
  positives:       string[];
} | null> {
  // Step 1 — OCR all pages in parallel
  let ocrPages: { pageNum: number; text: string }[];
  try {
    const results = await Promise.all(
      imageUrls.map((url, i) => sarvamOCROnePage(url, i + 1))
    );
    ocrPages = results.map((text, i) => ({ pageNum: i + 1, text }));
    const totalChars = ocrPages.reduce((s, p) => s + p.text.length, 0);
    if (totalChars < 20) {
      console.warn("[sarvam-hybrid] OCR returned almost no text — falling back to Gemini vision");
      return null;
    }
  } catch (ocrErr: any) {
    console.error("[sarvam-hybrid] OCR failed — falling back to Gemini vision:", ocrErr.message);
    return null;
  }

  // Step 2 — Gemini-3.5-flash text-based error detection on OCR'd text
  const prompt = buildKannadaTextPrompt(chapterTitle, contentText, ocrPages);

  const chat = await openai.chat.completions.create({
    model: CLAUDE_MODEL,   // google/gemini-3.5-flash via OpenRouter
    messages: [
      {
        role:    "system",
        content: "You are a JSON-only API. Your entire response must be a single valid JSON object. Do not write any explanation, prose, or markdown — only the JSON.",
      },
      {
        role:    "user",
        content: prompt,
      },
    ],
    max_tokens:      8192,
    temperature:     0,
    response_format: { type: "json_object" },
  });

  const rawText = chat.choices[0]?.message?.content ?? "";

  // Robust JSON extraction
  let clean = rawText
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
  const jsonStart = clean.indexOf("{");
  const jsonEnd   = clean.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    clean = clean.slice(jsonStart, jsonEnd + 1);
  }

  const parsed = JSON.parse(clean);
  const issues: CorrectionIssue[] = Array.isArray(parsed.issues) ? parsed.issues : [];

  return {
    accuracy_score:  Math.min(100, Math.max(0, parsed.accuracy_score ?? 0)),
    teacher_summary: parsed.teacher_summary ?? "",
    issues,
    positives:       Array.isArray(parsed.positives) ? parsed.positives : [],
  };
}

// ── Convert a Supabase URL to a base64 image part (same as evaluate-written) ──
async function toBase64Part(url: string): Promise<OpenAI.Chat.ChatCompletionContentPart> {
  const res    = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const buffer = await res.arrayBuffer();
  const mime   = res.headers.get("content-type") ?? "image/jpeg";
  const b64    = Buffer.from(buffer).toString("base64");
  return { type: "image_url", image_url: { url: `data:${mime};base64,${b64}`, detail: "high" } };
}

// ── Kannada-specific prompt ───────────────────────────────────────────────────
function buildKannadaSystemPrompt(chapterTitle: string, contentText: string): string {
  return `You are a strict CBSE Class 10 Kannada language teacher carefully reviewing a student's handwritten classwork notes for the chapter "${chapterTitle}".

Your reference material for this chapter:
---
${contentText}
---

The student has written in Kannada script (ಕನ್ನಡ ಲಿಪಿ). Read every word carefully.

━━━ YOUR TASK: READ EVERY WORD AND FLAG ALL ERRORS ━━━

Go through the notes LINE BY LINE. For EACH line:

CHECK 1 — SPELLING (most important):
Read every Kannada word and check if it is a real, correctly spelled Kannada word.
Flag if:
• The word does not exist in Kannada (made-up / garbled word)
• Wrong matra (ಮಾತ್ರೆ) — e.g., ಪ್ರೇದೇಸಿ vs ಪ್ರೇರೇಪಿ
• Wrong anusvara (ಂ) or visarga (ಃ)
• Wrong letter — e.g., ದ vs ಧ, ಬ vs ಭ, ಗ vs ಘ, ಪ vs ಫ
• Wrong verb ending — e.g., ಸುತ್ತರೆ (wrong) vs ಸುತ್ತದೆ (correct), ದ್ದಾರ vs ದ್ದಾರೆ
For student_wrote: write the EXACT misspelled word as the student wrote it.
For correct_version: write the correct Kannada spelling.

CHECK 2 — FACTUAL ACCURACY:
Compare with the reference. Flag if:
• Wrong poet name (e.g., a pen name used as the full birth name — e.g., "ಕುವೆಂಪು ವೆಂಕಟಪ್ಪ" should be "ಕುಪ್ಪಳಿ ವೆಂಕಟಪ್ಪ")
• Wrong literary term or definition
• Wrong synonym (ಸಮಾನಾರ್ಥಕ) or antonym (ವಿರುದ್ಧಾರ್ಥಕ) pair
• Wrong meaning given for a word

CHECK 3 — GRAMMAR TERMS:
If grammar notes are present, verify all grammar term names and examples are correct.

━━━ DO NOT FLAG ━━━
✗ English words written for meanings (like "proud", "unity") — these are correct
✗ Handwriting style differences that don't change the word
✗ Correct content written in a different style

━━━ CRITICAL RULES ━━━
• student_wrote MUST be a SINGLE word — the exact wrong word as written
• Do NOT use the full sentence as student_wrote
• page_number: which image page contains the error (1 = first image, 2 = second image, etc.)
• approx_line_pct: vertical position within that page (0=top, 100=bottom)
• approx_x_pct: horizontal position within that page (0=left, 100=right)
• Flag ALL errors you find — do not skip any

Return ONLY a valid JSON object, no markdown:
{
  "accuracy_score": <integer 0-100, deduct 5-10 per error>,
  "teacher_summary": "<2-3 sentences in English: mention specific errors found and what was done well>",
  "issues": [
    {
      "type": "<spelling | conceptual_error | missing_content>",
      "student_wrote": "<the EXACT wrong single word as written by student>",
      "correct_version": "<the correct Kannada word>",
      "description": "<one sentence in English explaining the error>",
      "severity": "<high for factual errors, low for spelling>",
      "page_number": <1 or 2 or 3 — which image this error is on>,
      "approx_line_pct": <0-100>,
      "approx_x_pct": <0-100>
    }
  ],
  "positives": [
    "<one specific correct thing the student wrote>"
  ]
}`;
}

// ── Build the teacher system prompt ──────────────────────────────────────────
function buildSystemPrompt(subject: string, chapterTitle: string, contentText: string): string {
  return `You are a helpful CBSE Class 10 ${subject} teacher reviewing a student's handwritten classwork notes for the chapter "${chapterTitle}".

Your reference for this chapter:
---
${contentText}
---

YOUR JOB IS TO FLAG ONLY GENUINE ERRORS. Be lenient — these are classwork notes, not an exam.

━━━ STEP 1: CHECK EVERY CHEMICAL EQUATION USING THIS CHECKLIST ━━━

For each equation the student has written, go through ALL four checks:

CHECK 1 — DIATOMIC ELEMENTS (most common mistake):
   These 7 elements MUST have subscript 2 when written as pure elements in equations:
   H₂  N₂  O₂  F₂  Cl₂  Br₂  I₂
   If the student wrote just "O", "Cl", "H", "N", "F", "Br", "I" alone (not inside a compound)
   → it is WRONG. Flag it. Set student_wrote to just that symbol e.g. "O", "Cl".
   ✦ "2Mg + O → 2MgO"     → O should be O₂  → FLAG, student_wrote = "O"
   ✦ "2AgCl → 2Ag + Cl↑"  → Cl should be Cl₂ → FLAG, student_wrote = "Cl"

CHECK 2 — MISSING SUBSCRIPTS IN COMPOUNDS:
   Check every compound for missing subscript numbers.
   ✦ "CuSO"  → should be CuSO₄  → FLAG, student_wrote = "CuSO"
   ✦ "H₂SO"  → should be H₂SO₄  → FLAG, student_wrote = "H₂SO"
   ✦ "H2O2"  → check if subscripts are correct for the context

CHECK 3 — WRONG PRODUCTS:
   Verify the product compounds are chemically correct.
   ✦ Thermal decomposition of Pb(NO₃)₂ → products are PbO + NO₂ + O₂
     If student wrote "2Pb" (pure lead) instead of "2PbO" → FLAG, student_wrote = "2Pb"
   ✦ Do NOT flag products that are correct

CHECK 4 — BALANCING (only obvious imbalances):
   Count atoms on both sides. Flag only if clearly unbalanced.
   Do NOT flag if coefficients are simply omitted in note-taking style.

DEDUPLICATION RULE: If the same equation has multiple issues, report each as a SEPARATE issue.
But do NOT report the same mistake twice. One issue per error, not one per equation.

━━━ STEP 2: CHECK SPELLING ━━━
Flag actual misspellings of subject terms (e.g. "Electrolyisie" → "Electrolysis").
Do NOT flag: shorthand, abbreviations, handwriting style, or inline subscripts (H2O is fine).

━━━ DO NOT FLAG ━━━
✗ Correct formulas — always verify before flagging
✗ Missing reaction type labels or conditions above arrows
✗ Spacing, dot style, or arrow notation differences
✗ Content that is scientifically correct but worded differently

For "student_wrote": write the SPECIFIC wrong fragment only — e.g. "O" not "2Mg + O → 2MgO".
This is used to underline just the wrong part in the annotation.

Accuracy score: correct notes with only minor issues.

Return ONLY a valid JSON object — no markdown fences, no explanation outside the JSON:
{
  "accuracy_score": <integer 0-100>,
  "teacher_summary": "<2-3 encouraging sentences as a teacher's comment — focus on what the student got right>",
  "issues": [
    {
      "type": "<one of: wrong_formula | spelling | conceptual_error>",
      "student_wrote": "<ONLY the specific wrong fragment — e.g. 'O', 'CuSO', '2Pb' — NOT the full equation>",
      "correct_version": "<what that fragment should be — e.g. 'O₂', 'CuSO₄', '2PbO'>",
      "description": "<one clear sentence explaining why this is wrong>",
      "severity": "<high for factually wrong, low for spelling>",
      "page_number": <integer: which image page this error is on — 1 for first image, 2 for second, etc.>,
      "approx_line_pct": <integer 0-100: estimated vertical position within that page, 0=very top, 100=very bottom>,
      "approx_x_pct": <integer 0-100: estimated horizontal position within that page, 0=left edge, 100=right edge>
    }
  ],
  "positives": [
    "<one specific thing the student wrote correctly>"
  ]
}`;
}

// ── Call Gemini vision via OpenRouter for error detection ────────────────────
// Shared by Chemistry/Maths (primary) and Kannada (fallback).
async function callGeminiVision(
  imageParts:   OpenAI.Chat.ChatCompletionContentPart[],
  systemPrompt: string,
): Promise<{ accuracy_score: number; teacher_summary: string; issues: CorrectionIssue[]; positives: string[] }> {
  const res = await openai.chat.completions.create({
    model: CLAUDE_MODEL,
    messages: [
      {
        role:    "system",
        content: "You are a JSON-only API. Your entire response must be a single valid JSON object. Do not write any explanation, prose, or markdown — only the JSON object.",
      },
      {
        role: "user",
        content: [
          ...imageParts,
          {
            type: "text",
            text: `${systemPrompt}

Analyse the handwritten notes in the ${imageParts.length === 1 ? "image" : `${imageParts.length} images`} above and respond with ONLY this JSON object (fill in the values, no other text):
{
  "accuracy_score": 0,
  "teacher_summary": "",
  "issues": [],
  "positives": []
}`,
          },
        ],
      },
    ],
    max_tokens:      8192,
    temperature:     0,
    response_format: { type: "json_object" },
  });

  const rawText = res.choices[0]?.message?.content ?? "";
  let clean = rawText
    .replace(/^```json\s*/m, "")
    .replace(/^```\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
  const jsonStart = clean.indexOf("{");
  const jsonEnd   = clean.lastIndexOf("}");
  if (jsonStart !== -1 && jsonEnd > jsonStart) clean = clean.slice(jsonStart, jsonEnd + 1);

  const parsed = JSON.parse(clean);
  return {
    accuracy_score:  parsed.accuracy_score  ?? 0,
    teacher_summary: parsed.teacher_summary ?? "",
    issues:          Array.isArray(parsed.issues)    ? parsed.issues    : [],
    positives:       Array.isArray(parsed.positives) ? parsed.positives : [],
  };
}

// ── Kannada only: ask the vision LLM for pixel-precise bounding boxes ─────────
// Groups issues by page, sends one targeted image per page, asks the model to
// locate each flagged word and return its bbox as 0–1 fractions of image size.
// Mutates issues[].precise_bbox in-place (non-fatal if call fails).
async function getVisionBboxes(
  imageParts: OpenAI.Chat.ChatCompletionContentPart[],
  issues:     CorrectionIssue[],
): Promise<void> {
  // Group annotatable issues by page_number (default page 1)
  const byPage = new Map<number, { idx: number; iss: CorrectionIssue }[]>();
  issues.forEach((iss, idx) => {
    if (!iss.student_wrote) return;
    const page = iss.page_number ?? 1;
    if (!byPage.has(page)) byPage.set(page, []);
    byPage.get(page)!.push({ idx, iss });
  });

  for (const [pageNum, pageIssues] of byPage) {
    const pageImgPart = imageParts[pageNum - 1];
    if (!pageImgPart) continue;

    const wordList = pageIssues
      .map((item, i) => `${i + 1}. "${item.iss.student_wrote}"`)
      .join("\n");

    const prompt = `This image contains handwritten Kannada text.
Find each of the following Kannada words/phrases and return their exact bounding boxes.

Words to locate:
${wordList}

Return ONLY a JSON object with a "results" array — no markdown, no explanation:
{
  "results": [
    {
      "index": 1,
      "found": true,
      "left": <left edge, 0.0–1.0 fraction of image width>,
      "top": <top edge, 0.0–1.0 fraction of image height>,
      "width": <word width, 0.0–1.0 fraction of image width>,
      "height": <word height, 0.0–1.0 fraction of image height>
    }
  ]
}
If a word is not visible, set found: false and omit left/top/width/height.`;

    try {
      const bboxRes = await openai.chat.completions.create({
        model: CLAUDE_MODEL,
        messages: [
          {
            role:    "system",
            content: "You are a JSON-only API. Return only a valid JSON array, no markdown.",
          },
          {
            role:    "user",
            content: [pageImgPart, { type: "text", text: prompt }],
          },
        ],
        max_tokens:  2000,
        temperature: 0,
        // NOTE: response_format:json_object must NOT be used with vision (multimodal) requests
        // on Gemini Flash via OpenRouter — it truncates the output. System prompt handles JSON.
      });

      const raw = bboxRes.choices[0]?.message?.content ?? "{}";
      let clean = raw
        .replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();

      // Gemini may return a bare array OR { "results": [...] } — handle both
      const arrStart = clean.indexOf("[");
      const arrEnd   = clean.lastIndexOf("]");
      const objStart = clean.indexOf("{");
      const objEnd   = clean.lastIndexOf("}");

      let results: Array<{
        index: number; found: boolean;
        left?: number; top?: number; width?: number; height?: number;
      }> = [];

      if (arrStart !== -1 && arrEnd > arrStart) {
        // Bare array (most common with vision models)
        results = JSON.parse(clean.slice(arrStart, arrEnd + 1));
      } else if (objStart !== -1 && objEnd > objStart) {
        // Wrapped object { results: [...] }
        const parsed = JSON.parse(clean.slice(objStart, objEnd + 1));
        results = Array.isArray(parsed.results) ? parsed.results : [];
      }

      for (const r of results) {
        if (!r.found || r.left == null || r.top == null) continue;
        const item = pageIssues[r.index - 1];
        if (!item) continue;
        issues[item.idx].precise_bbox = {
          left:   Math.max(0, Math.min(1, r.left)),
          top:    Math.max(0, Math.min(1, r.top)),
          width:  Math.max(0.02, Math.min(1, r.width  ?? 0.15)),
          height: Math.max(0.01, Math.min(0.15, r.height ?? 0.025)),
        };
      }
    } catch (e: any) {
      console.error(`[correct-notes/bbox] page ${pageNum} call failed:`, e.message);
    }
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────
export interface ChapterRef {
  chapter_title: string;
  subject:       string;
  content_text:  string;
}

/**
 * Runs the full notes-correction pipeline (OCR/vision error detection +
 * bbox annotation) and returns a CorrectionResult-shaped object
 * (minus image_urls, which the caller already has).
 */
export async function runNotesCorrection(
  imageUrls: string[],
  chapter:   ChapterRef,
  profileId: string,
): Promise<Omit<CorrectionResult, "image_urls">> {
  const { chapter_title, subject, content_text } = chapter;

  // Convert all images to base64 in parallel (same helper as evaluate-written)
  const imageParts = await Promise.all(imageUrls.map(toBase64Part));

  // ── Error detection ──────────────────────────────────────────────────────
  // Kannada: Sarvam Vision OCR → Gemini text error detection (text-only, no images)
  //          Falls back to Gemini vision (with images) if OCR fails.
  // Other subjects: original Gemini vision path (unchanged).
  let parsed: {
    accuracy_score:  number;
    teacher_summary: string;
    issues:          CorrectionIssue[];
    positives:       string[];
  };

  if (subject === "Kannada") {
    const sarvamResult = await runSarvamHybrid(imageUrls, chapter_title, content_text);

    if (sarvamResult) {
      parsed = sarvamResult;
    } else {
      // ⚠️ Sarvam failed → fall back to Gemini vision
      console.warn("[correctNotes] Falling back to Gemini vision for Kannada");
      const systemPrompt = buildKannadaSystemPrompt(chapter_title, content_text);
      parsed = await callGeminiVision(imageParts, systemPrompt);
    }
  } else {
    const systemPrompt = buildSystemPrompt(subject, chapter_title, content_text);
    parsed = await callGeminiVision(imageParts, systemPrompt);
  }

  // Sanitise + clamp
  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  const result: Omit<CorrectionResult, "image_urls"> = {
    accuracy_score:  Math.min(100, Math.max(0, parsed.accuracy_score ?? 0)),
    teacher_summary: parsed.teacher_summary ?? "",
    issues,
    positives:       Array.isArray(parsed.positives) ? parsed.positives : [],
    annotated_image_urls: imageUrls,   // default to originals; overwritten below
  };

  // For Kannada: ask Gemini for pixel-precise bounding boxes before annotating.
  // Chemistry / Maths continue to use Textract text-matching as before.
  if (subject === "Kannada" && issues.length > 0) {
    try {
      await getVisionBboxes(imageParts, issues);
    } catch (bboxErr: any) {
      console.error("[correctNotes] vision bbox (non-fatal):", bboxErr.message);
    }
  }

  // Annotate pages with underlines + ticks (non-fatal)
  try {
    const annotated = await annotateNotesSheets(imageUrls, issues, profileId);
    result.annotated_image_urls = annotated;
  } catch (annotateErr: any) {
    console.error("[correctNotes] annotation failed (non-fatal):", annotateErr.message);
  }

  return result;
}
