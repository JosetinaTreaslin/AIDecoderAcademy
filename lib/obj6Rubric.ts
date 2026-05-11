// OBJ 6 — Build Your AI Academy Avatar.
//
// Mirrors lib/obj10Rubric.ts but the Create-It artefact is a HeyGen MP4 URL,
// graded by Whisper transcription + GPT script-line presence (not vision).
// Canvas threshold is 70% — the highest in Level 1.

import type { WorksheetUpload, CanvasMode, StagedRubric } from "@/lib/obj10Rubric";

export interface Obj6CanvasFields {
  intent:      string;
  assumptions: string;
  audience:    string;
  success:     string;
}

export interface Obj6IdentityCard {
  appearance:        string;
  voiceCharacter:    string;
  personalityTraits: string;
  presentationStyle: string;
  scriptConfirmed:   boolean;
  successTest:       string;
}

export interface Obj6CanvasStageResult {
  stage:         "canvas";
  passed:        boolean;
  score:         number;
  mode:          CanvasMode;
  fieldFeedback: { intent: string; assumptions: string; audience: string; success: string };
  summary:       string;
}

export interface Obj6IdentityCardStageResult {
  stage:                  "identityCard";
  passed:                 boolean;
  appearance40Plus:       boolean;
  voiceSpecific:          boolean;
  personalityBehavioural: boolean;
  scriptConfirmed:        boolean;
  summary:                string;
}

export interface Obj6CreateItStageResult {
  stage:             "createIt";
  score:             number;
  tier:              "distinction" | "merit" | "pass" | "fail";
  videoReachable:    boolean;
  line1Present:      boolean;
  line2Present:      boolean;
  line3Present:      boolean;
  transcriptExcerpt: string;
  summary:           string;
}

export interface Obj6FinalResult {
  passed:          boolean;
  composite:       number;
  tier:            "distinction" | "merit" | "pass" | "fail";
  canvas:          Obj6CanvasStageResult;
  identityCard:    Obj6IdentityCardStageResult | null;
  createIt:        Obj6CreateItStageResult | null;
  feedbackScript:  string;
  blockedAtStage?: "canvas" | "identityCard";
}

export interface Obj6SubmissionInput {
  worksheet: WorksheetUpload;
  videoUrl?: string;            // HeyGen MP4
  notes?:    string;
  profile:   { display_name: string; age_group: string };
}

export const OBJ6_RUBRIC = {
  lmsId:    "l1-06",
  legacyId: "a1-6",
  title:    "Build Your AI Academy Avatar",

  canvas: {
    weight:     0.25,
    minPassPct: 70,                   // higher than OBJ 10
    fieldHints: {
      intent:      { genuineEx: "To design a presenter classmates immediately want to listen to before a single word is spoken." },
      assumptions: { genuineEx: "I assume my classmates trust informal energy more than formal authority." },
      audience:    { genuineEx: "Students 13–14 who scroll past polished but dull content; they respond to authenticity over polish." },
      success:     { genuineEx: "If a peer watched 10 seconds with no sound and thought 'I want to hear this person'." },
    },
  },

  identityCard: {
    weight: 0.25,
    checks: {
      appearance40Plus:        { fail: "Your appearance description is too short. Describe age, clothing, expression, and the setting they sit in. Forty words minimum." },
      voiceSpecific:           { fail: "'Clear and professional' could describe anyone. Name the ONE distinct quality — warm authority, quiet intensity, energetic curiosity." },
      personalityBehavioural:  { fail: "List one behavioural cue. Not 'friendly' — show how. 'Tilts head when listening' is a behavioural description." },
      scriptConfirmed:         { fail: "Confirm you will deliver the three required script lines verbatim before opening HeyGen." },
    },
  },

  createIt: {
    weight: 0.50,
    requiredLines: [
      "Hi. I am [Avatar Name].",
      "I am an AI Creator at AI Decoder Academy.",
      "By Level 6 — I will have built something the world has never seen.",
    ],
    passCriteria:        "Avatar exists, video plays, all three required script lines are present in transcript.",
    meritCriteria:       "Avatar clearly reflects the Identity Card. Voice character matches.",
    distinctionCriteria: "Avatar achieves the success definition from Think It Field 4.",
  },

  // Sage's reactions for OBJ 6. Short, in-character. Calls out something
  // specific instead of summarising the whole rubric.
  feedbackScripts: {
    pass:
      "There's a face on screen and a voice behind it. " +
      "It's yours. Carry it forward.",
    merit:
      "That avatar actually reflects your Identity Card — same energy, same character. " +
      "Voice matches presentation. Hold this standard.",
    distinction:
      "I don't say this often. " +
      "You said what your avatar would communicate, and it does. " +
      "Intent to evidence — that's the skill. Keep it.",
  },
} as const;

export type Obj6Rubric = typeof OBJ6_RUBRIC;

// ─── StagedRubric facade for the existing TeacherCharacter routing ─────────
// The panel + teacher character resolve a single `StagedRubric` shape via
// getStagedRubric(lmsId). OBJ 6 reuses that contract; the OBJ10-specific
// fields (funnyTest, requirements.panels) are populated with sensible
// placeholders and never read on the OBJ 6 path because the panel and the
// validate route both branch on rubric.lmsId.
export const OBJ6_STAGED_RUBRIC: StagedRubric = {
  kind:        "staged",
  lmsId:       OBJ6_RUBRIC.lmsId,
  title:       OBJ6_RUBRIC.title,
  tier:        "T3 — CONSTRUCT",
  difficulty:  3,
  tools:       ["HeyGen"],

  worksheetTemplateUrl:  "/worksheets/obj6-worksheet.docx",
  worksheetTemplateName: "OBJ6_StudentWorksheet.docx",

  objectiveBlurb: "Design your AI Academy avatar — appearance, voice, presence — using HeyGen. Identity persists for 6 levels.",
  thinkItBrief:   "Answer the four Canvas fields before opening HeyGen. 70% threshold.",
  storyItBrief:   "Complete the Avatar Identity Card. All six fields.",
  createItBrief:  "Record your avatar in HeyGen. Deliver the three required script lines verbatim.",

  canvas: {
    weight:     OBJ6_RUBRIC.canvas.weight,
    minPassPct: OBJ6_RUBRIC.canvas.minPassPct,
    fieldHints: {
      intent: {
        label:        "Intent",
        placeholder:  "What impression before a word is spoken?",
        placeholderEx: "To create my avatar.",
        genuineEx:    OBJ6_RUBRIC.canvas.fieldHints.intent.genuineEx,
      },
      assumptions: {
        label:        "Assumptions",
        placeholder:  "What are you betting on?",
        placeholderEx: "I assume it will work.",
        genuineEx:    OBJ6_RUBRIC.canvas.fieldHints.assumptions.genuineEx,
      },
      audience: {
        label:        "Audience",
        placeholder:  "Specific people, specific reaction",
        placeholderEx: "My classmates.",
        genuineEx:    OBJ6_RUBRIC.canvas.fieldHints.audience.genuineEx,
      },
      success: {
        label:        "Success",
        placeholder:  "What they'd say or do",
        placeholderEx: "If it looks good.",
        genuineEx:    OBJ6_RUBRIC.canvas.fieldHints.success.genuineEx,
      },
    },
  },

  // OBJ 6 doesn't use Story-It / Funny-Test; placeholders satisfy the type
  // contract. Validator route branches on lmsId before hitting these.
  storyIt: {
    weight:    OBJ6_RUBRIC.identityCard.weight,
    failLines: {
      setupTwistPayoff:    "Identity Card needs another pass.",
      panel3IsPunchline:   "Identity Card needs another pass.",
      characterConsistent: "Identity Card needs another pass.",
    },
    passLines: {
      setupTwistPayoff:    "Identity Card complete.",
      panel3IsPunchline:   "Identity Card complete.",
      characterConsistent: "Identity Card complete.",
    },
    funnyTestQuestion:      "(N/A for OBJ 6)",
    funnyTestFailureScript: "(N/A for OBJ 6)",
  },

  createIt: {
    weight: OBJ6_RUBRIC.createIt.weight,
    requirements: {
      panels:              0,           // N/A — video, not panels
      avatarNameRequired:  true,
      consistentCharacter: true,
    },
    passCriteria:        OBJ6_RUBRIC.createIt.passCriteria,
    meritCriteria:       OBJ6_RUBRIC.createIt.meritCriteria,
    distinctionCriteria: OBJ6_RUBRIC.createIt.distinctionCriteria,
  },

  feedbackScripts: {
    pass:             OBJ6_RUBRIC.feedbackScripts.pass,
    merit:            OBJ6_RUBRIC.feedbackScripts.merit,
    distinction:      OBJ6_RUBRIC.feedbackScripts.distinction,
    funnyTestFailure: "(N/A for OBJ 6)",
  },
};
