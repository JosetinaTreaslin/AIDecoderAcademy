import type { Segment } from "@/lib/podcastEpisode";

export type Phase = "episode" | "interrupting" | "interjection" | "finished";

export interface StageState {
  episode: Segment[];
  index: number;
  phase: Phase;
  resumeIndex: number;
  interjection: Segment[];
  interIndex: number;
}

export type StageAction =
  | { type: "ended" }
  | { type: "interrupt" }
  | { type: "interjection"; segments: Segment[] }
  | { type: "cancelInterrupt" }
  | { type: "seek"; index: number };

export function initialStage(episode: Segment[]): StageState {
  return { episode, index: 0, phase: "episode", resumeIndex: 0, interjection: [], interIndex: 0 };
}

export function currentSegment(s: StageState): Segment | null {
  if (s.phase === "interjection") return s.interjection[s.interIndex] ?? null;
  if (s.phase === "episode") return s.episode[s.index] ?? null;
  return null;
}

export function stageReducer(s: StageState, a: StageAction): StageState {
  switch (a.type) {
    case "interrupt":
      return { ...s, phase: "interrupting", resumeIndex: s.index };
    case "cancelInterrupt":
      return { ...s, phase: "episode" };
    case "seek": {
      // Line-based skip: jump to a clamped episode index, leave any interjection.
      const max = s.episode.length - 1;
      const index = Math.max(0, Math.min(max, a.index));
      return { ...s, phase: "episode", index, interjection: [], interIndex: 0 };
    }
    case "interjection":
      return { ...s, phase: "interjection", interjection: a.segments, interIndex: 0 };
    case "ended": {
      if (s.phase === "interjection") {
        if (s.interIndex < s.interjection.length - 1) return { ...s, interIndex: s.interIndex + 1 };
        return { ...s, phase: "episode", index: s.resumeIndex, interjection: [], interIndex: 0 };
      }
      if (s.phase === "episode") {
        if (s.index < s.episode.length - 1) return { ...s, index: s.index + 1 };
        return { ...s, phase: "finished" };
      }
      return s;
    }
    default:
      return s;
  }
}
