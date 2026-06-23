// Best-effort STT (Deepgram) warm-up.
//
// Tap-mode STT (/api/aida/stt -> Deepgram) cold-starts on the first
// transcription. Posting a tiny VALID silent WAV on mount pre-warms the
// serverless function AND Deepgram so the first real tap is fast.
//
// IMPORTANT: /api/aida/stt reads the RAW request body bytes (req.arrayBuffer())
// and short-circuits on an EMPTY body without calling Deepgram. So we must send
// real, non-empty WAV bytes (not a data-URL string) for the warm-up to actually
// reach Deepgram. Fire-and-forget; errors swallowed; deduped per page load.

let sttWarmed = false;

// 16-bit mono PCM WAV of `ms` milliseconds of silence at `rate` Hz.
function silentWav(ms = 50, rate = 16000): ArrayBuffer {
  const samples = Math.round((rate * ms) / 1000);
  const dataLen = samples * 2; // 16-bit mono
  const buf = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(buf);
  const put = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i));
  };
  put(0, "RIFF");
  dv.setUint32(4, 36 + dataLen, true);
  put(8, "WAVE");
  put(12, "fmt ");
  dv.setUint32(16, 16, true); // fmt chunk size
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, 1, true); // mono
  dv.setUint32(24, rate, true);
  dv.setUint32(28, rate * 2, true); // byte rate
  dv.setUint16(32, 2, true); // block align
  dv.setUint16(34, 16, true); // bits per sample
  put(36, "data");
  dv.setUint32(40, dataLen, true);
  return buf; // samples already zeroed = silence; ArrayBuffer is a valid BlobPart
}

export function warmStt(): void {
  if (typeof window === "undefined" || sttWarmed) return;
  sttWarmed = true;
  try {
    const blob = new Blob([silentWav()], { type: "audio/wav" });
    fetch("/api/aida/stt", {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: blob,
      keepalive: true,
    }).catch(() => {
      /* best-effort warm-up — ignore failures */
    });
  } catch {
    /* best-effort — never throw */
  }
}

// Optional: warm the realtime live-voice token route (cheap GET).
let liveTokenWarmed = false;
export function warmLiveToken(): void {
  if (typeof window === "undefined" || liveTokenWarmed) return;
  liveTokenWarmed = true;
  fetch("/api/aida/stt-token").catch(() => {
    /* best-effort warm-up — ignore failures */
  });
}
