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
 * import { transformMarkdown, transformFiles } from "jsr:@aidevtool/frontmatter-to-schema";
 *
 * // Transform markdown string directly
 * const result = transformMarkdown({
 *   markdown: "---\ntitle: Hello\n---\nContent",
 *   schema: { type: "object", properties: { title: { type: "string" } } }
 * });
 *
 * // Transform files
 * const fileResult = await transformFiles({
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
export type OutputTemplate = Record<string, unknown>;

/**
 * Options for markdown transformation
 */
export interface TransformMarkdownOptions {
  /** Raw markdown content with YAML frontmatter */
  readonly markdown: string;
  /** JSON Schema defining the output structure */
  readonly schema: JsonSchema;
  /** Optional template for output formatting */
  readonly template?: OutputTemplate;
}

/**
 * Result of markdown transformation
 */
export interface TransformMarkdownResult {
  /** Extracted and transformed frontmatter data */
  readonly data: Record<string, unknown>;
  /** Original frontmatter before transformation */
  readonly rawFrontmatter: Record<string, unknown>;
  /** Markdown body content (without frontmatter) */
  readonly body: string;
}

/**
 * Options for file-based transformation
 */
export interface TransformFilesOptions {
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
 * Result of file transformation
 */
export interface TransformFilesResult {
  /** Number of documents processed */
  readonly processedDocuments: number;
  /** Path to output file */
  readonly outputPath: string;
  /** Execution time in milliseconds */
  readonly executionTime: number;
}

/**
 * Options for creating a transformer instance
 */
export interface TransformerOptions {
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
 * Transform a single markdown string and extract frontmatter according to schema.
 *
 * This is the simplest API for transforming markdown content directly
 * without file system operations.
 *
 * @param options - Transformation options including markdown content and schema
 * @returns Result containing transformed data or error
 *
 * @example
 * ```typescript
 * const result = transformMarkdown({
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
export function transformMarkdown(
  options: TransformMarkdownOptions,
): Result<TransformMarkdownResult, ProcessingError> {
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
 * Transform markdown files according to schema and write output.
 *
 * This API handles file system operations internally and supports:
 * - Single file input
 * - Multiple file inputs (array)
 * - Directory input (recursive)
 * - Glob patterns
 *
 * @param options - Transformation options including file paths
 * @returns Result containing transformation summary or error
 *
 * @example
 * ```typescript
 * // Transform single file
 * const result = await transformFiles({
 *   schema: "./schema.json",
 *   input: "./article.md",
 *   output: "./output.json"
 * });
 *
 * // Transform directory
 * const result = await transformFiles({
 *   schema: "./schema.json",
 *   input: "./docs/",
 *   output: "./registry.yaml",
 *   format: "yaml"
 * });
 *
 * // Transform multiple files
 * const result = await transformFiles({
 *   schema: "./schema.json",
 *   input: ["./doc1.md", "./doc2.md"],
 *   output: "./combined.json"
 * });
 * ```
 */
export async function transformFiles(
  options: TransformFilesOptions,
): Promise<Result<TransformFilesResult, ProcessingError>> {
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
 * const result = await runCLI(["schema.json", "output.json", "./docs/"]);
 *
 * // With options
 * const result = await runCLI(["schema.json", "output.json", "./docs/", "--verbose"]);
 * ```
 */
export async function runCLI(
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
 * Create a reusable transformer instance.
 *
 * Use this when transforming multiple batches of files
 * to avoid repeated initialization overhead.
 *
 * @param options - Transformer options
 * @returns Result containing transformer instance or error
 *
 * @example
 * ```typescript
 * const transformerResult = createTransformer();
 * if (transformerResult.isError()) {
 *   throw transformerResult.unwrapError();
 * }
 *
 * const transformer = transformerResult.unwrap();
 *
 * // Transform multiple batches
 * await transformer.transformFiles({ ... });
 * await transformer.transformFiles({ ... });
 * ```
 */
export function createTransformer(
  options?: TransformerOptions,
): Result<Transformer, ProcessingError> {
  const fileSystem = options?.fileSystem
    ? (options.fileSystem as ReturnType<typeof DenoFileSystemAdapter.create>)
    : DenoFileSystemAdapter.create();

  const orchestratorResult = PipelineOrchestrator.create(fileSystem);
  if (orchestratorResult.isError()) {
    return Result.error(orchestratorResult.unwrapError());
  }

  return Result.ok(new Transformer(orchestratorResult.unwrap(), fileSystem));
}

/**
 * Reusable transformer instance for batch operations.
 */
export class Transformer {
  constructor(
    private readonly orchestrator: PipelineOrchestrator,
    private readonly fileSystem: ReturnType<
      typeof DenoFileSystemAdapter.create
    >,
  ) {}

  /**
   * Transform files with this transformer instance.
   */
  async transformFiles(
    options: Omit<TransformFilesOptions, never>,
  ): Promise<Result<TransformFilesResult, ProcessingError>> {
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
export { ProcessingError as TransformError } from "./domain/shared/types/errors.ts";
