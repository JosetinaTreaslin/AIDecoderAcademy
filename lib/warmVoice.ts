// Best-effort TTS warm-up for ElevenLabs.
//
// /api/aida/tts-timed (ElevenLabs /with-timestamps) cold-starts on the first
// call per page load. Firing "hello" on mount pre-pays that cost. Voices are
// per-role so we warm each role a surface will use.
//
// /api/aida/tts now routes to Cartesia, which does not have the same cold-start
// behaviour, so we never warm it up here.
//
// Everything is fire-and-forget and swallows errors. A module-level Set dedupes
// (endpoint, role) pairs so it never double-spends within a page load.

export type Role = "aida" | "teacher" | "classroom";

const warmed = new Set<string>();

export function warmVoice(
  roles: Role[],
  opts: { timed?: boolean } = {},
): void {
  if (typeof window === "undefined") return;
  const { timed = true } = opts;

  const endpoints: string[] = [];
  if (timed) endpoints.push("/api/aida/tts-timed");

  for (const role of roles) {
    for (const ep of endpoints) {
      const key = `${ep}:${role}`;
      if (warmed.has(key)) continue;
      warmed.add(key);
      fetch(ep, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "hello", role }),
        keepalive: true,
      }).catch(() => { /* best-effort — ignore failures */ });
    }
  }
}
