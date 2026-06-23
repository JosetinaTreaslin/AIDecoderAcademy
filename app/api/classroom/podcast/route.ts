import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { matchPersona, buildDynamicPersona } from "@/lib/podcastPersonas";
import { synthesizeEpisode, type Turn } from "@/lib/podcastEpisode";

export const maxDuration = 300;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const { topic, chapterTitle } = (await req.json()) as { topic: string; chapterTitle: string };
  const subject = topic?.trim() || chapterTitle;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (o: unknown) => controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      try {
        // 1. Persona
        const persona = matchPersona(subject) ?? buildDynamicPersona(subject);
        send({ stage: "persona", persona: { id: persona.id, name: persona.name, archetype: persona.archetype } });

        // 2. Script
        const sys =
          `Write a kids' podcast (ages 11-16) about "${subject}". Two speakers:\n` +
          `HOST = Bhavna (warm teacher). GUEST = ${persona.name}, a ${persona.archetype} ` +
          `(${persona.personality}; style: ${persona.speakingStyle}). The guest is a FICTIONAL character ` +
          `inspired by an archetype — never claim to be a real person, never quote real people.\n` +
          `COLD OPEN HOOK (first 15-30 seconds): open with a surprising fact, a vivid question, or a "what if". ` +
          `Examples: "What if your lunch could text you when it's spoiled?" / ` +
          `"Have you ever wondered why shadows move during the day?" / ` +
          `"Imagine if clouds were made of cotton candy..." ` +
          `Never open with a generic line like "Today we will learn about...".\n` +
          `Structure: the cold-open hook, a short intro, 4-6 Q&A beats with light banter, one "whoa" fact, a wrap-up.\n` +
          `Make it sound natural and human: vary sentence length, let speakers react ("Whoa!", "That's wild!", "Hmm, let me think..."), and use the occasional "..." for a beat.\n` +
          `Include 1-2 reflection prompts spoken by the HOST, e.g. "Pause and think: what would YOU do here?" / ` +
          `"Quick mental check — does this fit what you already know?" / ` +
          `"Imagine explaining this to a friend — what would you say first?"\n` +
          `Plain spoken English, no markdown, no LaTeX. Target 24-32 short turns.\n` +
          `Return JSON: {"turns":[{"speaker":"host"|"guest","text":"..."}]}`;
        const tLlm = Date.now();
        const raw = (await openai.chat.completions.create({
          model: "gpt-4o-mini", temperature: 0.8, response_format: { type: "json_object" },
          messages: [{ role: "system", content: sys }, { role: "user", content: `Topic: ${subject}` }],
        })).choices[0]?.message?.content ?? "{}";
        console.log(`[podcast-timing] LLM script: ${Date.now() - tLlm}ms`);
        const turns: Turn[] = (JSON.parse(raw).turns ?? []).slice(0, 32);
        if (!turns.length) throw new Error("empty script");
        send({ stage: "script", total: turns.length });

        // 3. TTS + merge via synthesizeEpisode (per-line progress for the loader)
        send({ stage: "tts", done: 0, total: turns.length });
        const tTts = Date.now();
        const ep = await synthesizeEpisode(
          turns as Turn[],
          persona,
          userId,
          (done, total) => send({ stage: "tts", done, total }),
        );
        console.log(`[podcast-timing] episode synth (TTS+merge): ${Date.now() - tTts}ms`);
        send({ stage: "tts", done: turns.length, total: turns.length });

        // 4. Done
        send({
          stage: "done",
          title: `Podcast: ${subject}`,
          persona: { id: persona.id, name: persona.name, archetype: persona.archetype },
          transcript: turns,
          audioUrl: ep.audioUrl,
          segments: ep.segments,
        });
        controller.close();
      } catch (e) {
        send({ stage: "error", message: (e as Error).message });
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
