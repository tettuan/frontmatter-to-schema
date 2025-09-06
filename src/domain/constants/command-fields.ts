/**
 * Command Field Constants
 *
 * Centralized definition of command field names to avoid hardcoding.
 * These constants should be used throughout the codebase instead of magic strings.
 *
 * Following the AI-complexity-control and prohibit-hardcoding principles.
 */

/**
 * Default command field names for CLI registry
 * These can be overridden by schema definitions
 */
export const DEFAULT_COMMAND_FIELDS = {
  DOMAIN: "c1", // Domain/category component
  ACTION: "c2", // Action/directive component
  TARGET: "c3", // Target/layer component
  TITLE: "title",
  DESCRIPTION: "description",
  USAGE: "usage",
  OPTIONS: "options",
} as const;

/**
 * Command field metadata for schema generation
 */
export const COMMAND_FIELD_METADATA = {
  [DEFAULT_COMMAND_FIELDS.DOMAIN]: {
    type: "string",
    description: "First command component (domain/category)",
    required: true,
  },
  [DEFAULT_COMMAND_FIELDS.ACTION]: {
    type: "string",
    description: "Second command component (action/directive)",
    required: true,
  },
  [DEFAULT_COMMAND_FIELDS.TARGET]: {
    type: "string",
    description: "Third command component (target/layer)",
    required: true,
  },
  [DEFAULT_COMMAND_FIELDS.TITLE]: {
    type: "string",
    description: "Human-readable command title",
    required: false,
  },
  [DEFAULT_COMMAND_FIELDS.DESCRIPTION]: {
    type: "string",
    description: "Command description",
    required: false,
  },
  [DEFAULT_COMMAND_FIELDS.USAGE]: {
    type: "string",
    description: "Usage example",
    required: false,
  },
  [DEFAULT_COMMAND_FIELDS.OPTIONS]: {
    type: "object",
    description: "Available command options",
    required: false,
  },
} as const;

/**
 * Get required command fields from metadata
 */
export function getRequiredCommandFields(): string[] {
  return Object.entries(COMMAND_FIELD_METADATA)
    .filter(([_, metadata]) => metadata.required)
    .map(([field]) => field);
}

/**
 * Type guard to check if an object has required command fields
 */
export function hasRequiredCommandFields(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const data = obj as Record<string, unknown>;
  const requiredFields = getRequiredCommandFields();

  return requiredFields.every((field) =>
    field in data &&
    data[field] !== undefined &&
    data[field] !== null &&
    data[field] !== ""
  );
}
