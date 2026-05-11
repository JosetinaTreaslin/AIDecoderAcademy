"use client";

import {
  createContext, useContext, useMemo, useState,
  type Dispatch, type ReactNode, type SetStateAction,
} from "react";
import type { Message } from "@/components/playground/useChat";

// ── public types ────────────────────────────────────────────────────────────

export interface WhiteboardSnapshot {
  messages: Message[];
}

export type ValidatorTier = "distinction" | "merit" | "pass" | "fail";
export type ValidatorMode = "challenge" | "nudge" | "celebrate";

export interface ValidatorPublicState {
  lmsId:       string | null;
  lastTier:    ValidatorTier | null;
  lastMode:    ValidatorMode | null;
  lastSummary: string | null;
  attempts:    { count: number; lastAt: string | null };
}

export interface WorksheetSnapshot {
  lmsId:     string | null;
  data:      Record<string, string | boolean>;
  updatedAt: string | null;
  status:    "idle" | "saving" | "saved" | "error";
}

// ── context shape ───────────────────────────────────────────────────────────
// We expose the React setState setters directly. They're stable across
// renders by definition (useState guarantees this), so consumers can put
// the writer hooks in dep arrays without triggering re-render loops.

interface ChannelsCtx {
  whiteboard:    WhiteboardSnapshot;
  setWhiteboard: Dispatch<SetStateAction<WhiteboardSnapshot>>;
  validator:     ValidatorPublicState;
  setValidator:  Dispatch<SetStateAction<ValidatorPublicState>>;
  worksheet:     WorksheetSnapshot;
  setWorksheet:  Dispatch<SetStateAction<WorksheetSnapshot>>;
}

const EMPTY_VALIDATOR: ValidatorPublicState = {
  lmsId: null, lastTier: null, lastMode: null, lastSummary: null,
  attempts: { count: 0, lastAt: null },
};
const EMPTY_WORKSHEET: WorksheetSnapshot = {
  lmsId: null, data: {}, updatedAt: null, status: "idle",
};

const Ctx = createContext<ChannelsCtx | null>(null);

export function ChatChannelsProvider({ children }: { children: ReactNode }) {
  const [whiteboard, setWhiteboard] = useState<WhiteboardSnapshot>({ messages: [] });
  const [validator,  setValidator]  = useState<ValidatorPublicState>(EMPTY_VALIDATOR);
  const [worksheet,  setWorksheet]  = useState<WorksheetSnapshot>(EMPTY_WORKSHEET);

  // The setter references are stable (React useState guarantees this) so
  // the value's identity changes only when one of the snapshots changes.
  // That's still per-update, but consumers no longer build their own
  // useCallback over `value`, so it doesn't matter for hook stability.
  const value = useMemo<ChannelsCtx>(() => ({
    whiteboard, setWhiteboard,
    validator,  setValidator,
    worksheet,  setWorksheet,
  }), [whiteboard, validator, worksheet]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useCtx(name: string): ChannelsCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error(`${name} must be used inside <ChatChannelsProvider>`);
  return v;
}

// ── writers ─────────────────────────────────────────────────────────────────
// Each writer hook destructures only the STABLE setter. The returned object
// is `useMemo([setter])` — stable for the lifetime of the provider, so it
// can safely sit in consumer effect dep arrays.

export function useWhiteboardWriter() {
  const { setWhiteboard } = useCtx("useWhiteboardWriter");
  return useMemo(() => ({
    setAll: (messages: Message[]) => setWhiteboard({ messages }),
    reset:  ()                    => setWhiteboard({ messages: [] }),
  }), [setWhiteboard]);
}

export function useValidatorWriter() {
  const { setValidator } = useCtx("useValidatorWriter");
  return useMemo(() => ({
    setLast: (s: ValidatorPublicState) => setValidator(s),
  }), [setValidator]);
}

export function useWorksheetWriter() {
  const { setWorksheet } = useCtx("useWorksheetWriter");
  return useMemo(() => ({
    setDraft: (lmsId: string, data: Record<string, string | boolean>) =>
      setWorksheet({ lmsId, data, updatedAt: new Date().toISOString(), status: "saved" }),
    // Functional update — doesn't capture worksheet state in closure, so
    // the function reference stays stable.
    setStatus: (status: WorksheetSnapshot["status"]) =>
      setWorksheet(prev => ({ ...prev, status })),
    clear: () => setWorksheet(EMPTY_WORKSHEET),
  }), [setWorksheet]);
}

// ── readers ─────────────────────────────────────────────────────────────────

export function useWhiteboardReader(): WhiteboardSnapshot {
  return useCtx("useWhiteboardReader").whiteboard;
}
export function useValidatorReader(): ValidatorPublicState {
  return useCtx("useValidatorReader").validator;
}
export function useWorksheetReader(): WorksheetSnapshot {
  return useCtx("useWorksheetReader").worksheet;
}
