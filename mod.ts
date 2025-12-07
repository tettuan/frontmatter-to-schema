/**
 * frontmatter-to-schema
 *
 * A library for extracting YAML frontmatter from markdown files
 * and transforming it according to JSON Schema definitions.
 *
 * @module
 *
 * ## Quick Start
 *
 * ### Process markdown string directly
 * ```typescript
 * import { processMarkdown } from "jsr:@aidevtool/frontmatter-to-schema";
 *
 * const result = await processMarkdown({
 *   markdown: "---\ntitle: Hello\n---\nContent",
 *   schema: { type: "object", properties: { title: { type: "string" } } }
 * });
 *
 * if (result.isOk()) {
 *   console.log(result.unwrap().data); // { title: "Hello" }
 * }
 * ```
 *
 * ### Process files
 * ```typescript
 * import { processFiles } from "jsr:@aidevtool/frontmatter-to-schema";
 *
 * const result = await processFiles({
 *   schema: "./schema.json",
 *   input: "./docs/",
 *   output: "./output.json"
 * });
 * ```
 *
 * ### CLI usage
 * ```typescript
 * import { run } from "jsr:@aidevtool/frontmatter-to-schema";
 *
 * await run(["schema.json", "output.json", "./docs/"]);
 * ```
 */

// ============================================================================
// Primary API - Simple functions for common use cases
// ============================================================================

export {
  // Factory for reusable processor
  createProcessor,
  // Types
  type JsonSchema,
  processFiles,
  type ProcessFilesOptions,
  type ProcessFilesResult,
  ProcessingError,
  // Core processing functions
  processMarkdown,
  type ProcessMarkdownOptions,
  type ProcessMarkdownResult,
  Processor,
  type ProcessorOptions,
  // Error handling
  Result,
  run,
  type Template,
} from "./src/api.ts";
