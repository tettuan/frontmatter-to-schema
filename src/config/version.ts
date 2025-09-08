/**
 * Version configuration for the application
 * Centralized version management to avoid hardcoding
 */

export const VERSION_CONFIG = {
  APP_VERSION: "1.0.0",
  DEFAULT_SCHEMA_VERSION: "1.0.0",
} as const;

export const DEFAULTS = {
  UNKNOWN: "unknown",
} as const;

export const FILE_NAMING = {
  FRONTMATTER_PREFIX: "f",
} as const;
