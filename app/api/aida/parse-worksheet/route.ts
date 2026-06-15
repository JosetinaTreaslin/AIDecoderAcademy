import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getWorksheetSchema } from "@/lib/worksheetSchemas";

export const runtime     = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── parse-worksheet ──────────────────────────────────────────────────────────
// Given a URL to a DOCX or PDF the student just uploaded, extract the text
// and use GPT-4o-mini to map it back to the worksheet schema field IDs.
//
// POST { fileUrl: string; format: "docx" | "pdf"; lmsId: string }
// → 200 { data: Record<string, string | boolean> }
//
// The client dispatches `aida:worksheet-parsed` with the data so
// WorksheetPopup pre-fills the form and the student can review before saving.

async function extractDocxText(buf: Buffer): Promise<string> {
  // Dynamic import — mammoth is Node-only.
  const mammoth = await import("mammoth");
  const result  = await mammoth.default.extractRawText({ buffer: buf });
  return result.value.trim();
}

async function extractPdfText(buf: Buffer): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const result   = await pdfParse(buf as unknown as Buffer);
    return (result.text as string).trim();
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let fileUrl: string, format: string, lmsId: string;
  try {
    const body = await req.json();
    fileUrl = body.url ?? body.fileUrl;
    format  = body.format;
    lmsId   = body.lmsId;
    if (!fileUrl || !format || !lmsId) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ error: "Expected { url, format, lmsId }" }, { status: 400 });
  }

  const schema = getWorksheetSchema(lmsId);
  if (!schema) {
    return NextResponse.json({ error: `No worksheet schema for ${lmsId}` }, { status: 404 });
  }

  // Fetch the uploaded file
  let buf: Buffer;
  try {
    const resp = await fetch(fileUrl);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
    buf = Buffer.from(await resp.arrayBuffer());
  } catch (e) {
    return NextResponse.json({ error: `Could not fetch file: ${(e as Error).message}` }, { status: 422 });
  }

  // Extract raw text
  let rawText = "";
  try {
    rawText = format === "docx"
      ? await extractDocxText(buf)
      : await extractPdfText(buf);
  } catch (e) {
    return NextResponse.json({ error: `Text extraction failed: ${(e as Error).message}` }, { status: 422 });
  }

  if (!rawText.trim()) {
    return NextResponse.json({ error: "Document appears to be empty or image-only." }, { status: 422 });
  }

  // Build a compact field-list for GPT
  const fieldLines = schema.sections.flatMap(s =>
    s.fields.map(f => {
      const kind = f.kind === "yesno" ? "boolean (YES/NO)" : "string";
      return `  "${f.id}": ${kind} — ${f.label}`;
    })
  ).join("\n");

  const systemPrompt = `You are a worksheet-parsing assistant. You receive raw text from a student's completed worksheet document and must extract their answers and map them to a JSON object.

Field IDs and types:
${fieldLines}

Rules:
- Return ONLY a valid JSON object with field IDs as keys.
- For string fields: copy the student's answer verbatim (trim whitespace). If unanswered, omit the key.
- For boolean (YES/NO) fields: return true for YES, false for NO. If unanswered, omit the key.
- Do not invent answers. If the student didn't answer a field, skip it.
- Do not include any commentary outside the JSON.`;

  let data: Record<string, string | boolean> = {};
  try {
    const resp = await openai.chat.completions.create({
      model:       "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system",    content: systemPrompt },
        { role: "user",      content: `Extract the student's answers from this worksheet text:\n\n${rawText.slice(0, 8000)}` },
      ],
    });

    const raw = resp.choices[0]?.message?.content ?? "{}";
    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed  = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") {
      // Only keep keys that exist in the schema
      const validIds = new Set(schema.sections.flatMap(s => s.fields.map(f => f.id)));
      for (const [k, v] of Object.entries(parsed)) {
        if (validIds.has(k) && (typeof v === "string" || typeof v === "boolean")) {
          data[k] = v;
        }
      }
    }
  } catch (e) {
    return NextResponse.json({ error: `GPT mapping failed: ${(e as Error).message}` }, { status: 500 });
  }

  return NextResponse.json({ data });
}
