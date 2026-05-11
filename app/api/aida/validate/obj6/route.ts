import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import {
  OBJ6_RUBRIC,
  type Obj6CanvasFields,
  type Obj6IdentityCard,
  type Obj6CanvasStageResult,
  type Obj6IdentityCardStageResult,
  type Obj6CreateItStageResult,
  type Obj6FinalResult,
} from "@/lib/obj6Rubric";
import { moderateContent } from "@/lib/aidaSafety";
import { applyCopyMode } from "@/lib/validatorCopyMode";
import { extractWorksheet } from "@/lib/worksheetExtract";
import { createAdminClient } from "@/lib/supabase";

export const runtime     = "nodejs";
export const maxDuration = 90;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Three-stage validator for OBJ 6 (avatar HeyGen MP4).
// Stage 0: extract Canvas + Identity Card (inline-form direct, or LLM from .docx/.pdf)
// Stage 1: Canvas quality (70% threshold — highest in Level 1)
// Stage 2: Identity Card structural checks (4 binary)
// Stage 3: Avatar video — Whisper transcription + GPT script-line presence

interface Body {
  worksheet:
    | { kind: "file"; url: string; format: "pdf" | "docx"; filename: string }
    | { kind: "inline-form"; data: Record<string, string | boolean>; lmsId: string };
  videoUrl?: string;
  notes?:    string;
  profile:   { display_name: string; age_group: string };
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }
function jsonResponse<T>(data: T) {
  return new Response(JSON.stringify(data), {
    status:  200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function fromInline(data: Record<string, string | boolean>): { canvas: Obj6CanvasFields; card: Obj6IdentityCard } {
  const s = (k: string) => (typeof data[k] === "string" ? (data[k] as string).trim() : "");
  const b = (k: string) => data[k] === true;
  return {
    canvas: {
      intent:      s("intent"),
      assumptions: s("assumptions"),
      audience:    s("audience"),
      success:     s("success"),
    },
    card: {
      appearance:        s("appearance"),
      voiceCharacter:    s("voiceCharacter"),
      personalityTraits: s("personalityTraits"),
      presentationStyle: s("presentationStyle"),
      scriptConfirmed:   b("scriptConfirmed"),
      successTest:       s("successTest"),
    },
  };
}

async function gradeCanvas(
  canvas:       Obj6CanvasFields,
  ageGroup:     string,
  attemptCount: number,
  displayName:  string,
): Promise<Obj6CanvasStageResult> {
  const r = OBJ6_RUBRIC.canvas;
  const baseSystem = `
You are the Validator Teacher at AI Decoder Academy — a SKEPTICAL MENTOR.
The student has filled in the Think It Canvas for OBJ 6 (build your avatar).
This avatar persists for 6 levels — the bar is high. Threshold: ${r.minPassPct}%.

Score four fields:
🎯 INTENT
- PLACEHOLDER (0-30): describes the task, no audience purpose, no design goal.
- GENUINE (70-100): names a specific impression for a specific audience. Example: "${r.fieldHints.intent.genuineEx}"

🔍 ASSUMPTIONS
- PLACEHOLDER (0-30): "none" or a vague belief.
- GENUINE (70-100): specific, testable bet. Example: "${r.fieldHints.assumptions.genuineEx}"

👥 AUDIENCE
- PLACEHOLDER (0-30): generic group label.
- GENUINE (70-100): specific people + the response they have to presenters. Example: "${r.fieldHints.audience.genuineEx}"

✅ SUCCESS
- PLACEHOLDER (0-30): "if it looks good" — creator-centred.
- GENUINE (70-100): observable audience behaviour. Example: "${r.fieldHints.success.genuineEx}"

Pick MODE:
- "challenge" → any field is placeholder.
- "nudge"     → at least one is genuine but others are shallow.
- "celebrate" → all four are specific, audience-centred, testable.

Score is the average of the four field sub-scores.

VOICE — Skeptical Mentor:
- Steady. Few exclamation marks. No emojis.
- NEVER use "wrong". Use: "try again", "go deeper", "be more specific".
- Speak directly to the student. Adapt vocabulary to age group ${ageGroup}.

Field feedback: 1-2 sentences each. Summary: one short line spoken aloud.
Return strict JSON: { score, mode, fieldFeedback: { intent, assumptions, audience, success }, summary }.
`.trim();

  const user = `
INTENT:      ${canvas.intent      || "(empty)"}
ASSUMPTIONS: ${canvas.assumptions || "(empty)"}
AUDIENCE:    ${canvas.audience    || "(empty)"}
SUCCESS:     ${canvas.success     || "(empty)"}

Grade now. Return only the JSON object.
`.trim();

  const system = applyCopyMode(baseSystem, attemptCount, displayName);

  const completion = await openai.chat.completions.create({
    model:           "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature:     0.2,
    max_tokens:      500,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user },
    ],
  });

  const raw    = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as {
    score: number;
    mode:  "challenge" | "nudge" | "celebrate";
    fieldFeedback: { intent: string; assumptions: string; audience: string; success: string };
    summary: string;
  };
  const score  = clamp(Math.round(parsed.score ?? 0), 0, 100);

  return {
    stage:         "canvas",
    passed:        score >= r.minPassPct,
    score,
    mode:          parsed.mode ?? "challenge",
    fieldFeedback: parsed.fieldFeedback ?? { intent: "", assumptions: "", audience: "", success: "" },
    summary:       parsed.summary ?? "",
  };
}

function gradeIdentityCard(card: Obj6IdentityCard): Obj6IdentityCardStageResult {
  const wc = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  const appearance40Plus       = wc(card.appearance) >= 40;
  const voiceTrim              = card.voiceCharacter.trim();
  const voiceSpecific          = voiceTrim.length > 0 && !/^(clear|professional|clear and professional)$/i.test(voiceTrim);
  const personalityBehavioural = card.personalityTraits.trim().length >= 20;
  const scriptConfirmed        = card.scriptConfirmed === true;

  const passed = appearance40Plus && voiceSpecific && personalityBehavioural && scriptConfirmed;
  const summary = passed
    ? "Identity Card complete. Avatar concept is ready to build."
    : "Identity Card needs another pass. See field feedback.";
  return {
    stage: "identityCard", passed,
    appearance40Plus, voiceSpecific, personalityBehavioural, scriptConfirmed,
    summary,
  };
}

async function gradeCreateIt(videoUrl: string, avatarName: string): Promise<Obj6CreateItStageResult> {
  // 1. Reachability + content-type.
  let videoReachable = false;
  try {
    const head = await fetch(videoUrl, { method: "HEAD" });
    videoReachable = head.ok && (head.headers.get("content-type") ?? "").startsWith("video/");
  } catch { videoReachable = false; }

  if (!videoReachable) {
    return {
      stage: "createIt", score: 0, tier: "fail",
      videoReachable: false, line1Present: false, line2Present: false, line3Present: false,
      transcriptExcerpt: "",
      summary: "Video URL not reachable. Re-upload your HeyGen MP4.",
    };
  }

  // 2. Transcribe (Whisper accepts MP4 audio extraction natively).
  let transcriptText = "";
  try {
    const audioBlob = await fetch(videoUrl).then(r => r.blob());
    const file      = new File([audioBlob], "avatar.mp4", { type: "video/mp4" });
    const transcript = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
    } as unknown as { model: string; file: File });
    transcriptText = (transcript as unknown as { text: string }).text || "";
  } catch (err) {
    console.error("[validate/obj6] whisper failed:", err);
    return {
      stage: "createIt", score: 0, tier: "fail",
      videoReachable: true, line1Present: false, line2Present: false, line3Present: false,
      transcriptExcerpt: "",
      summary: "Couldn't transcribe the video. Make sure the audio is clear and try again.",
    };
  }

  // 3. Line presence — fuzzy via GPT (avatar name in line 1 is freeform).
  const lineCheckPrompt = `
You judge whether the student's avatar transcript contains all three required script lines.

Required lines (line 1's avatar name may match either the student's typed name "${avatarName}" or any name they speak in line 1):
1. "Hi. I am [Avatar Name]."
2. "I am an AI Creator at AI Decoder Academy."
3. "By Level 6 — I will have built something the world has never seen."

Be lenient on minor word-order or filler differences, strict on the meaning.

Transcript:
"""${transcriptText.slice(0, 4000)}"""

Return strict JSON: { line1Present: boolean, line2Present: boolean, line3Present: boolean }`;

  const lineCheck = await openai.chat.completions.create({
    model:           "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature:     0,
    max_tokens:      100,
    messages: [{ role: "user", content: lineCheckPrompt }],
  });
  const lines = JSON.parse(lineCheck.choices[0]?.message?.content ?? "{}");
  const line1 = !!lines.line1Present;
  const line2 = !!lines.line2Present;
  const line3 = !!lines.line3Present;
  const linesPresent = [line1, line2, line3].filter(Boolean).length;

  const score = Math.round((linesPresent / 3) * 100);
  const tier: Obj6CreateItStageResult["tier"] = linesPresent === 3 ? "pass" : "fail";

  const summary = linesPresent === 3
    ? "All three required script lines present. Avatar identity confirmed."
    : `Missing ${3 - linesPresent} of 3 required script lines. Re-record.`;

  return {
    stage: "createIt", score, tier,
    videoReachable: true,
    line1Present: line1, line2Present: line2, line3Present: line3,
    transcriptExcerpt: transcriptText.slice(0, 400),
    summary,
  };
}

function pickFeedback(tier: Obj6FinalResult["tier"]): string {
  switch (tier) {
    case "distinction": return OBJ6_RUBRIC.feedbackScripts.distinction;
    case "merit":       return OBJ6_RUBRIC.feedbackScripts.merit;
    case "pass":        return OBJ6_RUBRIC.feedbackScripts.pass;
    case "fail":        return "Have another look at your avatar — you've got this.";
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });
    const body = (await req.json()) as Body;

    if (!body?.worksheet) return new Response("Worksheet payload is required", { status: 400 });

    const profile = body.profile ?? { display_name: "Student", age_group: "11-13" };
    const notes   = (body.notes || "").slice(0, 2000);

    // Stage 0 — extract Canvas + Identity Card.
    let canvas: Obj6CanvasFields;
    let card:   Obj6IdentityCard;
    let avatarName = profile.display_name;
    let obj5Complete = true;   // default true if not specified

    if (body.worksheet.kind === "inline-form") {
      const r = fromInline(body.worksheet.data);
      canvas       = r.canvas;
      card         = r.card;
      avatarName   = (body.worksheet.data["avatarName"] as string) || profile.display_name;
      obj5Complete = body.worksheet.data["obj5Complete"] === true;
    } else {
      // .docx/.pdf path — extract raw worksheet text/file then ask GPT to map.
      const ws = await extractWorksheet(
        { url: body.worksheet.url, format: body.worksheet.format },
        openai,
        body.worksheet.filename,
      );
      const sys = `Extract the OBJ 6 worksheet into JSON: {
  canvas: { intent, assumptions, audience, success },
  card:   { appearance, voiceCharacter, personalityTraits, presentationStyle, scriptConfirmed (boolean), successTest },
  avatarName: string,
  obj5Complete: boolean
}.
Use empty strings for missing text fields and false for missing booleans.
Return strict JSON only.`;
      const userMsg = ws.kind === "text"
        ? `Worksheet:\n${ws.text}\nNotes:\n${notes}`
        : `(file_id: ${ws.fileId})\nNotes:\n${notes}`;
      const ext = await openai.chat.completions.create({
        model:           "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature:     0.1,
        max_tokens:      1200,
        messages: [
          { role: "system", content: sys },
          { role: "user",   content: userMsg },
        ],
      });
      const parsed = JSON.parse(ext.choices[0]?.message?.content ?? "{}");
      canvas = parsed.canvas ?? { intent: "", assumptions: "", audience: "", success: "" };
      card   = parsed.card   ?? {
        appearance: "", voiceCharacter: "", personalityTraits: "",
        presentationStyle: "", scriptConfirmed: false, successTest: "",
      };
      avatarName   = parsed.avatarName   || profile.display_name;
      obj5Complete = parsed.obj5Complete !== false;
    }

    // Moderation
    const fullText = [
      canvas.intent, canvas.assumptions, canvas.audience, canvas.success,
      card.appearance, card.voiceCharacter, card.personalityTraits, card.presentationStyle, card.successTest,
      notes,
    ].join("\n");
    const verdict = await moderateContent(fullText);
    if (!verdict.allow) {
      const blockedCanvas: Obj6CanvasStageResult = {
        stage: "canvas", passed: false, score: 0, mode: "challenge",
        fieldFeedback: { intent: "", assumptions: "", audience: "", success: "" },
        summary: "I can't grade this submission.",
      };
      const final: Obj6FinalResult = {
        passed: false, composite: 0, tier: "fail",
        canvas: blockedCanvas, identityCard: null, createIt: null,
        feedbackScript: "I can't grade this — let's pick a different submission. Talk to a grown-up if something's bothering you.",
        blockedAtStage: "canvas",
      };
      return jsonResponse(final);
    }

    // OBJ 5 dependency check (worksheet boolean only, until OBJ 5 ships).
    if (!obj5Complete) {
      const blockedCanvas: Obj6CanvasStageResult = {
        stage: "canvas", passed: false, score: 0, mode: "challenge",
        fieldFeedback: { intent: "", assumptions: "", audience: "", success: "" },
        summary: "OBJ 5 must be complete before OBJ 6 — confirm in your worksheet, or finish OBJ 5 first.",
      };
      const final: Obj6FinalResult = {
        passed: false, composite: 0, tier: "fail",
        canvas: blockedCanvas, identityCard: null, createIt: null,
        feedbackScript: "OBJ 5 must be complete before OBJ 6.",
        blockedAtStage: "canvas",
      };
      return jsonResponse(final);
    }

    // Attempts count for copy mode (best-effort).
    let attemptCount = 0;
    try {
      const supabase = createAdminClient();
      const { data: prof } = await supabase
        .from("profiles").select("id").eq("clerk_user_id", userId).single();
      if (prof?.id) {
        const { count } = await supabase
          .from("objective_attempts")
          .select("*", { count: "exact", head: true })
          .eq("profile_id", prof.id)
          .eq("lms_id", "l1-06");
        attemptCount = count ?? 0;
      }
    } catch (err) {
      console.warn("[validate/obj6] attempts count failed, defaulting to 0:", err);
    }

    // Stage 1 — Canvas.
    const canvasResult = await gradeCanvas(canvas, profile.age_group, attemptCount, profile.display_name);
    if (!canvasResult.passed) {
      return jsonResponse<Obj6FinalResult>({
        passed:         false,
        composite:      Math.round(canvasResult.score * OBJ6_RUBRIC.canvas.weight),
        tier:           "fail",
        canvas:         canvasResult,
        identityCard:   null,
        createIt:       null,
        feedbackScript: canvasResult.summary,
        blockedAtStage: "canvas",
      });
    }

    // Stage 2 — Identity Card.
    const cardResult = gradeIdentityCard(card);
    if (!cardResult.passed) {
      return jsonResponse<Obj6FinalResult>({
        passed:         false,
        composite:      Math.round(canvasResult.score * OBJ6_RUBRIC.canvas.weight),
        tier:           "fail",
        canvas:         canvasResult,
        identityCard:   cardResult,
        createIt:       null,
        feedbackScript: "Identity Card needs more specificity. See the four checks.",
        blockedAtStage: "identityCard",
      });
    }

    // Stage 3 — Avatar video.
    if (!body.videoUrl) {
      return jsonResponse<Obj6FinalResult>({
        passed:         false,
        composite:      Math.round(
          canvasResult.score * OBJ6_RUBRIC.canvas.weight +
          100               * OBJ6_RUBRIC.identityCard.weight,
        ),
        tier:           "fail",
        canvas:         canvasResult,
        identityCard:   cardResult,
        createIt:       null,
        feedbackScript: "Upload your HeyGen MP4 to finish grading.",
      });
    }
    const createItResult = await gradeCreateIt(body.videoUrl, avatarName);

    const composite = clamp(Math.round(
      canvasResult.score   * OBJ6_RUBRIC.canvas.weight +
      100                  * OBJ6_RUBRIC.identityCard.weight +
      createItResult.score * OBJ6_RUBRIC.createIt.weight,
    ), 0, 100);
    const tier: Obj6FinalResult["tier"] =
      composite >= 100 ? "distinction" :
      composite >= 90  ? "merit"        :
      composite >= 80  ? "pass"         :
      "fail";

    return jsonResponse<Obj6FinalResult>({
      passed:         tier !== "fail",
      composite, tier,
      canvas:         canvasResult,
      identityCard:   cardResult,
      createIt:       createItResult,
      feedbackScript: pickFeedback(tier),
    });
  } catch (e) {
    console.error("[validate/obj6] error:", e);
    return new Response("Validation failed", { status: 500 });
  }
}
