/**
 * File Extension Constants
 *
 * Centralized file extension definitions to avoid hardcoding
 * Following DDD and Totality principles
 */

// Schema file extensions
export const SCHEMA_EXTENSIONS = {
  JSON: ".json",
  YAML: ".yaml",
  YML: ".yml",
} as const;

// Document file extensions
export const DOCUMENT_EXTENSIONS = {
  MARKDOWN: ".md",
  MDX: ".mdx",
} as const;

// Output file extensions
export const OUTPUT_EXTENSIONS = {
  JSON: ".json",
  YAML: ".yaml",
  YML: ".yml",
  TOML: ".toml",
} as const;

// Programming language extensions
export const LANGUAGE_EXTENSIONS = {
  TYPESCRIPT: ".ts",
  JAVASCRIPT: ".js",
  TSX: ".tsx",
  JSX: ".jsx",
} as const;

// File patterns
export const FILE_PATTERNS = {
  ALL_MARKDOWN: "**/*.md",
  ALL_FILES: "**/*",
  DIRECTORY_MARKDOWN: "/*.md",
} as const;

// Extension validation helpers
export function isSchemaFile(path: string): boolean {
  return Object.values(SCHEMA_EXTENSIONS).some((ext) => path.endsWith(ext));
}

export function isMarkdownFile(path: string): boolean {
  return Object.values(DOCUMENT_EXTENSIONS).some((ext) => path.endsWith(ext));
}

export function isOutputFile(path: string): boolean {
  return Object.values(OUTPUT_EXTENSIONS).some((ext) => path.endsWith(ext));
}

export function getExtension(path: string): string {
  const lastDot = path.lastIndexOf(".");
  return lastDot === -1 ? "" : path.slice(lastDot);
}
