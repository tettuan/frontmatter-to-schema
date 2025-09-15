import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { FrontmatterTransformationService } from "../../domain/frontmatter/services/frontmatter-transformation-service.ts";
import { SchemaProcessingService } from "../../domain/schema/services/schema-processing-service.ts";
import { OutputRenderingService } from "../../domain/template/services/output-rendering-service.ts";
import { TemplatePathResolver } from "../../domain/template/services/template-path-resolver.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { Template } from "../../domain/template/entities/template.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../domain/frontmatter/factories/frontmatter-data-factory.ts";
import { SchemaPath } from "../../domain/schema/value-objects/schema-path.ts";
import { SchemaDefinition } from "../../domain/schema/value-objects/schema-definition.ts";
import { TemplatePath } from "../../domain/template/value-objects/template-path.ts";

/**
 * Configuration for pipeline processing
 */
export interface PipelineConfig {
  readonly inputPattern: string;
  readonly schemaPath: string;
  readonly outputPath: string;
  readonly templatePath?: string; // Optional, can be extracted from schema
  readonly verbose?: boolean; // Optional verbose logging flag
}

/**
 * File system interface for pipeline operations
 */
export interface FileSystem {
  read(
    path: string,
  ):
    | Promise<Result<string, DomainError & { message: string }>>
    | Result<string, DomainError & { message: string }>;
  write(
    path: string,
    content: string,
  ):
    | Promise<Result<void, DomainError & { message: string }>>
    | Result<void, DomainError & { message: string }>;
  list(
    pattern: string,
  ):
    | Promise<Result<string[], DomainError & { message: string }>>
    | Result<string[], DomainError & { message: string }>;
}

/**
 * Main pipeline orchestrator that coordinates the entire processing flow.
 * Implements the requirements from docs/requirements.ja.md
 *
 * Processing flow (成果A → 成果Z):
 * 1. List markdown files (成果A)
 * 2. Extract frontmatter (成果B)
 * 3. Parse with TypeScript (成果C)
 * 4. Convert to schema structure (成果D)
 * 5. Apply to template variables (成果E)
 * 6. Generate final output (成果Z)
 */
export class PipelineOrchestrator {
  constructor(
    private readonly frontmatterTransformer: FrontmatterTransformationService,
    private readonly schemaProcessor: SchemaProcessingService,
    private readonly outputRenderingService: OutputRenderingService,
    private readonly templatePathResolver: TemplatePathResolver,
    private readonly fileSystem: FileSystem,
  ) {}

  /**
   * Execute the complete pipeline processing
   */
  async execute(
    config: PipelineConfig,
  ): Promise<Result<void, DomainError & { message: string }>> {
    // Step 1: Load and process schema
    if (config.verbose) {
      console.log("[VERBOSE] Step 1: Loading schema from " + config.schemaPath);
    }
    const schemaResult = await this.loadSchema(config.schemaPath);
    if (!schemaResult.ok) {
      return schemaResult;
    }
    const schema = schemaResult.data;
    if (config.verbose) {
      console.log("[VERBOSE] Schema loaded successfully");
    }

    // Step 2: Resolve template paths using TemplatePathResolver
    if (config.verbose) {
      console.log("[VERBOSE] Step 2: Resolving template paths");
    }
    const templatePathConfig = {
      schemaPath: config.schemaPath,
      explicitTemplatePath: config.templatePath,
    };

    // DEBUG: Template path resolution decision points
    if (config.verbose) {
      console.log("[DEBUG] Template resolution inputs:", {
        hasExplicitTemplate: !!config.templatePath,
        schemaPath: config.schemaPath,
        templatePathConfig: JSON.stringify(templatePathConfig),
      });
    }

    const resolvePathsResult = this.templatePathResolver.resolveTemplatePaths(
      schema,
      templatePathConfig,
    );
    if (!resolvePathsResult.ok) {
      if (config.verbose) {
        console.log(
          "[DEBUG] Template path resolution FAILED:",
          resolvePathsResult.error,
        );
      }
      return resolvePathsResult;
    }
    const templatePath = resolvePathsResult.data.templatePath;
    const itemsTemplatePath = resolvePathsResult.data.itemsTemplatePath;
    const outputFormat = resolvePathsResult.data.outputFormat || "json";

    // DEBUG: Template path resolution results
    if (config.verbose) {
      console.log("[DEBUG] Template resolution results:", {
        templatePath,
        itemsTemplatePath,
        outputFormat,
        isDualTemplate: !!itemsTemplatePath,
        resolutionStrategy: config.templatePath ? "explicit" : "schema-derived",
      });
      console.log("[VERBOSE] Template path resolved: " + templatePath);
      if (itemsTemplatePath) {
        console.log(
          "[VERBOSE] Items template path resolved: " + itemsTemplatePath,
        );
      }
      console.log("[VERBOSE] Output format: " + outputFormat);
    }

    // Step 4: Process documents (成果A-D)
    if (config.verbose) {
      console.log(
        "[VERBOSE] Step 4: Processing documents with pattern: " +
          config.inputPattern,
      );
    }
    const validationRules = schema.getValidationRules();
    const processedDataResult = this.frontmatterTransformer.transformDocuments(
      config.inputPattern,
      validationRules,
      schema,
      config.verbose,
    );
    if (!processedDataResult.ok) {
      return processedDataResult;
    }
    if (config.verbose) {
      console.log("[VERBOSE] Documents processed successfully");
    }

    // Step 5: Extract items data if x-frontmatter-part is present
    if (config.verbose) {
      console.log("[VERBOSE] Step 5: Preparing data for rendering");
    }
    const mainData = processedDataResult.data;
    let itemsData: FrontmatterData[] | undefined;

    // DEBUG: Data preparation decision points
    const frontmatterPartPathResult = schema.findFrontmatterPartPath();
    if (config.verbose) {
      console.log("[DEBUG] Data preparation analysis:", {
        hasFrontmatterPart: frontmatterPartPathResult.ok,
        frontmatterPartPath: frontmatterPartPathResult.ok
          ? frontmatterPartPathResult.data
          : null,
        hasDualTemplate: !!itemsTemplatePath,
        mainDataKeys: Object.keys(mainData.getData()),
        mainDataSize: JSON.stringify(mainData.getData()).length,
      });
    }

    // Check if we need to extract items data
    // Extract frontmatter-part data ONLY if we have a separate items template
    // For single templates with {@items}, let the template handle the expansion
    // using the full mainData which includes base properties
    if (itemsTemplatePath) {
      if (config.verbose) {
        console.log(
          "[DEBUG] Dual template path - extracting frontmatter-part data",
        );
      }
      const frontmatterPartResult = this.extractFrontmatterPartData(
        mainData,
        schema,
      );
      if (!frontmatterPartResult.ok) {
        if (config.verbose) {
          console.log(
            "[DEBUG] Frontmatter-part extraction FAILED:",
            frontmatterPartResult.error,
          );
        }
      } else if (frontmatterPartResult.data.length > 0) {
        itemsData = frontmatterPartResult.data;
        if (config.verbose) {
          console.log("[DEBUG] Extracted frontmatter-part data:", {
            itemCount: itemsData.length,
            firstItemKeys: itemsData[0]
              ? Object.keys(itemsData[0].getData())
              : [],
            renderingStrategy: "dual-template",
          });
          console.log(
            "[VERBOSE] Extracted " + itemsData.length +
              " items for dual-template rendering",
          );
        }
      } else {
        if (config.verbose) {
          console.log(
            "[DEBUG] No frontmatter-part data found in dual template mode",
          );
        }
      }
    } else if (schema.findFrontmatterPartPath().ok) {
      // For single template with frontmatter-part, keep itemsData undefined
      // The template renderer will extract the array data from mainData during {@items} expansion
      if (config.verbose) {
        console.log("[DEBUG] Single template with frontmatter-part:", {
          renderingStrategy: "single-template-with-items-expansion",
          frontmatterPartPath: frontmatterPartPathResult.ok
            ? frontmatterPartPathResult.data
            : "unknown",
        });
        console.log(
          "[VERBOSE] Single template with frontmatter-part detected - will use mainData for {@items} expansion",
        );
      }
    } else {
      if (config.verbose) {
        console.log(
          "[DEBUG] Standard single template rendering - no frontmatter-part processing",
        );
      }
    }

    // Step 6: Use OutputRenderingService to render and write output
    if (config.verbose) {
      console.log("[VERBOSE] Step 6: Rendering and writing output");
    }
    const renderResult = this.outputRenderingService.renderOutput(
      templatePath,
      itemsTemplatePath,
      mainData,
      itemsData,
      config.outputPath,
      outputFormat,
    );
    if (config.verbose && renderResult.ok) {
      console.log(
        "[VERBOSE] Output written successfully to " + config.outputPath,
      );
    }
    return renderResult;
  }

  /**
   * Load schema from file system
   */
  private async loadSchema(
    schemaPath: string,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    // Read schema file
    const contentResult = await Promise.resolve(
      this.fileSystem.read(schemaPath),
    );
    if (!contentResult.ok) {
      return contentResult;
    }

    try {
      const schemaData = JSON.parse(contentResult.data);

      // Create schema path
      const pathResult = SchemaPath.create(schemaPath);
      if (!pathResult.ok) {
        return pathResult;
      }

      // Create schema definition
      const definitionResult = SchemaDefinition.create(schemaData);
      if (!definitionResult.ok) {
        return definitionResult;
      }

      // Create schema entity
      return Schema.create(pathResult.data, definitionResult.data);
    } catch (error) {
      return err(createError({
        kind: "InvalidSchema",
        message: `Failed to parse schema: ${error}`,
      }));
    }
  }

  /**
   * Load template from file system
   */
  private async loadTemplate(
    templatePath: string,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    // Read template file
    const contentResult = await Promise.resolve(
      this.fileSystem.read(templatePath),
    );
    if (!contentResult.ok) {
      return contentResult;
    }

    // Determine format from extension
    const format = this.getTemplateFormat(templatePath);

    // Create template path
    const pathResult = TemplatePath.create(templatePath);
    if (!pathResult.ok) {
      return pathResult;
    }

    // Parse template content based on format
    let templateData: unknown;
    try {
      if (format === "json") {
        templateData = JSON.parse(contentResult.data);
      } else if (format === "yaml") {
        // For YAML, keep as string for now (would need YAML parser)
        templateData = contentResult.data;
      } else {
        templateData = contentResult.data;
      }
    } catch (error) {
      return err(createError({
        kind: "InvalidTemplate",
        message: `Failed to parse template: ${error}`,
      }));
    }

    // Create template entity
    return Template.create(pathResult.data, templateData);
  }

  /**
   * Determine template format from file extension
   */
  private getTemplateFormat(path: string): "json" | "yaml" | "markdown" {
    if (path.endsWith(".json")) return "json";
    if (path.endsWith(".yml") || path.endsWith(".yaml")) return "yaml";
    return "markdown";
  }

  /**
   * Extract frontmatter-part data as array for {@items} expansion.
   *
   * Key insight: frontmatter-part path in schema indicates where aggregated
   * data will be placed in final output, NOT where it exists in individual files.
   * Individual markdown files contribute directly to the array items.
   */
  private extractFrontmatterPartData(
    data: FrontmatterData,
    schema: Schema,
  ): Result<FrontmatterData[], DomainError & { message: string }> {
    // DEBUG: Start of frontmatter-part extraction
    console.log(
      "[DEBUG] extractFrontmatterPartData called with data keys:",
      Object.keys(data.getData()),
    );

    // Check if schema has frontmatter-part definition
    const pathResult = schema.findFrontmatterPartPath();
    if (!pathResult.ok) {
      // No frontmatter-part defined, return data as single item array
      console.log(
        "[DEBUG] No frontmatter-part path found - returning single item array",
      );
      return ok([data]);
    }

    const frontmatterPartPath = pathResult.data;
    console.log("[DEBUG] Frontmatter-part path found:", frontmatterPartPath);

    // For individual frontmatter processing: each file contributes one item
    // The frontmatter-part path (e.g., "tools.commands") indicates the target
    // location in the aggregated result, not the source location in individual files

    // Check if this data already contains an array at the frontmatter-part path
    // This handles cases where a single file contains multiple items
    const arrayDataResult = data.get(frontmatterPartPath);
    console.log("[DEBUG] Attempting to get data at path:", {
      path: frontmatterPartPath,
      success: arrayDataResult.ok,
      isArray: arrayDataResult.ok ? Array.isArray(arrayDataResult.data) : false,
      arrayLength: arrayDataResult.ok && Array.isArray(arrayDataResult.data)
        ? arrayDataResult.data.length
        : 0,
    });

    if (arrayDataResult.ok && Array.isArray(arrayDataResult.data)) {
      // File contains array at target path - extract individual items
      console.log(
        "[DEBUG] Processing array data with",
        arrayDataResult.data.length,
        "items",
      );
      const result: FrontmatterData[] = [];
      for (let i = 0; i < arrayDataResult.data.length; i++) {
        const item = arrayDataResult.data[i];
        console.log(
          "[DEBUG] Processing array item",
          i,
          "with keys:",
          typeof item === "object" && item ? Object.keys(item) : "not-object",
        );
        const itemDataResult = FrontmatterDataFactory.fromParsedData(item);
        if (!itemDataResult.ok) {
          console.log(
            "[DEBUG] Failed to create FrontmatterData from array item",
            i,
            ":",
            itemDataResult.error,
          );
          return itemDataResult;
        }
        result.push(itemDataResult.data);
      }
      console.log(
        "[DEBUG] Successfully extracted",
        result.length,
        "items from array",
      );
      return ok(result);
    } else {
      // Default case: individual file contributes directly as one item
      // This is the typical scenario for frontmatter-part processing
      // Each markdown file's frontmatter becomes one item in the final array
      console.log(
        "[DEBUG] Using fallback: returning input data as single item array",
      );
      return ok([data]);
    }
  }
}
