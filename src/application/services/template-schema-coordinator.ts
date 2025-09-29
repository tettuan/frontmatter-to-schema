import { Result } from "../../domain/shared/types/result.ts";
import { ProcessingError } from "../../domain/shared/types/errors.ts";
import { Schema } from "../../domain/schema/entities/schema.ts";
import { FrontmatterData } from "../../domain/frontmatter/value-objects/frontmatter-data.ts";
import { SchemaTemplateResolver } from "../../domain/schema/services/schema-template-resolver.ts";
import { TemplateRenderer } from "../../domain/template/services/template-renderer.ts";
import { TemplatePath } from "../../domain/shared/value-objects/template-path.ts";

/**
 * Template handoff context for coordination between domains
 */
export interface TemplateHandoffContext {
  readonly containerTemplate: TemplatePath;
  readonly itemsTemplate: TemplatePath | null;
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
  ) {}

  /**
   * Processes data with schema-defined templates
   *
   * 1. Extract template references from Schema Domain
   * 2. Load templates and pass to Template Domain
   * 3. Template Domain processes with schema context
   */
  processWithSchemaTemplates(
    schema: Schema,
    data: FrontmatterData[],
  ): Result<ProcessedOutput, ProcessingError> {
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

      // 2. Load container template
      const containerTemplate = this.loadTemplate(
        templateContext.containerTemplate.path,
      );

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

      // 3. Load items template if available
      let itemsTemplate = null;
      if (templateContext.itemsTemplate) {
        const itemsTemplateResult = this.loadTemplate(
          templateContext.itemsTemplate.path,
        );

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
      const renderResult = this.templateRenderer.renderWithItems(
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
   * Loads a template from file path
   * TODO: This should delegate to proper template loading service
   */
  private loadTemplate(
    templatePath: string,
  ): Result<unknown, ProcessingError> {
    // For now, return a simple implementation
    // This should be replaced with proper template loading logic
    try {
      // Placeholder implementation - should load actual template
      return Result.ok({
        path: templatePath,
        content: "{}",
      });
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to load template at ${templatePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "TEMPLATE_LOAD_ERROR",
          { templatePath, error },
        ),
      );
    }
  }
}
