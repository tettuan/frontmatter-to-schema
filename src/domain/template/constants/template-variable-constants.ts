/**
 * Template Variable Constants
 *
 * Centralized definitions for template variable patterns and markers.
 * Eliminates hardcoded strings throughout the codebase following Totality principles.
 *
 * Design Philosophy:
 * - Configuration-driven rather than hardcoded values
 * - Type-safe constant definitions
 * - Single source of truth for template variable patterns
 */

/**
 * Array expansion marker used in templates for dynamic array insertion.
 */
export const ARRAY_EXPANSION_MARKER = "@items" as const;

/**
 * Template placeholder format for array expansion.
 */
export const ARRAY_EXPANSION_PLACEHOLDER = "{@items}" as const;

/**
 * Pattern for detecting special @ variables.
 */
export const SPECIAL_VARIABLE_PREFIX = "@" as const;

/**
 * Supported template variable patterns.
 */
export const TEMPLATE_VARIABLE_PATTERNS = {
  /** Standard variable pattern: {variable} */
  STANDARD: /\{([^@][^}]*)\}/g,
  /** Array expansion pattern: {@items} */
  ARRAY_EXPANSION: /\{@items\}/g,
  /** Special processor pattern: {@...} */
  SPECIAL_PROCESSOR: /\{@([^}]+)\}/g,
} as const;

/**
 * Template format detection patterns.
 */
export const FORMAT_DETECTION_PATTERNS = {
  /** YAML list format: "  - {@items}" */
  YAML_LIST: /^\s*-\s*"?{@items}"?\s*$/,
  /** Direct format: "{@items}" */
  DIRECT: /^\s*"?{@items}"?\s*$/,
  /** Embedded format: contains {@items} within other content */
  EMBEDDED: /{@items}/,
} as const;

/**
 * Error message templates for consistent error reporting.
 */
export const ERROR_MESSAGES = {
  ARRAY_MARKER_NOT_SUPPORTED: (marker: string) =>
    `Array marker '${marker}' not supported or no array data available`,
  TEMPLATE_ITEMS_NOT_FOUND:
    "Template contains {@items} but could not locate it in lines",
  VARIABLE_RESOLUTION_FAILED: (variable: string, reason: string) =>
    `Variable '${variable}' resolution failed: ${reason}`,
  INVALID_VARIABLE_PATTERN: (pattern: string) =>
    `Invalid variable pattern: ${pattern}`,
} as const;

/**
 * Type-safe template variable marker definitions.
 */
export type ArrayExpansionMarker = typeof ARRAY_EXPANSION_MARKER;
export type ArrayExpansionPlaceholder = typeof ARRAY_EXPANSION_PLACEHOLDER;
export type SpecialVariablePrefix = typeof SPECIAL_VARIABLE_PREFIX;
