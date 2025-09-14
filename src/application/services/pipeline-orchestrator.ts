import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, DomainError } from "../../domain/shared/types/errors.ts";
import { DocumentProcessingService } from "../../domain/frontmatter/services/document-processing-service.ts";
import { SchemaProcessingService } from "../../domain/schema/services/schema-processing-service.ts";
import { TemplateRenderer } from "../../domain/template/renderers/template-renderer.ts";
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
    private readonly documentProcessor: DocumentProcessingService,
    private readonly schemaProcessor: SchemaProcessingService,
    private readonly templateRenderer: TemplateRenderer,
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

    // Step 2: Determine template path (from config or schema)
    if (config.verbose) {
      console.log("[VERBOSE] Step 2: Resolving template path");
    }
    const templatePathResult = this.resolveTemplatePath(config, schema);
    if (!templatePathResult.ok) {
      return templatePathResult;
    }
    if (config.verbose) {
      console.log(
        "[VERBOSE] Template path resolved: " + templatePathResult.data,
      );
    }

    // Step 3: Load template
    if (config.verbose) {
      console.log("[VERBOSE] Step 3: Loading template");
    }
    const templateResult = await this.loadTemplate(templatePathResult.data);
    if (!templateResult.ok) {
      return templateResult;
    }
    const template = templateResult.data;
    if (config.verbose) {
      console.log("[VERBOSE] Template loaded successfully");
    }

    // Step 4: Process documents (成果A-D)
    if (config.verbose) {
      console.log(
        "[VERBOSE] Step 4: Processing documents with pattern: " +
          config.inputPattern,
      );
    }
    const validationRules = schema.getValidationRules();
    const processedDataResult = this.documentProcessor.processDocuments(
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

    // Step 5: Handle array expansion if x-frontmatter-part is present
    if (config.verbose) {
      console.log("[VERBOSE] Step 5: Rendering template with data");
    }
    const outputResult = this.renderWithArraySupport(
      template,
      processedDataResult.data,
      schema,
    );
    if (!outputResult.ok) {
      return outputResult;
    }
    if (config.verbose) {
      console.log("[VERBOSE] Template rendered successfully");
    }

    // Step 6: Write output (成果Z)
    if (config.verbose) {
      console.log("[VERBOSE] Step 6: Writing output to " + config.outputPath);
    }
    const writeResult = await Promise.resolve(
      this.fileSystem.write(config.outputPath, outputResult.data),
    );
    if (config.verbose && writeResult.ok) {
      console.log("[VERBOSE] Output written successfully");
    }
    return writeResult;
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
   * Resolve template path from config or schema
   */
  private resolveTemplatePath(
    config: PipelineConfig,
    schema: Schema,
  ): Result<string, DomainError & { message: string }> {
    // Prefer explicit template path from config
    if (config.templatePath) {
      return ok(config.templatePath);
    }

    // Try to get template path from schema's x-template attribute
    const schemaTemplateResult = schema.getTemplatePath();
    if (schemaTemplateResult.ok) {
      // Resolve relative to schema directory
      const lastSlash = config.schemaPath.lastIndexOf("/");
      const schemaDir = lastSlash > -1
        ? config.schemaPath.substring(0, lastSlash)
        : "."; // Use current directory if no path separator
      return ok(`${schemaDir}/${schemaTemplateResult.data}`);
    }

    return err(createError({
      kind: "TemplateNotDefined",
      message: "No template path specified in config or schema",
    }));
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
   * Render template with array expansion support
   */
  private renderWithArraySupport(
    template: Template,
    data: FrontmatterData,
    schema: Schema,
  ): Result<string, DomainError & { message: string }> {
    // Check if template contains {@items} pattern
    const templateContent = template.getContent();
    const hasArrayExpansion = this.containsArrayExpansion(templateContent);

    if (hasArrayExpansion) {
      // Get the frontmatter-part data
      const frontmatterPartResult = this.extractFrontmatterPartData(
        data,
        schema,
      );
      if (!frontmatterPartResult.ok) {
        return frontmatterPartResult;
      }

      // Render with array expansion
      return this.templateRenderer.renderWithArray(
        template,
        frontmatterPartResult.data,
      );
    }

    // Regular rendering without array expansion
    return this.templateRenderer.render(template, data);
  }

  /**
   * Check if template contains {@items} expansion pattern
   */
  private containsArrayExpansion(content: unknown): boolean {
    if (typeof content === "string") {
      return content.includes("{@items}");
    }
    if (Array.isArray(content)) {
      return content.some((item) => this.containsArrayExpansion(item));
    }
    if (content && typeof content === "object") {
      return Object.values(content as Record<string, unknown>).some(
        (value) => this.containsArrayExpansion(value),
      );
    }
    return false;
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
    // Check if schema has frontmatter-part definition
    const pathResult = schema.findFrontmatterPartPath();
    if (!pathResult.ok) {
      // No frontmatter-part defined, return data as single item array
      return ok([data]);
    }

    // For individual frontmatter processing: each file contributes one item
    // The frontmatter-part path (e.g., "tools.commands") indicates the target
    // location in the aggregated result, not the source location in individual files

    // Check if this data already contains an array at the frontmatter-part path
    // This handles cases where a single file contains multiple items
    const arrayDataResult = data.get(pathResult.data);
    if (arrayDataResult.ok && Array.isArray(arrayDataResult.data)) {
      // File contains array at target path - extract individual items
      const result: FrontmatterData[] = [];
      for (const item of arrayDataResult.data) {
        const itemDataResult = FrontmatterDataFactory.fromParsedData(item);
        if (!itemDataResult.ok) {
          return itemDataResult;
        }
        result.push(itemDataResult.data);
      }
      return ok(result);
    } else {
      // Default case: individual file contributes directly as one item
      // This is the typical scenario for frontmatter-part processing
      // Each markdown file's frontmatter becomes one item in the final array
      return ok([data]);
    }
  }
}
