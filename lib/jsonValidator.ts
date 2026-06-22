// lib/jsonValidator.ts

export interface ValidationError {
  valid: boolean;
  errors: {
    line: number;
    column: number;
    message: string;
    field: string;
    expected: string;
    received: string;
  }[];
}

const VALID_SCHEMAS = [
  "concepts",
  "concept_titles",
  "title", // story backbone
  "learning_steps",
  "scene_plan",
  "scene_id", // scene generation
  "visual_prompt",
  "stories", // ranking
];

export function validateCanvasJSON(jsonString: string): ValidationError {
  const errors: ValidationError["errors"] = [];

  // Step 1: Parse JSON syntax
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err: any) {
    const match = err.message.match(/position (\d+)/);
    const position = match ? parseInt(match[1]) : 0;
    const lines = jsonString.substring(0, position).split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1]?.length ?? 0;

    errors.push({
      line,
      column,
      message: `JSON Syntax Error: ${err.message}`,
      field: "root",
      expected: "valid JSON",
      received: err.message,
    });

    return { valid: false, errors };
  }

  // Step 2: Validate root is object
  if (!parsed || typeof parsed !== "object") {
    errors.push({
      line: 1,
      column: 0,
      message: "Root must be a JSON object",
      field: "root",
      expected: "object",
      received: typeof parsed,
    });
    return { valid: false, errors };
  }

  // Step 3: Check for required fields from one of the schemas
  const hasValidSchema = VALID_SCHEMAS.some((key) => key in parsed);
  if (!hasValidSchema) {
    errors.push({
      line: 1,
      column: 0,
      message: `Missing required schema field. Expected one of: ${VALID_SCHEMAS.join(", ")}`,
      field: "root",
      expected: VALID_SCHEMAS.join(" | "),
      received: Object.keys(parsed).join(", "),
    });
    return { valid: false, errors };
  }

  // Step 4: Validate specific schema fields
  if ("learning_steps" in parsed) {
    if (!Array.isArray(parsed.learning_steps)) {
      errors.push({
        line: 2,
        column: 0,
        message: "learning_steps must be an array",
        field: "learning_steps",
        expected: "array",
        received: typeof parsed.learning_steps,
      });
    } else {
      parsed.learning_steps.forEach((step: any, idx: number) => {
        if (!step.learning_step_id) {
          errors.push({
            line: 3 + idx,
            column: 2,
            message: "Each learning_step must have a learning_step_id",
            field: `learning_steps[${idx}].learning_step_id`,
            expected: "string",
            received: "undefined",
          });
        }
        if (!step.title) {
          errors.push({
            line: 4 + idx,
            column: 2,
            message: "Each learning_step must have a title",
            field: `learning_steps[${idx}].title`,
            expected: "string",
            received: "undefined",
          });
        }
        if (!step.concepts_introduced) {
          errors.push({
            line: 5 + idx,
            column: 2,
            message: "Each learning_step must have concepts_introduced",
            field: `learning_steps[${idx}].concepts_introduced`,
            expected: "array",
            received: "undefined",
          });
        }
        if (!step.narrative_moment) {
          errors.push({
            line: 6 + idx,
            column: 2,
            message: "Each learning_step must have narrative_moment",
            field: `learning_steps[${idx}].narrative_moment`,
            expected: "string",
            received: "undefined",
          });
        }
      });
    }
  }

  if ("characters" in parsed) {
    if (!Array.isArray(parsed.characters)) {
      errors.push({
        line: 2,
        column: 0,
        message: "characters must be an array",
        field: "characters",
        expected: "array",
        received: typeof parsed.characters,
      });
    } else {
      parsed.characters.forEach((char: any, idx: number) => {
        const required = ["name", "role", "voice_id"];
        const missing = required.filter((r) => !char[r]);
        if (missing.length > 0) {
          errors.push({
            line: 3 + idx,
            column: 2,
            message: `Character must have ${missing.join(", ")}`,
            field: `characters[${idx}]`,
            expected: "{ name, role, voice_id, personality, visual_description, gender }",
            received: Object.keys(char).join(", "),
          });
        }
      });
    }
  }

  if ("scene_id" in parsed) {
    if (!parsed.phase) {
      errors.push({
        line: 2,
        column: 0,
        message: "Scene must have phase",
        field: "phase",
        expected: "HOOK|OBSERVATION|INVESTIGATION|DISCOVERY|EXPLANATION|REINFORCEMENT|TRANSITION",
        received: "undefined",
      });
    }
    if (!parsed.setting) {
      errors.push({
        line: 3,
        column: 0,
        message: "Scene must have setting",
        field: "setting",
        expected: "string",
        received: "undefined",
      });
    }
    if (!parsed.narrator_audio_text) {
      errors.push({
        line: 4,
        column: 0,
        message: "Scene must have narrator_audio_text",
        field: "narrator_audio_text",
        expected: "string (clean TTS text)",
        received: "undefined",
      });
    }
  }

  if ("concepts" in parsed) {
    if (!Array.isArray(parsed.concepts)) {
      errors.push({
        line: 2,
        column: 0,
        message: "concepts must be an array",
        field: "concepts",
        expected: "array of strings",
        received: typeof parsed.concepts,
      });
    }
  }

  if ("visual_prompt" in parsed) {
    if (typeof parsed.visual_prompt !== "string") {
      errors.push({
        line: 2,
        column: 0,
        message: "visual_prompt must be a string",
        field: "visual_prompt",
        expected: "string",
        received: typeof parsed.visual_prompt,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function formatValidationError(validation: ValidationError): string {
  if (validation.valid) return "✅ JSON is valid!";

  return `
❌ JSON Validation Failed (${validation.errors.length} error${validation.errors.length > 1 ? "s" : ""})
${validation.errors
  .map(
    (err) => `
[Line ${err.line}, Column ${err.column}] ${err.field}
  Error: ${err.message}
  Expected: ${err.expected}
  Received: ${err.received}
`
  )
  .join("\n")}
  `;
}

export function repairJSON(jsonString: string): { repaired: string | null; success: boolean; message: string } {
  try {
    const parsed = JSON.parse(jsonString);
    // Already valid
    return { repaired: JSON.stringify(parsed, null, 2), success: true, message: "JSON is already valid" };
  } catch (err: any) {
    // Try basic repairs
    try {
      // Remove trailing commas
      let repaired = jsonString.replace(/,(\s*[}\]])/g, "$1");
      // Try parsing again
      const parsed = JSON.parse(repaired);
      return { repaired: JSON.stringify(parsed, null, 2), success: true, message: "Removed trailing commas" };
    } catch {
      return { repaired: null, success: false, message: `Unable to repair: ${err.message}` };
    }
  }
}
