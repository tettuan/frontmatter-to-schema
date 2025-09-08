/**
 * CLI Constants
 *
 * Type-safe constants for CLI arguments and options.
 * Eliminates hardcoded strings in switch/case statements.
 * Follows Totality principles with discriminated unions.
 */

/**
 * CLI Option Names as const enum for type safety
 */
export const CLI_OPTIONS = {
  // Short flags
  VERBOSE_SHORT: "-v",
  QUIET_SHORT: "-q",
  PARALLEL_SHORT: "-p",
  HELP_SHORT: "-h",

  // Long flags
  VERBOSE_LONG: "--verbose",
  QUIET_LONG: "--quiet",
  PARALLEL_LONG: "--parallel",
  HELP_LONG: "--help",
  VERSION: "--version",
  DRY_RUN: "--dry-run",
  MAX_WORKERS: "--max-workers",
} as const;

/**
 * Type for CLI option values
 */
export type CLIOptionKey = typeof CLI_OPTIONS[keyof typeof CLI_OPTIONS];

/**
 * Discriminated union for CLI option types
 */
export type CLIOptionType =
  | { kind: "boolean"; name: CLIOptionKey; value: boolean }
  | { kind: "number"; name: CLIOptionKey; value: number }
  | { kind: "string"; name: CLIOptionKey; value: string };

/**
 * Map of option names to their handlers
 */
export const OPTION_HANDLERS = new Map<
  CLIOptionKey,
  keyof import("./cli-arguments.ts").CLIOptions
>([
  [CLI_OPTIONS.VERBOSE_SHORT, "verbose"],
  [CLI_OPTIONS.VERBOSE_LONG, "verbose"],
  [CLI_OPTIONS.QUIET_SHORT, "quiet"],
  [CLI_OPTIONS.QUIET_LONG, "quiet"],
  [CLI_OPTIONS.PARALLEL_SHORT, "parallel"],
  [CLI_OPTIONS.PARALLEL_LONG, "parallel"],
  [CLI_OPTIONS.HELP_SHORT, "help"],
  [CLI_OPTIONS.HELP_LONG, "help"],
  [CLI_OPTIONS.VERSION, "version"],
  [CLI_OPTIONS.DRY_RUN, "dryRun"],
  [CLI_OPTIONS.MAX_WORKERS, "maxWorkers"],
]);

/**
 * Type guard for checking if a string is a valid CLI option
 */
export function isCLIOption(arg: string): arg is CLIOptionKey {
  return Object.values(CLI_OPTIONS).includes(arg as CLIOptionKey);
}

/**
 * Get the option property name for a given CLI flag
 */
export function getOptionProperty(
  flag: CLIOptionKey,
): keyof import("./cli-arguments.ts").CLIOptions | undefined {
  return OPTION_HANDLERS.get(flag);
}
