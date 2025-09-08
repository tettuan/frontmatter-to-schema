/**
 * Template Resolution Constants
 *
 * Type-safe constants for template variable resolution results.
 * Eliminates hardcoded strings in switch/case statements.
 * Follows Totality principles with discriminated unions.
 */

/**
 * Variable Resolution Result Kinds as const
 */
export const RESOLUTION_RESULT_KINDS = {
  SUCCESS: "Success",
  VARIABLE_NOT_FOUND: "VariableNotFound",
  PATH_NOT_RESOLVED: "PathNotResolved",
  DEFAULT_USED: "DefaultUsed",
  CONDITIONAL_EVALUATION_FAILED: "ConditionalEvaluationFailed",
} as const;

/**
 * Type for resolution result kind values
 */
export type ResolutionResultKind =
  typeof RESOLUTION_RESULT_KINDS[keyof typeof RESOLUTION_RESULT_KINDS];

/**
 * Template Variable Kinds as const
 */
export const TEMPLATE_VARIABLE_KINDS = {
  SIMPLE: "SimpleVariable",
  PATH: "PathVariable",
  CONDITIONAL: "ConditionalVariable",
} as const;

/**
 * Type for template variable kind values
 */
export type TemplateVariableKind =
  typeof TEMPLATE_VARIABLE_KINDS[keyof typeof TEMPLATE_VARIABLE_KINDS];

/**
 * Path Navigation Result Kinds as const
 */
export const PATH_NAVIGATION_KINDS = {
  SUCCESS: "Success",
  NOT_FOUND: "NotFound",
  ERROR: "Error",
} as const;

/**
 * Type for path navigation result kind values
 */
export type PathNavigationKind =
  typeof PATH_NAVIGATION_KINDS[keyof typeof PATH_NAVIGATION_KINDS];
