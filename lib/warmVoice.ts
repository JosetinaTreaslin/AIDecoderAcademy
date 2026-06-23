// Best-effort TTS warm-up.
//
// The first ElevenLabs call per page load cold-starts (~5s). Firing a tiny "."
// synth on mount pre-pays that cost so the first REAL utterance plays instantly.
//
// Why both endpoints: /api/aida/tts (ElevenLabs /stream) and /api/aida/tts-timed
// (ElevenLabs /with-timestamps, the karaoke path) are SEPARATE serverless
// functions with their own cold start, so we warm both. Voices are per-role
// (aida / teacher / classroom) and ElevenLabs warmth can be per-voice, so we
// warm each role a surface will actually use.
//
// Everything here is fire-and-forget and swallows errors — it can never affect
// rendering or block the UI. A module-level Set dedupes (endpoint, role) pairs
// so it never double-spends within a page load.

export type Role = "aida" | "teacher" | "classroom";

const warmed = new Set<string>();

export function warmVoice(
  roles: Role[],
  opts: { stream?: boolean; timed?: boolean } = {},
): void {
  if (typeof window === "undefined") return; // client-only; effects never run on server anyway
  const { stream = true, timed = true } = opts;

  const endpoints: string[] = [];
  if (stream) endpoints.push("/api/aida/tts");
  if (timed) endpoints.push("/api/aida/tts-timed");

  for (const role of roles) {
    for (const ep of endpoints) {
      const key = `${ep}:${role}`;
      if (warmed.has(key)) continue;
      warmed.add(key);
      fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ".", role }),
        keepalive: true,
      }).catch(() => {
        /* best-effort warm-up — ignore failures */
      });
    }
  }
}
