// Declarative form schema for staged-rubric worksheets (OBJ 10, OBJ 6).
//
// The WorksheetPopup component renders these schemas straight to UI. The
// validator routes (api/aida/validate/obj10, api/aida/validate/obj6) read
// the same field ids when extracting an inline-form payload.
//
// Field ids are STABLE — they're persisted to localStorage drafts and
// referenced by the inline-form extractors. Renaming an id is a breaking
// change for any kid mid-objective.

export type WorksheetField =
  | { kind: "text";     id: string; label: string; help?: string; weakEx?: string; strongEx?: string; minWords?: number }
  | { kind: "longtext"; id: string; label: string; help?: string; weakEx?: string; strongEx?: string; minWords?: number; rows?: number }
  | { kind: "yesno";    id: string; label: string; help?: string };

export interface WorksheetSection {
  id:        string;
  title:     string;
  subtitle?: string;
  fields:    WorksheetField[];
}

export interface WorksheetSchema {
  lmsId:    string;       // canonical, e.g. "l1-10"
  legacyId: string;       // arena-room id, e.g. "a1-10"
  title:    string;
  intro:    string;       // short instructions
  sections: WorksheetSection[];
}

export const OBJ10_SCHEMA: WorksheetSchema = {
  lmsId:    "l1-10",
  legacyId: "a1-10",
  title:    "OBJ 10 — Your First AI Comic Strip",
  intro:    "Plan the comic before you generate. The validator reads this directly.",
  sections: [
    {
      id: "header", title: "Header",
      fields: [
        { kind: "text", id: "avatarName", label: "Avatar Name" },
        { kind: "text", id: "date",       label: "Date" },
      ],
    },
    {
      id: "thinkIt", title: "Think It Canvas",
      subtitle: "All four fields. Be specific. Audience-centred.",
      fields: [
        {
          kind: "longtext", id: "intent", label: "🎯 Intent — what reaction at panel 3?",
          weakEx: "To make a funny comic.",
          strongEx: "To make someone laugh so hard at panel 3 that they screenshot it and send it to their group chat.",
          rows: 3, minWords: 10,
        },
        {
          kind: "longtext", id: "assumptions", label: "🔍 Assumptions — name two you have not tested",
          weakEx: "I assume it will be funny.",
          strongEx: "I assume the joke lands in panel 3 — but I haven't checked whether panels 1 and 2 build enough tension.",
          rows: 3, minWords: 10,
        },
        {
          kind: "longtext", id: "audience", label: "👥 Audience — one specific person, one specific humour",
          weakEx: "My friends.",
          strongEx: "My 14-year-old classmate who laughs hardest when something ordinary goes catastrophically wrong.",
          rows: 3, minWords: 10,
        },
        {
          kind: "longtext", id: "success", label: "✅ Success — observable behaviour, not a feeling",
          weakEx: "If people like it.",
          strongEx: "If someone tags a friend in the comments without being prompted.",
          rows: 3, minWords: 10,
        },
      ],
    },
    {
      id: "storyIt", title: "Story It",
      subtitle: "Plan all three panels before you open Canva.",
      fields: [
        { kind: "longtext", id: "oneSentenceStory", label: "One-sentence story (setup + twist + payoff)", rows: 2, minWords: 8 },
        { kind: "longtext", id: "panel1Image",      label: "Panel 1 — image prompt", rows: 2, minWords: 8 },
        { kind: "text",     id: "panel1Dialogue",   label: "Panel 1 — dialogue / caption" },
        { kind: "longtext", id: "panel2Image",      label: "Panel 2 — image prompt", rows: 2, minWords: 8 },
        { kind: "text",     id: "panel2Dialogue",   label: "Panel 2 — dialogue / caption" },
        { kind: "longtext", id: "panel3Image",      label: "Panel 3 — image prompt (PUNCHLINE)", rows: 2, minWords: 8 },
        { kind: "text",     id: "panel3Dialogue",   label: "Panel 3 — dialogue / caption (most important line)" },
        { kind: "yesno",    id: "funnyTestPassed",  label: "Funny Test — does Panel 3 make you react?" },
      ],
    },
    {
      id: "reflection", title: "Assumption Reflection (after creating)",
      fields: [
        { kind: "longtext", id: "heldAssumption",   label: "Which assumption held true?", rows: 2 },
        { kind: "longtext", id: "brokenAssumption", label: "Which assumption was wrong — and what happened?", rows: 2 },
      ],
    },
  ],
};

export const OBJ6_SCHEMA: WorksheetSchema = {
  lmsId:    "l1-06",
  legacyId: "a1-6",
  title:    "OBJ 6 — Build Your AI Academy Avatar",
  intro:    "Design the avatar before opening HeyGen. This identity persists for 6 levels.",
  sections: [
    {
      id: "header", title: "Header",
      fields: [
        { kind: "text",  id: "avatarName",   label: "Avatar Name" },
        { kind: "text",  id: "date",         label: "Date" },
        { kind: "yesno", id: "obj5Complete", label: "OBJ 5 (Theme Song) complete?" },
      ],
    },
    {
      id: "thinkIt", title: "Think It Canvas",
      subtitle: "Highest threshold of Level 1 — 70%. Audience-centred answers only.",
      fields: [
        {
          kind: "longtext", id: "intent", label: "🎯 Intent — what impression before a word is spoken?",
          weakEx: "To create my avatar.",
          strongEx: "To design a presenter classmates immediately want to listen to before a single word.",
          rows: 3, minWords: 10,
        },
        { kind: "longtext", id: "assumptions", label: "🔍 Assumptions — what are you betting on?", rows: 3, minWords: 10 },
        { kind: "longtext", id: "audience",    label: "👥 Audience — specific people, specific reaction", rows: 3, minWords: 10 },
        {
          kind: "longtext", id: "success", label: "✅ Success — what they'd say or do",
          weakEx: "If it looks good.",
          strongEx: "If a peer watched 10 seconds with no sound and thought 'I want to hear this person'.",
          rows: 3, minWords: 10,
        },
      ],
    },
    {
      id: "identityCard", title: "Avatar Identity Card",
      subtitle: "All six. Do not open HeyGen before this is done.",
      fields: [
        { kind: "longtext", id: "appearance",        label: "Appearance — 40+ words: age, clothing, expression, setting", rows: 4, minWords: 40 },
        { kind: "longtext", id: "voiceCharacter",    label: "Voice character — one specific quality (not 'clear')",        rows: 2, minWords: 6 },
        { kind: "longtext", id: "personalityTraits", label: "Personality traits — at least one behavioural description",   rows: 3, minWords: 10 },
        { kind: "longtext", id: "presentationStyle", label: "Presentation style — energy, pacing, posture",                 rows: 2, minWords: 8 },
        { kind: "yesno",    id: "scriptConfirmed",   label: "I will deliver the three required script lines verbatim" },
        { kind: "longtext", id: "successTest",       label: "Success test — what would your audience say or do?",          rows: 2, minWords: 8 },
      ],
    },
    {
      id: "reflection", title: "Reflection (after recording)",
      fields: [
        { kind: "longtext", id: "intentionalOutcome",   label: "What turned out as intended?", rows: 2 },
        { kind: "longtext", id: "unintentionalOutcome", label: "What surprised you?",          rows: 2 },
      ],
    },
  ],
};

export function getWorksheetSchema(lmsIdOrLegacy: string): WorksheetSchema | null {
  const id = lmsIdOrLegacy.toLowerCase();
  if (id === "l1-10" || id === "a1-10") return OBJ10_SCHEMA;
  if (id === "l1-06" || id === "a1-6")  return OBJ6_SCHEMA;
  return null;
}
