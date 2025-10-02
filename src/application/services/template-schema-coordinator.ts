import { Result } from "../../domain/shared/types/result.ts";
import { ProcessingError } from "../../domain/shared/types/errors.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { SchemaTemplateResolver } from "../../domain/schema/services/schema-template-resolver.ts";
import { TemplateRenderer } from "../../domain/template/services/template-renderer.ts";
import { TemplatePath as SharedTemplatePath } from "../../domain/shared/value-objects/template-path.ts";
import { TemplatePath } from "../../domain/template/value-objects/template-path.ts";
import { Template } from "../../domain/template/entities/template.ts";
import { FileSystemPort } from "../../infrastructure/ports/file-system-port.ts";
import { createFileError } from "../../domain/shared/types/file-errors.ts";

/**
 * Template handoff context for coordination between domains
 */
export interface TemplateHandoffContext {
  readonly containerTemplate: SharedTemplatePath;
  readonly itemsTemplate: SharedTemplatePath | null;
  readonly schemaContext: SchemaContext;
}

export interface SchemaContext {
  readonly sourceSchema: Schema;
  readonly resolvedExtensions: Record<string, unknown>;
  readonly templateResolutionStrategy: TemplateResolutionStrategy;
}

export type TemplateResolutionStrategy = "absolute" | "relative";

export interface ProcessedOutput {
  readonly content: string;
  readonly metadata: {
    readonly templateUsed: string;
    readonly itemsTemplateUsed?: string;
    readonly itemCount?: number;
  };
}

/**
 * Cross-Domain Coordination Service
 *
 * Coordinates template processing between Schema and Template domains.
 * Handles the handoff mechanism for x-template-items functionality.
 */
export class TemplateSchemaCoordinator {
  constructor(
    private readonly templateRenderer: TemplateRenderer,
    private readonly schemaTemplateResolver: SchemaTemplateResolver,
    private readonly fileSystem: FileSystemPort,
  ) {}

  /**
   * Processes data with schema-defined templates
   *
   * 1. Extract template references from Schema Domain
   * 2. Load templates and pass to Template Domain
   * 3. Template Domain processes with schema context
   */
  async processWithSchemaTemplates(
    schema: Schema,
    data: FrontmatterData[],
  ): Promise<Result<ProcessedOutput, ProcessingError>> {
    try {
      // 1. Extract template references from Schema Domain
      const templateContextResult = this.schemaTemplateResolver
        .resolveTemplateContext(schema);

      if (templateContextResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Failed to resolve template context: ${templateContextResult.unwrapError().message}`,
            "TEMPLATE_CONTEXT_RESOLUTION_ERROR",
            {
              schema: schema.getPath(),
              error: templateContextResult.unwrapError(),
            },
          ),
        );
      }

      const templateContext = templateContextResult.unwrap();

      // Get schema directory for resolving relative template paths
      const schemaPath = schema.getPath().toString();
      const schemaDir = schemaPath.substring(0, schemaPath.lastIndexOf("/"));

      // 2. Load container template (resolve relative to schema directory)
      const containerTemplatePath = this.resolveTemplatePath(
        templateContext.containerTemplate.path,
        schemaDir,
      );
      const containerTemplate = await this.loadTemplate(containerTemplatePath);

      if (containerTemplate.isError()) {
        return Result.error(
          new ProcessingError(
            `Failed to load container template: ${containerTemplate.unwrapError().message}`,
            "CONTAINER_TEMPLATE_LOAD_ERROR",
            {
              templatePath: templateContext.containerTemplate.path,
              error: containerTemplate.unwrapError(),
            },
          ),
        );
      }

      // 3. Load items template if available (resolve relative to schema directory)
      let itemsTemplate: Template | null = null;
      if (templateContext.itemsTemplate) {
        const itemsTemplatePath = this.resolveTemplatePath(
          templateContext.itemsTemplate.path,
          schemaDir,
        );
        const itemsTemplateResult = await this.loadTemplate(itemsTemplatePath);

        if (itemsTemplateResult.isError()) {
          return Result.error(
            new ProcessingError(
              `Failed to load items template: ${itemsTemplateResult.unwrapError().message}`,
              "ITEMS_TEMPLATE_LOAD_ERROR",
              {
                templatePath: templateContext.itemsTemplate.path,
                error: itemsTemplateResult.unwrapError(),
              },
            ),
          );
        }

        itemsTemplate = itemsTemplateResult.unwrap();
      }

      // 4. Template Domain processes with schema context
      const renderResult = await this.templateRenderer.renderWithItems(
        containerTemplate.unwrap(),
        data,
        itemsTemplate,
      );

      if (renderResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Template rendering failed: ${renderResult.unwrapError().message}`,
            "TEMPLATE_RENDERING_ERROR",
            {
              containerTemplate: templateContext.containerTemplate.path,
              itemsTemplate: templateContext.itemsTemplate?.path,
              error: renderResult.unwrapError(),
            },
          ),
        );
      }

      const renderedContent = renderResult.unwrap();

      return Result.ok({
        content: renderedContent,
        metadata: {
          templateUsed: templateContext.containerTemplate.path,
          itemsTemplateUsed: templateContext.itemsTemplate?.path,
          itemCount: data.length,
        },
      });
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Template schema coordination failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "TEMPLATE_SCHEMA_COORDINATION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Resolves template path relative to schema directory
   *
   * If templatePath is already absolute (starts with /), returns as-is.
   * Otherwise, joins it with schemaDir.
   */
  private resolveTemplatePath(templatePath: string, schemaDir: string): string {
    // If path is already absolute, return as-is
    if (templatePath.startsWith("/")) {
      return templatePath;
    }

    // Resolve relative path from schema directory
    return `${schemaDir}/${templatePath}`;
  }

  /**
   * Loads a template from file path using FileSystemPort
   */
  private async loadTemplate(
    templatePath: string,
  ): Promise<Result<Template, ProcessingError>> {
    try {
      // Read template file
      const contentResult = await this.fileSystem.readTextFile(templatePath);
      if (contentResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Failed to read template file: ${
              createFileError(contentResult.unwrapError()).message
            }`,
            "TEMPLATE_READ_ERROR",
            { templatePath, error: contentResult.unwrapError() },
          ),
        );
      }

      // Parse template JSON
      let templateData: Record<string, unknown>;
      try {
        templateData = JSON.parse(contentResult.unwrap());
      } catch (parseError) {
        return Result.error(
          new ProcessingError(
            `Failed to parse template JSON: ${
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            }`,
            "TEMPLATE_PARSE_ERROR",
            { templatePath, error: parseError },
          ),
        );
      }

      // Create TemplatePath value object using template domain version
      const templatePathResult = TemplatePath.create(templatePath);
      if (templatePathResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Invalid template path: ${templatePathResult.unwrapError().message}`,
            "INVALID_TEMPLATE_PATH",
            { templatePath, error: templatePathResult.unwrapError() },
          ),
        );
      }

      // Create Template entity with proper TemplateData structure
      const templateDataFormatted = {
        content: templateData,
        format: "json" as const, // Templates are loaded as JSON
      };
      const templateResult = Template.create(
        templatePathResult.unwrap(),
        templateDataFormatted,
      );
      if (templateResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Failed to create template entity: ${templateResult.unwrapError().message}`,
            "TEMPLATE_CREATION_ERROR",
            { templatePath, error: templateResult.unwrapError() },
          ),
        );
      }

      return Result.ok(templateResult.unwrap());
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Template loading failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "TEMPLATE_LOAD_ERROR",
          { templatePath, error },
        ),
      );
    }
  }
}
