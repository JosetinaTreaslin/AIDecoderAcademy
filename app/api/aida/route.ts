import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { createAdminClient } from "@/lib/supabase";
import { queryContext } from "@/lib/pinecone";
import { getPageDoc } from "@/lib/aidaDocs";
import { isEnabled } from "@/lib/featureFlags";
import { buildAidaSystemPrompt } from "@/lib/aidaPersona";
import { moderateContent, detectDistress, buildDistressFooter, getRefusalLine } from "@/lib/aidaSafety";
import { shouldAttachWhiteboard, wrapWhiteboardTranscript } from "@/lib/aidaWhiteboardRouter";
import type { Profile, AgeGroup } from "@/types";

export const runtime     = "nodejs";
export const maxDuration = 60;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const body = await req.json();
    const {
      message,
      history = [],
      pathname = "/dashboard",
      playgroundSession,
      playgroundImages = [],
      interruptedContext,
      isVoiceMode = false,
      profile,
      objectiveId,
      validator_state,
      worksheet_draft,
    }: {
      message:              string;
      history:              { role: "user" | "assistant"; content: string }[];
      pathname:             string;
      playgroundSession?:   string;
      playgroundImages?:    string[];
      interruptedContext?:  string;
      isVoiceMode?:         boolean;
      profile: Profile;
      // Set by the AIDA client when the playground URL has ?objective=<id>.
      // Triggers the hint-or-answer scaffolding in the system prompt.
      objectiveId?:         string | null;
      // Validator + worksheet channel snapshots from chatChannels — small,
      // optional, attached only on graded objectives.
      validator_state?: {
        lmsId:       string | null;
        lastTier:    "distinction" | "merit" | "pass" | "fail" | null;
        lastMode:    "challenge" | "nudge" | "celebrate" | null;
        lastSummary: string | null;
        attempts:    { count: number; lastAt: string | null };
      };
      worksheet_draft?: {
        lmsId:      string;
        data:       Record<string, string | boolean>;
        updated_at: string;
      };
    } = body;

    const isObjectiveMode = !!objectiveId;

    if (!message?.trim()) return new Response("Bad request", { status: 400 });

    // ── Pre-flight safety check ──────────────────────────────────────────────
    let distressFlag = false;
    if (isEnabled("USE_NEW_AIDA_PROMPTS")) {
      const inputVerdict = await moderateContent(message);
      if (!inputVerdict.allow) {
        const refusal = getRefusalLine(profile.age_group as AgeGroup);
        const encoder = new TextEncoder();
        const readable = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(refusal));
            controller.close();
          },
        });
        return new Response(readable, {
          headers: {
            "Content-Type":      "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked",
            "Cache-Control":     "no-cache",
          },
        });
      }
      distressFlag = detectDistress(message);
    }

    // ── Fetch student's profile ID from Supabase ─────────────────────────────
    const supabase = createAdminClient();
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .single();

    const profileId = profileRow?.id as string | undefined;

    // ── Search relevant creations from Pinecone ───────────────────────────────
    let creationsContext = "";
    if (profileId) {
      try {
        const results = await queryContext({ profileId, query: message, topK: 5 });
        if (results.length > 0) {
          creationsContext = "\n\nStudent's relevant creations:\n" +
            results.map(r =>
              `- "${r.title}" (${r.outputType})${r.tags ? ` [tags: ${r.tags}]` : ""}${r.promptUsed ? ` — made with prompt: "${r.promptUsed}"` : ""}`
            ).join("\n");
        }
      } catch {
        // Pinecone failure is non-fatal
      }
    }

    // ── Resolve the raw whiteboard transcript (live > DB fallback) ──────────
    // We always RESOLVE the transcript so the read_whiteboard tool can serve
    // it on demand. Whether we INJECT it into the system prompt up-front is
    // a separate decision (see router below).
    let rawWhiteboardTranscript = "";
    if (playgroundSession && playgroundSession.trim()) {
      rawWhiteboardTranscript = playgroundSession.trim();
    } else if (profileId) {
      try {
        const { data: session } = await supabase
          .from("sessions")
          .select("id")
          .eq("profile_id", profileId)
          .order("started_at", { ascending: false })
          .limit(1)
          .single();

        if (session?.id) {
          const { data: msgs } = await supabase
            .from("chat_messages")
            .select("role, content")
            .eq("session_id", session.id)
            .order("created_at", { ascending: false })
            .limit(6);

          if (msgs && msgs.length > 0) {
            const recent = [...msgs].reverse();
            rawWhiteboardTranscript = recent
              .map(m => `${m.role === "user" ? "Student" : "AI"}: ${String(m.content).slice(0, 300)}`)
              .join("\n");
          }
        }
      } catch {
        // Non-fatal
      }
    }

    // ── Decide whether to inject the transcript at start (router) ───────────
    // - Regex pre-filter handles obvious cases for free.
    // - LLM router (cheap gpt-4o-mini, 4-token reply) handles ambiguous cases.
    // - read_whiteboard tool below handles whatever both layers missed.
    let sessionContext = "";
    let preAttachedWhiteboard = false;
    if (rawWhiteboardTranscript) {
      const verdict = await shouldAttachWhiteboard(message);
      if (verdict === "attach") {
        sessionContext = "\n\n" + wrapWhiteboardTranscript(rawWhiteboardTranscript);
        preAttachedWhiteboard = true;
      }
    }

    // ── Build system prompt ───────────────────────────────────────────────────
    const arenaNames: Record<number, string> = {
      1: "AI Explorer Arena", 2: "Prompt Lab", 3: "Story Forge",
      4: "Visual Studio",     5: "Sound Booth", 6: "Director's Suite",
    };

    const isOnPlayground = pathname.startsWith("/dashboard/playground");

    // ── Validator + worksheet extras (always rendered when present) ────────
    const channelExtras: string[] = [];
    if (validator_state?.lmsId) {
      const v = validator_state;
      channelExtras.push(
        `[Validator Teacher last verdict — objective ${v.lmsId}]\n` +
        `tier: ${v.lastTier ?? "n/a"} | mode: ${v.lastMode ?? "n/a"} | attempts: ${v.attempts.count}\n` +
        `summary: ${v.lastSummary ?? "(none yet)"}\n` +
        `If the kid asks what the teacher meant, paraphrase the summary in your own words. Never speak as the teacher.`
      );
    }
    if (worksheet_draft?.lmsId) {
      const w = worksheet_draft;
      const compact = Object.entries(w.data)
        .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v.slice(0, 200) : v}`)
        .join("\n");
      if (compact) {
        channelExtras.push(
          `[Kid's current worksheet draft — objective ${w.lmsId}]\n${compact}\n` +
          `Read for context. Do not invent answers for them. Do not paste their draft back at them.`
        );
      }
    }

    const baseSystemPrompt = isEnabled("USE_NEW_AIDA_PROMPTS")
      ? buildAidaSystemPrompt({
          profile:           profile as Profile,
          pageContext:       getPageDoc(pathname),
          sessionContext:    sessionContext || undefined,
          creationsContext:  creationsContext || undefined,
          isVoiceMode,
          interruptedContext,
          isObjectiveMode,
        })
      : `You are AIDA, an AI assistant built into AI Decoder Academy — a creative AI learning platform for students aged 11–16.${interruptedContext ? `\n\nIMPORTANT: The student just interrupted you mid-response. You were in the middle of saying: "${interruptedContext.slice(0, 400)}". Acknowledge the new question briefly, answer it clearly, then offer to continue your previous explanation if it's still relevant.` : ""}

About the student you're talking to:
- Name: ${profile.display_name}
- Age group: ${profile.age_group}
- Interests: ${profile.interests?.join(", ") || "not set"}
- XP: ${profile.xp}, Level: ${profile.level}, Streak: ${profile.streak_days} days
- Current arena: ${arenaNames[profile.active_arena] ?? "AI Explorer Arena"}

Current page context:
${getPageDoc(pathname)}
${creationsContext}
${sessionContext}

Instructions:
- You are AIDA — friendly, warm, and encouraging. Adapt your language to the student's age group.
- You can answer ANY question — school subjects, general knowledge, coding, creative ideas, or questions about this app. You are not restricted to any topic.
- When answering questions about the student's creations or activity, use the context provided above.
- Keep responses concise and easy to understand. Use simple language for younger students.
- If the student asks about a feature or page in the app, use the page context to guide them accurately.
${isOnPlayground && sessionContext ? `
Playground coaching instructions (IMPORTANT — follow these when the student asks about their creations):
- You can see everything the student generated in their current playground session above.
- If the student asks "why did it turn out like this?" or "why didn't it work?", look at their prompt and the output type, then explain in simple terms what likely caused it — e.g., vague description, missing details, too many conflicting ideas, or unclear instructions.
- For IMAGE prompts: look for missing details like style, lighting, colours, mood, or a clear subject.
- For AUDIO prompts: look for whether they named characters, set a scene, gave emotions, or described the story clearly.
- For SLIDES prompts: look for whether they gave a clear topic, structure, or level of detail.
- For TEXT/JSON prompts: look at whether the instruction was clear, specific, and had enough context.
- ALWAYS frame mistakes as learning moments — never criticise, always encourage.
- Before giving the full answer, offer a choice: e.g., "Want me to just tell you what to fix, or would you prefer a hint so you can figure it out yourself?" Let the student decide.
- If they want a hint: give one small clue, then ask if they want another.
- If they want the full answer: explain clearly then offer to help rewrite the prompt together.
- Keep explanations short, fun, and age-appropriate. Use analogies kids relate to.
` : ""}`;

    const systemPrompt = channelExtras.length > 0
      ? `${baseSystemPrompt}\n\n${channelExtras.join("\n\n")}`
      : baseSystemPrompt;

    // ── Stream response ───────────────────────────────────────────────────────
    const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: "text", text: message },
      ...(playgroundImages.slice(0, 4).map(url => ({
        type: "image_url" as const,
        image_url: { url, detail: "low" as const },
      }))),
    ];

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-6).map(m => ({
        role:    m.role as "user" | "assistant",
        content: m.content,
      })),
      {
        role:    "user",
        content: playgroundImages.length > 0 ? userContent : message,
      },
    ];

    // ── read_whiteboard tool ────────────────────────────────────────────────
    // Always offered (even when the transcript is pre-attached) so AIDA can
    // refresh mid-reasoning if it concludes it needs the whiteboard after
    // the router said skip. The tool returns the same wrapped transcript we
    // would have injected up front. If there's no transcript (student hasn't
    // typed in the whiteboard yet) we still expose the tool so the LLM has a
    // canonical way to discover that fact.
    const tools: OpenAI.Chat.ChatCompletionTool[] = [{
      type: "function",
      function: {
        name:        "read_whiteboard",
        description: "Returns the current transcript of the student's separate whiteboard chat (the in-app creation tool they use to make images, audio, slides, stories, etc.). Call this when the student references their whiteboard work or it's needed to answer their question, AND the transcript isn't already shown in your system prompt.",
        parameters: { type: "object", properties: {}, required: [] },
      },
    }];

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        let fullText = "";
        // Walking conversation buffer for the multi-turn (tool-call) loop.
        const convo: OpenAI.Chat.ChatCompletionMessageParam[] = [...messages];
        const MAX_TOOL_HOPS = 2;

        try {
          for (let hop = 0; hop <= MAX_TOOL_HOPS; hop++) {
            const stream = await openai.chat.completions.create({
              model:       "gpt-4o-mini",
              messages:    convo,
              stream:      true,
              temperature: 0.7,
              max_tokens:  isVoiceMode ? 300 : 800,
              tools,
              tool_choice: "auto",
            });

            // Per-stream accumulators. Tool-calls arrive in deltas.
            type ToolCallAcc = { id: string; name: string; args: string };
            const toolCallAccs: ToolCallAcc[] = [];
            let assistantText  = "";
            let finishedReason: string | null = null;

            for await (const chunk of stream) {
              const choice = chunk.choices[0];
              if (!choice) continue;

              const delta = choice.delta;

              // Stream regular content tokens to the client immediately.
              const text = delta?.content ?? "";
              if (text) {
                assistantText += text;
                fullText      += text;
                controller.enqueue(encoder.encode(text));
              }

              // Accumulate tool-call deltas (don't stream them to client).
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!toolCallAccs[idx]) {
                    toolCallAccs[idx] = { id: tc.id ?? "", name: "", args: "" };
                  }
                  if (tc.id)               toolCallAccs[idx].id    = tc.id;
                  if (tc.function?.name)   toolCallAccs[idx].name += tc.function.name;
                  if (tc.function?.arguments) toolCallAccs[idx].args += tc.function.arguments;
                }
              }

              if (choice.finish_reason) finishedReason = choice.finish_reason;
            }

            // No tool calls → conversation done.
            if (finishedReason !== "tool_calls" || toolCallAccs.length === 0) {
              break;
            }

            // Append the assistant's tool-call turn to the conversation.
            convo.push({
              role:       "assistant",
              content:    assistantText || null,
              tool_calls: toolCallAccs.map(t => ({
                id:       t.id,
                type:     "function" as const,
                function: { name: t.name, arguments: t.args || "{}" },
              })),
            });

            // Resolve each tool call. Right now we only have read_whiteboard.
            for (const t of toolCallAccs) {
              let toolResult: string;
              if (t.name === "read_whiteboard") {
                toolResult = rawWhiteboardTranscript
                  ? wrapWhiteboardTranscript(rawWhiteboardTranscript)
                  : "(The student's whiteboard is currently empty — they haven't generated anything there yet.)";
              } else {
                toolResult = `Unknown tool: ${t.name}`;
              }
              convo.push({
                role:         "tool",
                tool_call_id: t.id,
                content:      toolResult,
              });
            }

            // On the next loop iteration we re-call the model with the tool
            // results in context; it'll continue generating the user-facing
            // reply that streams back through the same controller.
          }

          // Append distress footer if the user message triggered detection
          if (distressFlag) {
            const footer = buildDistressFooter("auto");
            controller.enqueue(encoder.encode(footer));
          }
          // Defensive post-hoc moderation on the assistant response (fire-and-forget)
          if (isEnabled("USE_NEW_AIDA_PROMPTS") && fullText) {
            moderateContent(fullText).then(v => {
              if (!v.allow) {
                console.warn("[aida] post-hoc moderation flagged assistant output:", v.reason);
              }
            }).catch(() => { /* logged inside moderateContent */ });
          }
          // Visibility into router/tool decisions for live debugging.
          console.log(`[AIDA] preAttached=${preAttachedWhiteboard} hops=${convo.length - messages.length}`);
        } catch (err) {
          console.error("[AIDA stream]", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type":      "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control":     "no-cache",
      },
    });
  } catch (err) {
    console.error("[AIDA]", err);
    return new Response("Internal server error", { status: 500 });
  }
}
