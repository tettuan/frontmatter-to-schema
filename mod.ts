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

// ============================================================================
// CLI - For direct CLI class usage (advanced)
// ============================================================================

export { CLI } from "./src/presentation/cli/index.ts";
export type { CLIResponse } from "./src/presentation/cli/index.ts";

// ============================================================================
// Advanced API - For custom pipeline construction
// ============================================================================

export { PipelineOrchestrator } from "./src/application/services/pipeline-orchestrator.ts";
export type {
  PipelineConfig,
  PipelineResult,
} from "./src/application/services/pipeline-orchestrator.ts";

// Infrastructure adapters (for dependency injection)
export { DenoFileSystemAdapter } from "./src/infrastructure/adapters/deno-file-system-adapter.ts";
export type { FileSystemPort } from "./src/infrastructure/ports/file-system-port.ts";
