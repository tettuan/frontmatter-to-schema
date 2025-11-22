/**
 * Centralized directive name constants to avoid hardcoding throughout the codebase.
 * These constants provide a single source of truth for all x-directive names.
 */

export const DIRECTIVE_NAMES = {
  FRONTMATTER_PART: "x-frontmatter-part",
  COLLECT_PATTERN: "x-collect-pattern",
  FLATTEN_ARRAYS: "x-flatten-arrays",
  DERIVED_FROM: "x-derived-from",
  DERIVED_UNIQUE: "x-derived-unique",
  JMESPATH_FILTER: "x-jmespath-filter",
  TEMPLATE_FORMAT: "x-template-format",
  TEMPLATE_ITEMS: "x-template-items",
  TEMPLATE: "x-template",
} as const;

/**
 * Array of all directive names for iteration and validation.
 */
export const ALL_DIRECTIVE_NAMES = Object.values(DIRECTIVE_NAMES);

/**
 * Type for directive names based on the constants.
 */
export type DirectiveName =
  typeof DIRECTIVE_NAMES[keyof typeof DIRECTIVE_NAMES];

/**
 * Validates if a string is a valid directive name.
 */
export function isValidDirectiveName(name: string): name is DirectiveName {
  return ALL_DIRECTIVE_NAMES.includes(name as DirectiveName);
}

/**
 * Gets the display name for a directive (removes x- prefix).
 */
export function getDirectiveDisplayName(directive: DirectiveName): string {
  return directive.replace(/^x-/, "");
}

/**
 * Groups directives by their processing category.
 */
export const DIRECTIVE_CATEGORIES = {
  DATA_EXTRACTION: [
    DIRECTIVE_NAMES.FRONTMATTER_PART,
    DIRECTIVE_NAMES.COLLECT_PATTERN,
  ],
  DATA_TRANSFORMATION: [
    DIRECTIVE_NAMES.FLATTEN_ARRAYS,
    DIRECTIVE_NAMES.DERIVED_FROM,
    DIRECTIVE_NAMES.DERIVED_UNIQUE,
    DIRECTIVE_NAMES.JMESPATH_FILTER,
  ],
  TEMPLATE_PROCESSING: [
    DIRECTIVE_NAMES.TEMPLATE_FORMAT,
    DIRECTIVE_NAMES.TEMPLATE_ITEMS,
    DIRECTIVE_NAMES.TEMPLATE,
  ],
} as const;

/**
 * Default processing order for directives.
 */
export const DEFAULT_DIRECTIVE_ORDER: DirectiveName[] = [
  DIRECTIVE_NAMES.FRONTMATTER_PART,
  DIRECTIVE_NAMES.COLLECT_PATTERN,
  DIRECTIVE_NAMES.FLATTEN_ARRAYS,
  DIRECTIVE_NAMES.DERIVED_FROM,
  DIRECTIVE_NAMES.DERIVED_UNIQUE,
  DIRECTIVE_NAMES.JMESPATH_FILTER,
  DIRECTIVE_NAMES.TEMPLATE_FORMAT,
  DIRECTIVE_NAMES.TEMPLATE_ITEMS,
  DIRECTIVE_NAMES.TEMPLATE,
];
