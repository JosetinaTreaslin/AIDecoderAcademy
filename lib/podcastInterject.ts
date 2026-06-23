import OpenAI from "openai";
import type { Turn } from "@/lib/podcastEpisode";
import type { PodcastPersona } from "@/lib/podcastPersonas";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface InterjectInput {
  question: string;
  topic: string;
  persona: PodcastPersona;
  recentTurns: Turn[];
}

export async function buildInterjectionTurns(inp: InterjectInput): Promise<Turn[]> {
  const sys =
    `You are scripting a SHORT detour in a kids' (ages 11-16) podcast about "${inp.topic}". ` +
    `HOST = Bhavna (warm teacher). GUEST = ${inp.persona.name}, a ${inp.persona.archetype} ` +
    `(${inp.persona.personality}). A young listener just asked a question. ` +
    `Write 2-4 turns where BOTH Bhavna and the guest answer it simply and kindly. ` +
    `Make it feel like a conversation, not a Q&A break: the guest can turn it back to the listener ` +
    `("What do YOU think about that?"), or the host can give a one-line recap ("So we just learned X and Y!"). ` +
    `THEN exactly ONE final "bridge-back" turn (speaker: "host") that playfully steers back to the show. ` +
    `The bridge-back turn MUST contain one of these phrases: "anyway", "where were we", "back to", or "resume". ` +
    `Example bridge-back: "Anyway, where were we? Ah yes — let's dive back in!" ` +
    `Plain spoken English, no markdown. ` +
    `Return ONLY valid JSON in this exact shape: {"turns":[{"speaker":"host","text":"..."},{"speaker":"guest","text":"..."}]}`;
  const recent = inp.recentTurns.slice(-4).map(t => `${t.speaker}: ${t.text}`).join("\n");
  const raw = (await openai.chat.completions.create({
    model: "gpt-4o-mini", temperature: 0.8, response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: `Recent lines:\n${recent}\n\nListener question: ${inp.question}` },
    ],
  })).choices[0]?.message?.content ?? "{}";
  const turns: Turn[] = (JSON.parse(raw).turns ?? []).slice(0, 6);
  if (turns.length < 2) throw new Error("interjection too short");
  return turns;
}
