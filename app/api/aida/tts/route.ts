import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

// Cartesia voice IDs per persona. All fall back to CARTESIA_VOICE_ID if not set.
const VOICE_IDS: Record<string, string> = {
  aida:      process.env.CARTESIA_VOICE_ID           ?? "",
  teacher:   process.env.CARTESIA_TEACHER_VOICE_ID   ?? process.env.CARTESIA_VOICE_ID ?? "",
  classroom: process.env.CARTESIA_CLASSROOM_VOICE_ID ?? process.env.CARTESIA_VOICE_ID ?? "",
};

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    let body: { text?: string; role?: string } = {};
    try { body = await req.json(); } catch { /* bad JSON */ }
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const role = (body?.role as string) ?? "aida";
    if (!text) return new Response("Bad request", { status: 400 });
    // Cartesia rejects text with no word characters — return empty stream silently.
    if (!/\w/.test(text)) return new Response(
      'data: {"type":"done"}\n\n',
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } },
    );

    if (!process.env.CARTESIA_API_KEY) {
      console.error("[TTS] CARTESIA_API_KEY not set");
      return new Response("TTS not configured", { status: 503 });
    }

    const voiceId = VOICE_IDS[role] || VOICE_IDS.aida;

    const cartesiaRes = await fetch("https://api.cartesia.ai/tts/sse", {
      method: "POST",
      headers: {
        "Authorization":    `Bearer ${process.env.CARTESIA_API_KEY}`,
        "Cartesia-Version": "2024-06-10",
        "Content-Type":     "application/json",
      },
      body: JSON.stringify({
        model_id:      "sonic-2",
        transcript:    text,
        voice:         { mode: "id", id: voiceId },
        output_format: { container: "raw", encoding: "pcm_f32le", sample_rate: 22050 },
        stream:        true,
      }),
      signal: req.signal,
    });

    if (!cartesiaRes.ok) {
      const err = await cartesiaRes.text().catch(() => "");
      console.error(`[TTS] Cartesia ${cartesiaRes.status}:`, err.slice(0, 200));
      return new Response("TTS upstream error", { status: 502 });
    }

    // Proxy the Cartesia SSE stream straight to the client.
    // Each event: data: {"type":"chunk","data":"<base64_pcm_f32le>"}
    // Final event: data: {"type":"done"}
    const encoder = new TextEncoder();
    const body2   = cartesiaRes.body!;

    const readable = new ReadableStream({
      async start(controller) {
        const reader  = body2.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              controller.enqueue(encoder.encode(line + "\n\n"));
            }
          }
          controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'));
          controller.close();
        } catch (err: unknown) {
          if ((err as { name?: string }).name !== "AbortError") console.error("[TTS]", err);
          try { controller.close(); } catch { /* already closed */ }
        } finally {
          reader.cancel().catch(() => {});
        }
      },
      cancel() { body2.cancel().catch(() => {}); },
    });

    return new Response(readable, {
      headers: {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
      },
    });
  } catch (err) {
    console.error("[TTS]", err);
    return new Response("Internal server error", { status: 500 });
  }
}
