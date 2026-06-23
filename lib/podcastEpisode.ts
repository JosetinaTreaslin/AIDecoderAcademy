import { synthLine, mergeMp3, uploadAudio, type VoiceSpec } from "@/lib/classroomAudio";
import { HOST_VOICE, type PodcastPersona } from "@/lib/podcastPersonas";

export interface Turn { speaker: "host" | "guest"; text: string; }
export interface Segment { speaker: "host" | "guest"; text: string; audioUrl: string; }

const BATCH = 4;

// Podcast lines render on Turbo v2.5 — far lower latency than multilingual_v2
// while keeping enough expressiveness for kids. Audio Overview and every other
// synthLine caller keep synthLine's own multilingual_v2 default.
export const PODCAST_TTS_MODEL = "eleven_turbo_v2_5";

function voiceFor(speaker: "host" | "guest", persona: PodcastPersona): VoiceSpec {
  return speaker === "host" ? HOST_VOICE : persona.voice;
}

// Core synthesis: returns ordered segments AND the raw MP3 buffers, so callers
// that need a merged track (synthesizeEpisode) don't re-download every segment.
async function synthSegments(
  turns: Turn[],
  persona: PodcastPersona,
  userId: string,
  keyPrefix: string,
  model: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ segments: Segment[]; buffers: Buffer[] }> {
  const stamp = Date.now();
  const segments: Segment[] = new Array(turns.length);
  const buffers: Buffer[] = new Array(turns.length);
  let done = 0;
  const tStart = Date.now();
  for (let i = 0; i < turns.length; i += BATCH) {
    const slice = turns.slice(i, i + BATCH);
    await Promise.all(
      slice.map(async (t, j) => {
        const idx = i + j;
        const tLine = Date.now();
        const buf = await synthLine(t.text, voiceFor(t.speaker, persona), model);
        console.log(`[podcast-timing] TTS line ${idx} (${t.speaker}): ${Date.now() - tLine}ms`);
        const url = await uploadAudio(buf, `${keyPrefix}/${userId}/${stamp}/line-${idx}.mp3`);
        segments[idx] = { speaker: t.speaker, text: t.text, audioUrl: url };
        buffers[idx] = buf;
        onProgress?.(++done, turns.length);
      }),
    );
  }
  console.log(`[podcast-timing] TTS total (${turns.length} lines): ${Date.now() - tStart}ms`);
  return { segments, buffers };
}

/** Synthesize each turn, upload individually, return ordered segments.
 *  onProgress fires after each line finishes (for live loading progress). */
export async function synthesizeTurns(
  turns: Turn[],
  persona: PodcastPersona,
  userId: string,
  keyPrefix = "podcast",
  onProgress?: (done: number, total: number) => void,
  model: string = PODCAST_TTS_MODEL,
): Promise<Segment[]> {
  return (await synthSegments(turns, persona, userId, keyPrefix, model, onProgress)).segments;
}

/** Full episode: per-line segments PLUS a merged track for save/download. */
export async function synthesizeEpisode(
  turns: Turn[],
  persona: PodcastPersona,
  userId: string,
  onProgress?: (done: number, total: number) => void,
  model: string = PODCAST_TTS_MODEL,
): Promise<{ segments: Segment[]; audioUrl: string }> {
  const { segments, buffers } = await synthSegments(turns, persona, userId, "podcast", model, onProgress);
  // Merge the in-memory buffers directly — no second network round-trip to
  // re-download what we just synthesized.
  const tMerge = Date.now();
  const merged = mergeMp3(buffers);
  const audioUrl = await uploadAudio(merged, `podcast/${userId}/${Date.now()}-full.mp3`);
  console.log(`[podcast-timing] merge+upload: ${Date.now() - tMerge}ms`);
  return { segments, audioUrl };
}
