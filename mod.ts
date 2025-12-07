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
 * ### Transform markdown string directly
 * ```typescript
 * import { transformMarkdown } from "jsr:@aidevtool/frontmatter-to-schema";
 *
 * const result = transformMarkdown({
 *   markdown: "---\ntitle: Hello\n---\nContent",
 *   schema: { type: "object", properties: { title: { type: "string" } } }
 * });
 *
 * if (result.isOk()) {
 *   console.log(result.unwrap().data); // { title: "Hello" }
 * }
 * ```
 *
 * ### Transform files
 * ```typescript
 * import { transformFiles } from "jsr:@aidevtool/frontmatter-to-schema";
 *
 * const result = await transformFiles({
 *   schema: "./schema.json",
 *   input: "./docs/",
 *   output: "./output.json"
 * });
 * ```
 *
 * ### CLI usage
 * ```typescript
 * import { runCLI } from "jsr:@aidevtool/frontmatter-to-schema";
 *
 * await runCLI(["schema.json", "output.json", "./docs/"]);
 * ```
 */

// ============================================================================
// Primary API - Simple functions for common use cases
// ============================================================================

export {
  // Factory for reusable transformer
  createTransformer,
  // Types
  type JsonSchema,
  type OutputTemplate,
  // Error handling
  Result,
  // CLI runner
  runCLI,
  Transformer,
  type TransformerOptions,
  // Error type
  TransformError,
  // Core transformation functions
  transformFiles,
  type TransformFilesOptions,
  type TransformFilesResult,
  transformMarkdown,
  type TransformMarkdownOptions,
  type TransformMarkdownResult,
} from "./src/api.ts";
