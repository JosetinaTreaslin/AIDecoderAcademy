import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { getRubric, genericRubric, type ObjectiveRubric } from "@/lib/objectiveRubrics";
import { isEnabled } from "@/lib/featureFlags";
import { buildTeacherSystemPrompt } from "@/lib/teacherPersona";
import { moderateContent } from "@/lib/aidaSafety";
import { applyCopyMode } from "@/lib/validatorCopyMode";
import { createAdminClient } from "@/lib/supabase";
import type { AgeGroup } from "@/types";

export const runtime     = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// One-shot JSON validation. The Validator Teacher reads the rubric for the
// active objective and scores the student's work in the playground chat.
//
// Inputs:
//   lmsId       — canonical curriculum id ('l1-03'). Falls back to a generic
//                  rubric if the rubric file doesn't have an entry yet.
//   fallbackTitle / fallbackTask — used only when no rubric exists, so the
//                  validator still has *something* to grade against.
//   messages    — playground chat (role + content + outputType + url for
//                  media). Already serialised on the client.
//   profile     — name + age_group, so the validator can adapt vocabulary.
//
// Returns strict JSON. The teacher dialogue UI consumes `summary` for TTS,
// the result panel renders the rest.

interface ValidateRequest {
  lmsId:          string;
  fallbackTitle?: string;
  fallbackTask?:  string;
  messages:       { role: "user" | "assistant"; content: string; outputType?: string }[];
  profile: {
    display_name: string;
    age_group:    string;
  };
}

interface ValidatorJSON {
  score:        number;
  tier:         "distinction" | "merit" | "pass" | "fail";
  passed:       boolean;
  summary:      string;
  strengths:    string[];
  improvements: string[];
  hintForRetry: string | null;
}

function buildSystemPrompt(rubric: ObjectiveRubric, profile: ValidateRequest["profile"]): string {
  return `
You are the Validator Teacher at AI Decoder Academy. Your job is to evaluate
ONE specific lab objective the student has just attempted in the playground.

OBJECTIVE: ${rubric.title} (${rubric.lmsId})
TIER: ${rubric.tier}
EXPECTED TASK:
${rubric.labTask}

SUBMIT REQUIREMENT:
${rubric.submitRequirements}

RUBRIC — apply STRICTLY:
- DISTINCTION (100): ${rubric.distinctionCriteria}
- MERIT (90):        ${rubric.meritCriteria}
- PASS (80):         ${rubric.passCriteria}
- FAIL (<80):        outputs missing, wrong tool used, or task not followed.

TEACHER CHECKLIST:
${rubric.teacherChecklist.map(c => `- ${c}`).join("\n")}

CORRECTIVE HINTS YOU MAY USE WHEN APPROPRIATE:
${rubric.correctiveHints.map(h => `- ${h}`).join("\n")}

STUDENT PROFILE:
- Name: ${profile.display_name}
- Age group: ${profile.age_group}
Adapt your vocabulary and tone to a student in this age group. Be encouraging
but truthful. ALWAYS speak directly to the student ("you did…", not "the
student did…"). Keep sentences short and friendly.

INSTRUCTIONS:
1. Read the chat below — that's what the student produced.
2. Score 0-100 against the rubric.
3. Determine tier: distinction (100) | merit (90-99) | pass (80-89) | fail (<80).
4. Output STRICT JSON, no prose, no code fences. Schema:
   {
     "score":        <number 0-100>,
     "tier":         "distinction" | "merit" | "pass" | "fail",
     "passed":       <true if score >= 80, else false>,
     "summary":      "<1-2 short sentences spoken aloud to the student>",
     "strengths":    ["<2-3 bullets, what worked>"],
     "improvements": ["<2-3 bullets, mostly used on fail/pass>"],
     "hintForRetry": "<single helpful sentence for fail, else null>"
   }
`.trim();
}

function serializeMessages(messages: ValidateRequest["messages"]): string {
  if (!messages.length) return "(student has not yet produced any work)";
  return messages.map((m, i) => {
    const ot = m.outputType ? ` [${m.outputType}]` : "";
    if (m.role === "user") return `[${i}] STUDENT${ot}: ${m.content}`;
    // assistant content for image/audio/slides may be a URL or JSON; keep as-is
    return `[${i}] AI${ot}: ${m.content}`;
  }).join("\n");
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const body = (await req.json()) as ValidateRequest;
    if (!body?.lmsId)    return new Response("Missing lmsId", { status: 400 });
    if (!body?.messages) return new Response("Missing messages", { status: 400 });

    const rubric = getRubric(body.lmsId)
      ?? genericRubric(body.fallbackTitle ?? body.lmsId, body.fallbackTask ?? "Complete the assigned task and submit your output to the chat.");

    const profile = body.profile ?? { display_name: "Student", age_group: "11-13" as AgeGroup };

    // Attempts-aware copy mode: at attempt 3+ the validator switches from
    // corrective to metacognitive prompts. Cheap row count, non-blocking.
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
          .eq("lms_id", body.lmsId);
        attemptCount = count ?? 0;
      }
    } catch (err) {
      console.warn("[validate] attempts count failed, defaulting to 0:", err);
    }

    const baseSystemPrompt = isEnabled("USE_NEW_AIDA_PROMPTS")
      ? buildTeacherSystemPrompt({
          rubric,
          profile: { display_name: profile.display_name, age_group: profile.age_group as AgeGroup },
        })
      : buildSystemPrompt(rubric, profile);

    const systemPrompt = applyCopyMode(baseSystemPrompt, attemptCount, profile.display_name);

    const serialised = serializeMessages(body.messages);

    // Defensive moderation on the submitted student work
    const verdict = await moderateContent(serialised);
    if (!verdict.allow) {
      console.warn("[validate] flagged submission, refusing to grade:", verdict.reason);
      return new Response(
        JSON.stringify({
          score:        0,
          tier:         "fail",
          passed:       false,
          summary:      "I can't grade this — let's pick a different submission. Talk to a grown-up if something's bothering you.",
          strengths:    [],
          improvements: [],
          hintForRetry: null,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `STUDENT'S WORK IN THE PLAYGROUND:\n${serialised}\n\nGrade the work now. Return only the JSON object.`;

    const completion = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature:     0.3,
      max_tokens:      600,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: ValidatorJSON;
    try {
      parsed = JSON.parse(raw) as ValidatorJSON;
    } catch (err) {
      console.error("[AIDA validate] JSON parse failed:", raw, err);
      return new Response("Validator returned invalid JSON", { status: 502 });
    }

    // Defensive: clamp score, derive passed from score, normalise tier.
    const score = Math.max(0, Math.min(100, Math.round(parsed.score ?? 0)));
    const passed = score >= 80;
    const tier: ValidatorJSON["tier"] =
      score >= 100 ? "distinction" :
      score >= 90  ? "merit"        :
      score >= 80  ? "pass"         :
      "fail";

    const result: ValidatorJSON = {
      score,
      tier,
      passed,
      summary:      String(parsed.summary ?? "").trim() || "I've finished reviewing your work.",
      strengths:    Array.isArray(parsed.strengths)    ? parsed.strengths.slice(0, 4)    : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements.slice(0, 4) : [],
      hintForRetry: passed ? null : (typeof parsed.hintForRetry === "string" ? parsed.hintForRetry : null),
    };

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[AIDA validate]", err);
    return new Response("Internal server error", { status: 500 });
  }
}
