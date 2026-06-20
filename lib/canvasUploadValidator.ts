// lib/canvasUploadValidator.ts

import { validateCanvasJSON, formatValidationError, repairJSON } from "./jsonValidator";

export interface UploadResult {
  success: boolean;
  message: string;
  data?: object;
  errors?: string[];
}

/**
 * Validates and processes JSON before uploading to Canvas
 * @param jsonString The JSON string to validate
 * @param autoRepair If true, attempts to repair common JSON issues
 * @returns Upload result with validation details
 */
export function validateBeforeUpload(jsonString: string, autoRepair: boolean = true): UploadResult {
  // Step 1: Basic validation
  const validation = validateCanvasJSON(jsonString);

  if (validation.valid) {
    return {
      success: true,
      message: "✅ JSON is valid and ready to upload to Canvas",
      data: JSON.parse(jsonString),
    };
  }

  // Step 2: If auto-repair enabled, try to fix
  if (autoRepair) {
    const repair = repairJSON(jsonString);
    if (repair.success && repair.repaired) {
      const retryValidation = validateCanvasJSON(repair.repaired);
      if (retryValidation.valid) {
        return {
          success: true,
          message: `✅ JSON was repaired (${repair.message}) and is now valid`,
          data: JSON.parse(repair.repaired),
        };
      }
    }
  }

  // Step 3: Return detailed errors
  const errorMessages = validation.errors.map(
    (err) =>
      `[Line ${err.line}, Column ${err.column}] ${err.field}: ${err.message} (Expected: ${err.expected}, Got: ${err.received})`
  );

  return {
    success: false,
    message: `❌ JSON validation failed with ${validation.errors.length} error(s)`,
    errors: errorMessages,
  };
}

/**
 * Safe JSON parser with detailed error reporting
 */
export function safeJsonParse(jsonString: string) {
  try {
    return {
      success: true,
      data: JSON.parse(jsonString),
    };
  } catch (err: any) {
    const match = err.message.match(/position (\d+)/);
    const position = match ? parseInt(match[1]) : 0;
    const lines = jsonString.substring(0, position).split("\n");
    const line = lines.length;
    const column = lines[lines.length - 1]?.length || 0;

    return {
      success: false,
      error: err.message,
      line,
      column,
      snippet: lines[lines.length - 1] || "",
    };
  }
}
