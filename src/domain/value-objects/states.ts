// Discriminated Union Types following Totality principle
// These types ensure exhaustive pattern matching and eliminate invalid states

import type { FrontMatter } from "../entities/frontmatter.ts";

/**
 * Document frontmatter state
 * Explicitly models presence or absence of frontmatter
 */
export type DocumentFrontMatterState =
  | { kind: "WithFrontMatter"; frontMatter: FrontMatter }
  | { kind: "NoFrontMatter" };

/**
 * Frontmatter input during document creation
 * Distinguishes between present and not present states
 */
export type FrontMatterInput =
  | { kind: "Present"; frontMatter: FrontMatter }
  | { kind: "NotPresent" };

/**
 * Path resolution results
 * Explicitly handles found and not found cases
 */
export type PathResolutionResult =
  | { kind: "Found"; value: unknown }
  | { kind: "NotFound"; path: string };

/**
 * Template parsing results
 * Models all possible parsing outcomes
 */
export type TemplateParsingResult =
  | { kind: "JsonParsed"; template: Record<string, unknown> }
  | { kind: "ParseFailed"; reason: string }
  | { kind: "NoPlaceholders" };

/**
 * Schema resolution state
 * Tracks whether $ref resolution has been performed
 */
export type SchemaResolutionState =
  | { kind: "Unresolved"; schema: Record<string, unknown> }
  | { kind: "Resolved"; schema: Record<string, unknown> }
  | { kind: "ResolutionFailed"; error: string };

/**
 * Validation state for documents
 * Tracks validation status against schema
 */
export type ValidationState =
  | { kind: "NotValidated" }
  | { kind: "Valid"; schema: string }
  | { kind: "Invalid"; errors: string[] };

/**
 * Processing state for tracking workflow progress
 */
export type ProcessingState =
  | { kind: "Pending" }
  | { kind: "InProgress"; step: string }
  | { kind: "Completed"; result: unknown }
  | { kind: "Failed"; error: string };
