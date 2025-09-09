/**
 * Processing Mode Types
 *
 * Defines processing modes using discriminated union pattern for command processing.
 */

/**
 * Processing mode discriminated union following Totality principle
 */
export type ProcessingMode =
  | { kind: "strict"; validation: "fail-fast" }
  | { kind: "lenient"; validation: "continue-on-error"; maxErrors: number };
