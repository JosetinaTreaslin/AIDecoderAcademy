import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildInterjectionTurns } from "@/lib/podcastInterject";
import { synthesizeTurns, type Turn } from "@/lib/podcastEpisode";
import { PERSONAS, buildDynamicPersona } from "@/lib/podcastPersonas";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { question, topic, personaId, recentTurns } =
    (await req.json()) as { question: string; topic: string; personaId: string; recentTurns: Turn[] };
  if (!question?.trim()) return NextResponse.json({ error: "No question" }, { status: 400 });
  const persona = PERSONAS.find(p => p.id === personaId) ?? buildDynamicPersona(topic);
  try {
    const turns = await buildInterjectionTurns({ question, topic, persona, recentTurns: recentTurns ?? [] });
    const segments = await synthesizeTurns(turns, persona, userId, "podcast-interject");
    return NextResponse.json({ segments });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
