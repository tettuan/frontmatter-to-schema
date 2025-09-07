/**
 * Process Documents Use Case
 *
 * Application layer use case implementing the two-phase processing pipeline:
 * Phase 1: Process individual Markdown files
 * Phase 2: Aggregate results and apply derivation rules
 */

import type { Result } from "../domain/core/result.ts";
import { SchemaRefResolver } from "../domain/config/schema-ref-resolver.ts";
import { FrontmatterExtractor } from "../domain/services/frontmatter-extractor-v2.ts";
import {
  AggregationContext,
  AggregationService,
  createExpressionEvaluator,
} from "../domain/aggregation/index.ts";
import type { SchemaTemplateInfo } from "../domain/models/schema-extensions.ts";
import { expandGlob } from "jsr:@std/fs@1.0.8/expand-glob";
import * as path from "jsr:@std/path@1.0.9";
import * as yaml from "jsr:@std/yaml@1.0.9";
import * as toml from "jsr:@std/toml@1.0.1";

/**
 * Use case input parameters
 */
export interface ProcessDocumentsInput {
  schemaPath: string;
  outputPath: string;
  inputPattern: string;
  outputFormat: "json" | "yaml" | "toml";
}

/**
 * Use case output result
 */
export interface ProcessDocumentsOutput {
  processedCount: number;
  outputPath: string;
  warnings?: string[];
}

/**
 * Use case configuration options
 */
export interface ProcessDocumentsOptions {
  verbose?: boolean;
  dryRun?: boolean;
  parallel?: boolean;
  maxWorkers?: number;
}

/**
 * Process Documents Use Case
 */
export class ProcessDocumentsUseCase {
  private readonly schemaResolver: SchemaRefResolver;
  private readonly frontmatterExtractor: FrontmatterExtractor;
  private readonly aggregationService: AggregationService;

  constructor(private readonly options: ProcessDocumentsOptions = {}) {
    this.schemaResolver = new SchemaRefResolver(
      path.dirname(options.dryRun ? "." : "."),
    );
    this.frontmatterExtractor = new FrontmatterExtractor();
    this.aggregationService = new AggregationService(
      createExpressionEvaluator(),
    );
  }

  /**
   * Execute the use case
   */
  async execute(
    input: ProcessDocumentsInput,
  ): Promise<
    Result<
      ProcessDocumentsOutput,
      { kind: string; message: string; details?: unknown }
    >
  > {
    const warnings: string[] = [];

    try {
      // Phase 0: Load and resolve schema
      if (this.options.verbose) {
        console.log(`Loading schema from: ${input.schemaPath}`);
      }

      const schemaResult = await this.loadAndResolveSchema(input.schemaPath);
      if (!schemaResult.ok) {
        return schemaResult;
      }

      const { schema, templateInfo } = schemaResult.data;

      // Phase 1: Process individual Markdown files
      if (this.options.verbose) {
        console.log(`Scanning for files matching: ${input.inputPattern}`);
      }

      const filesResult = await this.findMarkdownFiles(input.inputPattern);
      if (!filesResult.ok) {
        return filesResult;
      }

      const files = filesResult.data;
      if (files.length === 0) {
        return {
          ok: false,
          error: {
            kind: "NoFilesFound",
            message: `No files found matching pattern: ${input.inputPattern}`,
          },
        };
      }

      if (this.options.verbose) {
        console.log(`Found ${files.length} files to process`);
      }

      // Process each file
      const processedData: unknown[] = [];
      const processingErrors: string[] = [];

      for (const file of files) {
        if (this.options.verbose) {
          console.log(`Processing: ${file}`);
        }

        const result = await this.processMarkdownFile(file, schema);
        if (result.ok) {
          processedData.push(result.data);
        } else {
          const errorMsg = `${file}: ${result.error.message}`;
          if (this.options.verbose) {
            console.warn(errorMsg);
          }
          processingErrors.push(errorMsg);
        }
      }

      if (processedData.length === 0) {
        return {
          ok: false,
          error: {
            kind: "ProcessingFailed",
            message: "No files could be processed successfully",
            details: processingErrors,
          },
        };
      }

      warnings.push(...processingErrors);

      // Phase 2: Aggregate and apply derivation rules
      if (this.options.verbose) {
        console.log("Applying aggregation and derivation rules");
      }

      const finalResult = this.aggregateResults(
        processedData,
        templateInfo,
        schema,
      );

      if (!finalResult.ok) {
        return finalResult;
      }

      // Phase 3: Write output
      if (!this.options.dryRun) {
        const writeResult = await this.writeOutput(
          finalResult.data,
          input.outputPath,
          input.outputFormat,
        );

        if (!writeResult.ok) {
          return writeResult;
        }
      } else if (this.options.verbose) {
        console.log(
          "Dry-run mode: Output would be written to",
          input.outputPath,
        );
        console.log(
          "Output preview:",
          JSON.stringify(finalResult.data, null, 2).substring(0, 500),
        );
      }

      return {
        ok: true,
        data: {
          processedCount: processedData.length,
          outputPath: input.outputPath,
          warnings: warnings.length > 0 ? warnings : undefined,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "UnexpectedError",
          message: error instanceof Error ? error.message : String(error),
          details: error,
        },
      };
    }
  }

  /**
   * Load and resolve schema with $ref resolution
   */
  private async loadAndResolveSchema(
    schemaPath: string,
  ): Promise<
    Result<{
      schema: unknown;
      templateInfo: SchemaTemplateInfo;
    }, { kind: string; message: string }>
  > {
    try {
      // Read schema file
      const schemaContent = await Deno.readTextFile(schemaPath);
      const rawSchema = JSON.parse(schemaContent);

      // Set base path for $ref resolution
      const basePath = path.dirname(schemaPath);
      const resolver = new SchemaRefResolver(basePath);

      // Resolve and extract template info
      const result = await resolver.resolveAndExtractTemplateInfo(rawSchema);
      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        data: {
          schema: result.data.resolved,
          templateInfo: result.data.templateInfo,
        },
      };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: {
            kind: "FileNotFound",
            message: `Schema file not found: ${schemaPath}`,
          },
        };
      }

      if (error instanceof SyntaxError) {
        return {
          ok: false,
          error: {
            kind: "ParseError",
            message: `Invalid JSON in schema file: ${error.message}`,
          },
        };
      }

      return {
        ok: false,
        error: {
          kind: "SchemaLoadError",
          message: `Failed to load schema: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  }

  /**
   * Find Markdown files matching the input pattern
   */
  private async findMarkdownFiles(
    pattern: string,
  ): Promise<Result<string[], { kind: string; message: string }>> {
    try {
      const files: string[] = [];

      for await (const entry of expandGlob(pattern)) {
        if (entry.isFile && entry.path.endsWith(".md")) {
          files.push(entry.path);
        }
      }

      return { ok: true, data: files };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "GlobError",
          message: `Failed to scan files: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  }

  /**
   * Process a single Markdown file
   */
  private async processMarkdownFile(
    filePath: string,
    _schema: unknown,
  ): Promise<Result<unknown, { kind: string; message: string }>> {
    try {
      // Read file content
      const content = await Deno.readTextFile(filePath);

      // Extract frontmatter
      const extractResult = this.frontmatterExtractor.extract(content);
      if (!extractResult.ok) {
        return {
          ok: false,
          error: {
            kind: "FrontmatterExtractionFailed",
            message: extractResult.error.message,
          },
        };
      }

      // Parse frontmatter based on format
      const frontmatter = extractResult.data;
      let parsed: unknown;

      try {
        switch (frontmatter.format) {
          case "yaml":
            parsed = yaml.parse(frontmatter.content);
            break;
          case "json":
            parsed = JSON.parse(frontmatter.content);
            break;
          case "toml":
            parsed = toml.parse(frontmatter.content);
            break;
          default:
            return {
              ok: false,
              error: {
                kind: "UnsupportedFormat",
                message:
                  `Unsupported frontmatter format: ${frontmatter.format}`,
              },
            };
        }
      } catch (parseError) {
        return {
          ok: false,
          error: {
            kind: "ParseError",
            message: `Failed to parse frontmatter: ${
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            }`,
          },
        };
      }

      // TODO: Validate against schema (requires schema validator implementation)
      // For now, return the parsed data with file metadata
      return {
        ok: true,
        data: {
          ...parsed as Record<string, unknown>,
          _metadata: {
            filePath,
            format: frontmatter.format,
          },
        },
      };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: {
            kind: "FileNotFound",
            message: `File not found: ${filePath}`,
          },
        };
      }

      return {
        ok: false,
        error: {
          kind: "ProcessingError",
          message: `Failed to process file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  }

  /**
   * Aggregate results and apply derivation rules
   */
  private aggregateResults(
    data: unknown[],
    templateInfo: SchemaTemplateInfo,
    schema: unknown,
  ): Result<unknown, { kind: string; message: string }> {
    // Extract derivation rules from schema
    const rulesResult = this.aggregationService.extractRulesFromSchema(
      schema as Record<string, unknown>,
    );

    let aggregatedData: Record<string, unknown> = {};

    if (rulesResult.ok && rulesResult.data.length > 0) {
      // Create aggregation context
      const context = AggregationContext.create(rulesResult.data);

      // Execute aggregation
      const aggregateResult = this.aggregationService.aggregate(data, context);
      if (!aggregateResult.ok) {
        return aggregateResult;
      }

      // Apply aggregated data
      aggregatedData = this.aggregationService.applyAggregatedData(
        {},
        aggregateResult.data,
      );
    }

    // Combine with individual items
    const result = {
      ...aggregatedData,
      items: data,
    };

    // Handle x-frontmatter-part if present
    if (templateInfo.getIsFrontmatterPart()) {
      // Find the array property marked with x-frontmatter-part
      const schemaObj = schema as Record<string, unknown>;
      if (schemaObj.properties) {
        for (
          const [key, prop] of Object.entries(
            schemaObj.properties as Record<string, unknown>,
          )
        ) {
          if (
            prop && typeof prop === "object" &&
            (prop as Record<string, unknown>)["x-frontmatter-part"] === true
          ) {
            (result as Record<string, unknown>)[key] = data;
            delete (result as Record<string, unknown>).items;
            break;
          }
        }
      }
    }

    return { ok: true, data: result };
  }

  /**
   * Write output to file in the specified format
   */
  private async writeOutput(
    data: unknown,
    outputPath: string,
    format: "json" | "yaml" | "toml",
  ): Promise<Result<void, { kind: string; message: string }>> {
    try {
      let content: string;

      switch (format) {
        case "json":
          content = JSON.stringify(data, null, 2);
          break;
        case "yaml":
          content = yaml.stringify(data);
          break;
        case "toml":
          content = toml.stringify(data as Record<string, unknown>);
          break;
        default:
          return {
            ok: false,
            error: {
              kind: "UnsupportedFormat",
              message: `Unsupported output format: ${format}`,
            },
          };
      }

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      if (dir && dir !== ".") {
        await Deno.mkdir(dir, { recursive: true });
      }

      // Write file
      await Deno.writeTextFile(outputPath, content);

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "WriteError",
          message: `Failed to write output: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      };
    }
  }
}
