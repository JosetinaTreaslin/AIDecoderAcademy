import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

// Karaoke TTS — returns the full audio for one line PLUS per-word timings so
// the client can reveal/highlight text word-by-word in sync with playback.
// Uses ElevenLabs /with-timestamps (single JSON response, not streamed).
//
// AIDA and SAGE call this per sentence. Same voices/model as /api/aida/tts.

const AIDA_VOICE_ID      = process.env.ELEVENLABS_AIDA_VOICE_ID    ?? "AZnzlk1XvdvUeBnXmlld";
const TEACHER_VOICE_ID   = process.env.ELEVENLABS_TEACHER_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb";
const CLASSROOM_VOICE_ID = process.env.ELEVENLABS_CLASSROOM_VOICE_ID ?? "1qEiC6qsybMkmnNdVMbK";

const ELEVENLABS_MODEL = "eleven_turbo_v2_5";

const VOICE_SETTINGS = {
  aida:      { stability: 0.4,  similarity_boost: 0.7,  style: 0.3,  use_speaker_boost: true },
  teacher:   { stability: 0.65, similarity_boost: 0.8,  style: 0.15, use_speaker_boost: true },
  classroom: { stability: 0.55, similarity_boost: 0.85, style: 0.25, use_speaker_boost: true },
} as const;

interface WordTiming { text: string; start: number; end: number; }

interface CharAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

// Group ElevenLabs character alignment into word timings (whitespace = boundary).
function groupCharsToWords(a: CharAlignment): WordTiming[] {
  const words: WordTiming[] = [];
  let buf = "", start = 0, end = 0;
  const flush = () => { if (buf.length > 0) { words.push({ text: buf, start, end }); buf = ""; } };
  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i];
    if (/\s/.test(ch)) { flush(); continue; }
    if (buf.length === 0) start = a.character_start_times_seconds[i];
    buf += ch;
    end = a.character_end_times_seconds[i];
  }
  flush();
  return words;
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return new Response("Unauthorized", { status: 401 });

    let body: { text?: string; role?: string } = {};
    try { body = await req.json(); } catch { /* fall through */ }
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const role = body?.role as "aida" | "teacher" | "classroom" | undefined;
    if (!text) return new Response("Bad request", { status: 400 });

    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("[AIDA TTS-TIMED] ELEVENLABS_API_KEY is not set");
      return new Response("TTS not configured", { status: 503 });
    }

    const voiceId =
      role === "teacher"   ? TEACHER_VOICE_ID :
      role === "classroom" ? CLASSROOM_VOICE_ID :
                             AIDA_VOICE_ID;
    const voiceSettings =
      role === "teacher"   ? VOICE_SETTINGS.teacher :
      role === "classroom" ? VOICE_SETTINGS.classroom :
                             VOICE_SETTINGS.aida;

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method:  "POST",
        signal:  req.signal,
        headers: {
          "xi-api-key":   process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept":       "application/json",
        },
        body: JSON.stringify({
          text:           text.slice(0, 4096),
          model_id:       ELEVENLABS_MODEL,
          voice_settings: voiceSettings,
        }),
      },
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[AIDA TTS-TIMED] ElevenLabs", res.status, errText.slice(0, 300));
      return new Response(
        JSON.stringify({ error: "TTS failed", status: res.status, detail: errText.slice(0, 300) }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const json = (await res.json()) as { audio_base64?: string; alignment?: CharAlignment | null };
    const words = json.alignment ? groupCharsToWords(json.alignment) : [];

    return new Response(
      JSON.stringify({ audioBase64: json.audio_base64 ?? "", words }),
      { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    console.error("[AIDA TTS-TIMED]", err);
    return new Response("Internal server error", { status: 500 });
  }
}
