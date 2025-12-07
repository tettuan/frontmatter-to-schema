/**
 * Public API for frontmatter-to-schema
 *
 * Provides simplified entry points for external library usage.
 * All internal dependencies are encapsulated.
 *
 * @module
 *
 * @example
 * ```typescript
 * import { processMarkdown, processFiles } from "jsr:@aidevtool/frontmatter-to-schema";
 *
 * // Process markdown string directly
 * const result = processMarkdown({
 *   markdown: "---\ntitle: Hello\n---\nContent",
 *   schema: { type: "object", properties: { title: { type: "string" } } }
 * });
 *
 * // Process files
 * const fileResult = await processFiles({
 *   schema: "./schema.json",
 *   input: "./docs/",
 *   output: "./output.json"
 * });
 * ```
 */

import { Result } from "./domain/shared/types/result.ts";
import { ProcessingError } from "./domain/shared/types/errors.ts";
import { DenoFileSystemAdapter } from "./infrastructure/adapters/deno-file-system-adapter.ts";
import {
  PipelineConfig,
  PipelineOrchestrator,
} from "./application/services/pipeline-orchestrator.ts";
import { FrontmatterParsingService } from "./domain/frontmatter/services/frontmatter-parsing-service.ts";
import { SchemaDirectiveProcessor } from "./domain/schema/services/schema-directive-processor.ts";
import { CLI } from "./presentation/cli/index.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * JSON Schema definition for frontmatter mapping
 */
export type JsonSchema = Record<string, unknown>;

/**
 * Template definition for output formatting
 */
export type Template = Record<string, unknown>;

/**
 * Options for markdown processing
 */
export interface ProcessMarkdownOptions {
  /** Raw markdown content with YAML frontmatter */
  readonly markdown: string;
  /** JSON Schema defining the output structure */
  readonly schema: JsonSchema;
  /** Optional template for output formatting */
  readonly template?: Template;
}

/**
 * Result of markdown processing
 */
export interface ProcessMarkdownResult {
  /** Extracted and transformed frontmatter data */
  readonly data: Record<string, unknown>;
  /** Original frontmatter before transformation */
  readonly rawFrontmatter: Record<string, unknown>;
  /** Markdown body content (without frontmatter) */
  readonly body: string;
}

/**
 * Options for file-based processing
 */
export interface ProcessFilesOptions {
  /** Path to JSON schema file */
  readonly schema: string;
  /** Path to input markdown file(s) or directory */
  readonly input: string | string[];
  /** Path for output file */
  readonly output: string;
  /** Optional path to template file (uses schema's x-template if not specified) */
  readonly template?: string;
  /** Output format */
  readonly format?: "json" | "yaml" | "xml" | "markdown";
}

/**
 * Result of file processing
 */
export interface ProcessFilesResult {
  /** Number of documents processed */
  readonly processedDocuments: number;
  /** Path to output file */
  readonly outputPath: string;
  /** Execution time in milliseconds */
  readonly executionTime: number;
}

/**
 * Options for creating a processor instance
 */
export interface ProcessorOptions {
  /** Custom file system adapter (for testing or alternative runtimes) */
  readonly fileSystem?: {
    readTextFile(path: string): Promise<Result<string, unknown>>;
    writeTextFile(
      path: string,
      content: string,
    ): Promise<Result<void, unknown>>;
    stat(
      path: string,
    ): Promise<Result<{ isFile: boolean; isDirectory: boolean }, unknown>>;
    exists(path: string): Promise<Result<boolean, unknown>>;
    readDir(
      path: string,
    ): Promise<
      Result<
        Array<{ name: string; isFile: boolean; isDirectory: boolean }>,
        unknown
      >
    >;
  };
}

// ============================================================================
// Main API Functions
// ============================================================================

/**
 * Process a single markdown string and extract frontmatter according to schema.
 *
 * This is the simplest API for processing markdown content directly
 * without file system operations.
 *
 * @param options - Processing options including markdown content and schema
 * @returns Result containing processed data or error
 *
 * @example
 * ```typescript
 * const result = processMarkdown({
 *   markdown: `---
 * title: My Article
 * author: John Doe
 * tags: [typescript, deno]
 * ---
 * # Content here`,
 *   schema: {
 *     type: "object",
 *     properties: {
 *       title: { type: "string" },
 *       author: { type: "string" },
 *       tags: { type: "array", items: { type: "string" } }
 *     }
 *   }
 * });
 *
 * if (result.isOk()) {
 *   console.log(result.unwrap().data);
 *   // { title: "My Article", author: "John Doe", tags: ["typescript", "deno"] }
 * }
 * ```
 */
export function processMarkdown(
  options: ProcessMarkdownOptions,
): Result<ProcessMarkdownResult, ProcessingError> {
  const { markdown, schema } = options;

  // Create file system adapter (required by parsing service)
  const fileSystem = DenoFileSystemAdapter.create();

  // Parse frontmatter using the parsing service
  const parsingServiceResult = FrontmatterParsingService.create(fileSystem);
  if (parsingServiceResult.isError()) {
    return Result.error(
      new ProcessingError(
        `Failed to initialize parsing service: ${parsingServiceResult.unwrapError().message}`,
        "INITIALIZATION_ERROR",
        { error: parsingServiceResult.unwrapError() },
      ),
    );
  }

  const parsingService = parsingServiceResult.unwrap();

  // Use parseFrontmatter for string content (no file system access needed)
  const parseResult = parsingService.parseFrontmatter(markdown);
  if (parseResult.isError()) {
    return Result.error(
      new ProcessingError(
        `Failed to parse markdown: ${parseResult.unwrapError().message}`,
        "PARSE_ERROR",
        { error: parseResult.unwrapError() },
      ),
    );
  }

  const parsed = parseResult.unwrap();
  const rawFrontmatter = parsed.frontmatter ?? {};
  const body = parsed.content;

  // Apply schema directives if present
  const schemaProcessorResult = SchemaDirectiveProcessor.create(fileSystem);
  if (schemaProcessorResult.isError()) {
    return Result.error(
      new ProcessingError(
        `Failed to initialize schema processor: ${schemaProcessorResult.unwrapError().message}`,
        "INITIALIZATION_ERROR",
        { error: schemaProcessorResult.unwrapError() },
      ),
    );
  }

  const schemaProcessor = schemaProcessorResult.unwrap();
  const processResult = schemaProcessor.applySchemaDirectives(
    rawFrontmatter,
    schema,
  );

  if (processResult.isError()) {
    return Result.error(
      new ProcessingError(
        `Failed to process schema: ${processResult.unwrapError().message}`,
        "SCHEMA_ERROR",
        { error: processResult.unwrapError() },
      ),
    );
  }

  return Result.ok({
    data: processResult.unwrap(),
    rawFrontmatter,
    body,
  });
}

/**
 * Process markdown files according to schema and write output.
 *
 * This API handles file system operations internally and supports:
 * - Single file input
 * - Multiple file inputs (array)
 * - Directory input (recursive)
 * - Glob patterns
 *
 * @param options - Processing options including file paths
 * @returns Result containing processing summary or error
 *
 * @example
 * ```typescript
 * // Process single file
 * const result = await processFiles({
 *   schema: "./schema.json",
 *   input: "./article.md",
 *   output: "./output.json"
 * });
 *
 * // Process directory
 * const result = await processFiles({
 *   schema: "./schema.json",
 *   input: "./docs/",
 *   output: "./registry.yaml",
 *   format: "yaml"
 * });
 *
 * // Process multiple files
 * const result = await processFiles({
 *   schema: "./schema.json",
 *   input: ["./doc1.md", "./doc2.md"],
 *   output: "./combined.json"
 * });
 * ```
 */
export async function processFiles(
  options: ProcessFilesOptions,
): Promise<Result<ProcessFilesResult, ProcessingError>> {
  const fileSystem = DenoFileSystemAdapter.create();

  const orchestratorResult = PipelineOrchestrator.create(fileSystem);
  if (orchestratorResult.isError()) {
    return Result.error(orchestratorResult.unwrapError());
  }

  // Resolve template path from schema if not provided
  let templatePath = options.template;
  if (!templatePath) {
    const schemaContentResult = await fileSystem.readTextFile(options.schema);
    if (schemaContentResult.isOk()) {
      try {
        const schemaData = JSON.parse(schemaContentResult.unwrap());
        templatePath = schemaData["x-template"];
      } catch {
        // Ignore parse errors, will fail later with better message
      }
    }
  }

  if (!templatePath) {
    return Result.error(
      new ProcessingError(
        "Template path required. Either provide 'template' option or define 'x-template' in schema.",
        "CONFIGURATION_ERROR",
        { schema: options.schema },
      ),
    );
  }

  const config: PipelineConfig = {
    schemaPath: options.schema,
    templatePath,
    inputPath: options.input,
    outputPath: options.output,
    outputFormat: options.format ?? "json",
  };

  const result = await orchestratorResult.unwrap().execute(config);

  if (result.isError()) {
    return Result.error(result.unwrapError());
  }

  const pipelineResult = result.unwrap();
  return Result.ok({
    processedDocuments: pipelineResult.processedDocuments,
    outputPath: pipelineResult.outputPath,
    executionTime: pipelineResult.executionTime,
  });
}

/**
 * Run CLI with given arguments.
 *
 * This is equivalent to running the CLI from command line.
 * Useful for programmatic CLI invocation.
 *
 * @param args - Command line arguments
 * @returns Result indicating success or error
 *
 * @example
 * ```typescript
 * // Equivalent to: frontmatter-to-schema schema.json output.json ./docs/
 * const result = await run(["schema.json", "output.json", "./docs/"]);
 *
 * // With options
 * const result = await run(["schema.json", "output.json", "./docs/", "--verbose"]);
 * ```
 */
export async function run(
  args: string[],
): Promise<Result<unknown, ProcessingError>> {
  const cliResult = CLI.create();
  if (!cliResult.ok || !cliResult.data) {
    return Result.error(
      cliResult.error ??
        new ProcessingError("Failed to initialize CLI", "INITIALIZATION_ERROR"),
    );
  }

  const response = await cliResult.data.run(args);
  if (!response.ok) {
    return Result.error(
      response.error ??
        new ProcessingError("CLI execution failed", "CLI_ERROR"),
    );
  }

  return Result.ok(response.data);
}

/**
 * Create a reusable processor instance.
 *
 * Use this when processing multiple batches of files
 * to avoid repeated initialization overhead.
 *
 * @param options - Processor options
 * @returns Result containing processor instance or error
 *
 * @example
 * ```typescript
 * const processorResult = createProcessor();
 * if (processorResult.isError()) {
 *   throw processorResult.unwrapError();
 * }
 *
 * const processor = processorResult.unwrap();
 *
 * // Process multiple batches
 * await processor.processFiles({ ... });
 * await processor.processFiles({ ... });
 * ```
 */
export function createProcessor(
  options?: ProcessorOptions,
): Result<Processor, ProcessingError> {
  const fileSystem = options?.fileSystem
    ? (options.fileSystem as ReturnType<typeof DenoFileSystemAdapter.create>)
    : DenoFileSystemAdapter.create();

  const orchestratorResult = PipelineOrchestrator.create(fileSystem);
  if (orchestratorResult.isError()) {
    return Result.error(orchestratorResult.unwrapError());
  }

  return Result.ok(new Processor(orchestratorResult.unwrap(), fileSystem));
}

/**
 * Reusable processor instance for batch operations.
 */
export class Processor {
  constructor(
    private readonly orchestrator: PipelineOrchestrator,
    private readonly fileSystem: ReturnType<
      typeof DenoFileSystemAdapter.create
    >,
  ) {}

  /**
   * Process files with this processor instance.
   */
  async processFiles(
    options: Omit<ProcessFilesOptions, never>,
  ): Promise<Result<ProcessFilesResult, ProcessingError>> {
    let templatePath = options.template;
    if (!templatePath) {
      const schemaContentResult = await this.fileSystem.readTextFile(
        options.schema,
      );
      if (schemaContentResult.isOk()) {
        try {
          const schemaData = JSON.parse(schemaContentResult.unwrap());
          templatePath = schemaData["x-template"];
        } catch {
          // Ignore
        }
      }
    }

    if (!templatePath) {
      return Result.error(
        new ProcessingError(
          "Template path required. Either provide 'template' option or define 'x-template' in schema.",
          "CONFIGURATION_ERROR",
          { schema: options.schema },
        ),
      );
    }

    const config: PipelineConfig = {
      schemaPath: options.schema,
      templatePath,
      inputPath: options.input,
      outputPath: options.output,
      outputFormat: options.format ?? "json",
    };

    const result = await this.orchestrator.execute(config);
    if (result.isError()) {
      return Result.error(result.unwrapError());
    }

    const pipelineResult = result.unwrap();
    return Result.ok({
      processedDocuments: pipelineResult.processedDocuments,
      outputPath: pipelineResult.outputPath,
      executionTime: pipelineResult.executionTime,
    });
  }
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { Result } from "./domain/shared/types/result.ts";
export { ProcessingError } from "./domain/shared/types/errors.ts";
