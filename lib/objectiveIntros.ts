// Validator intro copy — fired once per session when the kid arrives at a
// staged objective. Voice = "Sage" — warm coach with weight. Punchy short
// beats, motivating, no emojis, no "wrong". Confident but human.
//
// The intro is now a SEQUENCE OF BEATS rather than one block of text. The
// panel reveals one beat at a time with a 600ms pause between beats so each
// line lands separately. This is the JRPG dialogue rhythm — short, paced,
// memorable. Designed for an 11–16 year old's 8-second relevance filter:
// beat 1 must hook in 5 words or fewer, beat 2 introduces a paradox or
// insight, beat 3 is the invitation (not an instruction).
//
// The structure also enables prompt-steerable TTS providers (OpenAI
// gpt-4o-mini-tts, Cartesia Sonic, Hume Octave) to deliver each beat with
// the right tone — see the `tone` field. Providers that don't support
// per-utterance steering will simply ignore it.

export interface ObjectiveIntroBeat {
  /** Spoken line. Keep under 12 words when possible. Ellipsis (…) creates a breath. */
  text: string;
  /**
   * Optional tone hint for steerable TTS providers. Plain English — not an
   * audio tag. Examples: "curious and warm", "softly amused", "dry, knowing".
   * Falls through unused for non-steerable providers.
   */
  tone?: string;
}

export interface ObjectiveIntro {
  /** Sequence of short beats spoken with brief pauses between each. */
  beats: ObjectiveIntroBeat[];
}

const INTROS: Record<string, ObjectiveIntro> = {
  "l1-10": {
    beats: [
      { text: "Three panels. One punchline.",                                 tone: "curious and quietly amused, like setting up a challenge you secretly hope they'll meet" },
      { text: "Most people overthink panel one. Don't. It's just setup.",     tone: "dry, knowing — sharing a small insight, almost a confession" },
      { text: "When it's ready… show me what you've got.",                    tone: "warm and inviting, with a soft pause before the call to action" },
    ],
  },

  "l1-06": {
    beats: [
      { text: "Your avatar is going to represent you. For the next six levels.", tone: "calm, slightly weighty — naming what's at stake without scaring them" },
      { text: "A vague brief makes a generic face. A real brief makes your face.", tone: "matter-of-fact, like a coach stating a rule of the craft" },
      { text: "Fill the worksheet… record three lines… then show me.",            tone: "soft and patient, almost a quiet checklist" },
    ],
  },
};

export function getObjectiveIntro(lmsId: string): ObjectiveIntro | null {
  return INTROS[lmsId] ?? null;
}

/**
 * Convenience helper: legacy callsites that still expect a single
 * concatenated greeting line can use this. Returns the joined beats with
 * normal spacing. New callsites should use `intro.beats` directly so each
 * line gets its own typewriter reveal + pause.
 */
export function joinIntroBeats(intro: ObjectiveIntro): string {
  return intro.beats.map(b => b.text).join(" ");
}
