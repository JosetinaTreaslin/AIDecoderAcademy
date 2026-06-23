import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { transcribeAudio } from "@/lib/deepgram";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const contentType = req.headers.get("content-type") || "audio/webm";
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length < 200) return NextResponse.json({ error: "No audio" }, { status: 400 });
  try {
    const text = await transcribeAudio(buf, contentType);
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
