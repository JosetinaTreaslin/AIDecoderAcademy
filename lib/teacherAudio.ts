// Streaming TTS helper for the Validator Teacher.
// Calls /api/aida/tts and plays back the SSE-streamed MP3 chunks in order.
//
// Exposes a `progress01()` callback so the UI can sync a typewriter to the
// actual audio progress instead of running on a fixed timer.

export interface SpeakHandle {
  cancel:     () => void;
  progress01: () => number; // 0 → 1, based on audio currentTime across queued chunks
  // Optional readiness signals (timed variant): lets the typewriter hold text
  // until audio actually starts, and only fast-reveal if the audio failed.
  failed?:    () => boolean;
  started?:   () => boolean;
  done?:      () => boolean; // audio finished playing (or failed)
  // Word-boundary reveal (timed variant): number of characters to show, snapped
  // to the last word whose audio timestamp has been reached. Mirrors AIDA's
  // working karaoke (reads currentTime directly — no gating). Returns -1 if
  // word timings aren't available so the caller can fall back to progress01.
  spokenChars?: () => number;
}

export async function speakAsTeacher(text: string): Promise<SpeakHandle> {
  return speak(text, "teacher");
}

export async function speakAsAida(text: string): Promise<SpeakHandle> {
  return speak(text, "aida");
}

// Word-synced variant: fetches /api/aida/tts-timed (full audio + per-word
// timings) and exposes progress01() driven by the actual spoken word boundary,
// so a typewriter reveals text word-by-word exactly as it is spoken.
export function speakAsTeacherTimed(text: string): SpeakHandle {
  return speakTimed(text, "teacher");
}

export function speakAsAidaTimed(text: string): SpeakHandle {
  return speakTimed(text, "aida");
}

export function speakAsClassroomTimed(text: string): SpeakHandle {
  return speakTimed(text, "classroom");
}

function speakTimed(text: string, role: "teacher" | "aida" | "classroom"): SpeakHandle {
  const controller = new AbortController();
  let cancelled = false;
  let audio: HTMLAudioElement | null = null;
  let url: string | null = null;
  let words: { text: string; start: number; end: number }[] = [];
  let done = false;
  let failed = false;
  let started = false; // audio element created and play() resolved/began

  const cancel = () => {
    cancelled = true;
    controller.abort();
    if (audio) { try { audio.pause(); } catch { /* ok */ } }
    if (url) { try { URL.revokeObjectURL(url); } catch { /* ok */ } }
    audio = null;
  };

  const progress01 = (): number => {
    if (!audio) return 0;
    const t = audio.currentTime;
    const lastEnd = words.length > 0
      ? words[words.length - 1].end
      : (audio.duration && isFinite(audio.duration) ? audio.duration : 0);
    if (lastEnd <= 0) return 0;
    const ratio = t / lastEnd;
    return done ? Math.min(1, ratio) : Math.min(0.99, ratio);
  };

  // Word-boundary char count, read straight off currentTime.
  const spokenChars = (): number => {
    if (words.length === 0) return -1; // no timings → caller uses progress01
    if (!audio) return 0;
    if (done) return words.map(w => w.text).join(" ").length; // full at end
    const t = audio.currentTime;
    // CRITICAL: reveal NOTHING until audio is actually advancing. The audio
    // element exists (and currentTime reads 0) for a real interval while a long
    // base64 MP3 buffers before play() produces sound. Revealing at t===0 makes
    // the first word(s) appear before any audio — the "words come first" bug.
    // Gating on t>0 means text only ever tracks real playback position.
    if (t <= 0) return 0;
    let active = -1;
    for (let i = 0; i < words.length; i++) {
      if (words[i].start <= t) active = i; else break;
    }
    if (active < 0) return 0;
    // chars of words[0..active] joined with single spaces (matches display text)
    let n = active; // spaces between revealed words
    for (let i = 0; i <= active; i++) n += words[i].text.length;
    return n;
  };

  (async () => {
    try {
      const res = await fetch("/api/aida/tts-timed", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, role }),
        signal:  controller.signal,
      });
      if (cancelled) { done = true; return; }
      if (!res.ok) { failed = true; done = true; return; }
      const data = await res.json() as {
        audioBase64?: string;
        words?: { text: string; start: number; end: number }[];
      };
      if (cancelled) { done = true; return; }
      if (!data.audioBase64) { failed = true; done = true; return; }

      words = data.words ?? [];

      const bin = atob(data.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      url = URL.createObjectURL(blob);
      audio = new Audio(url);
      audio.onended = () => { done = true; };
      audio.onerror = () => { failed = true; done = true; };
      audio.onplaying = () => { started = true; };
      await audio.play().then(() => { started = true; }).catch(() => { failed = true; done = true; });
    } catch (err) {
      failed = true;
      done = true;
      if ((err as Error)?.name !== "AbortError") console.error("[teacherAudio timed]", err);
    }
  })();

  return { cancel, progress01, spokenChars, failed: () => failed, started: () => started, done: () => done };
}

async function speak(text: string, role: "teacher" | "aida"): Promise<SpeakHandle> {
  const controller = new AbortController();

  // Each queue item carries its audio + estimated weight (we use chunk byte
  // size as a proxy for duration before metadata loads, then swap to real
  // duration once we know it).
  type Item = {
    audio:     HTMLAudioElement;
    url:       string;
    bytes:     number;
    duration:  number; // seconds; 0 until metadata loads
    finished:  boolean;
    isPlaying: boolean;
  };

  const queue: Item[] = [];
  let cancelled = false;
  let started   = false;
  let streamDone = false; // server sent [DONE]

  const cancel = () => {
    cancelled = true;
    controller.abort();
    for (const it of queue) {
      try { it.audio.pause(); } catch { /* ok */ }
      try { URL.revokeObjectURL(it.url); } catch { /* ok */ }
    }
    queue.length = 0;
  };

  // Progress: weight by duration (or bytes as fallback before metadata loads).
  // For the currently-playing item, use its currentTime fraction.
  const progress01 = (): number => {
    if (queue.length === 0) return streamDone ? 1 : 0;

    // Total weight across known items. If stream isn't done we don't know
    // the final total — assume the queue we have is a lower bound and cap
    // progress at 0.95 so the typewriter doesn't run past audio.
    let totalWeight   = 0;
    let elapsedWeight = 0;
    for (const it of queue) {
      const w = it.duration > 0 ? it.duration : it.bytes / 16000; // ~128kbps fallback
      totalWeight += w;
      if (it.finished) {
        elapsedWeight += w;
      } else if (it.isPlaying) {
        const t = it.audio.currentTime || 0;
        const d = it.audio.duration && isFinite(it.audio.duration) ? it.audio.duration : w;
        elapsedWeight += Math.min(t, d);
      }
    }
    if (totalWeight === 0) return 0;
    const ratio = elapsedWeight / totalWeight;
    return streamDone ? Math.min(1, ratio) : Math.min(0.95, ratio);
  };

  const playFrom = (idx: number) => {
    if (cancelled) return;
    const it = queue[idx];
    if (!it) return;

    it.isPlaying = true;
    let advanced = false;
    const advance = () => {
      if (advanced) return;
      advanced = true;
      it.finished  = true;
      it.isPlaying = false;
      try { URL.revokeObjectURL(it.url); } catch { /* ok */ }
      playFrom(idx + 1);
    };

    it.audio.onloadedmetadata = () => {
      if (it.audio.duration && isFinite(it.audio.duration)) it.duration = it.audio.duration;
    };
    it.audio.onended = advance;
    it.audio.onerror = advance;
    it.audio.play().catch(advance);
  };

  // Kick off fetch — runs in parallel with the returned handle.
  (async () => {
    try {
      const res = await fetch("/api/aida/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ text, role }),
        signal:  controller.signal,
      });
      if (!res.ok || !res.body) {
        console.warn("[teacherAudio] tts route returned", res.status);
        streamDone = true;
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done || cancelled) break;
        buf += decoder.decode(value, { stream: true });

        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") { streamDone = true; continue; }

          const bin = atob(data);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const blob  = new Blob([bytes], { type: "audio/mpeg" });
          const url   = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.preload = "auto";
          const item: Item = {
            audio,
            url,
            bytes:     bin.length,
            duration:  0,
            finished:  false,
            isPlaying: false,
          };
          const idx = queue.length;
          queue.push(item);
          if (!started) { started = true; playFrom(idx); }
        }
      }
      streamDone = true;
    } catch (err) {
      streamDone = true;
      if ((err as Error)?.name === "AbortError") return;
      console.error("[teacherAudio]", err);
    }
  })();

  return { cancel, progress01 };
}
