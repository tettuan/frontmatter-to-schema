import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { ItemsProcessingContext, ItemsProcessor } from "./items-processor.ts";

/**
 * Template rendering service for processing templates with data
 * Handles both single template rendering and items template processing
 */
export class TemplateRenderer {
  private constructor(private readonly itemsProcessor?: ItemsProcessor) {}

  /**
   * Creates a TemplateRenderer instance with optional ItemsProcessor for {@items} expansion
   */
  static create(
    itemsProcessor?: ItemsProcessor,
  ): Result<TemplateRenderer, TemplateError> {
    return Result.ok(new TemplateRenderer(itemsProcessor));
  }

  /**
   * Renders a template with data
   */
  render(
    template: Template,
    data: FrontmatterData,
    schema?: Record<string, unknown>,
  ): Result<string, TemplateError> {
    try {
      const frontmatterObj = data.getData();
      const resolvedTemplate = template.resolveVariables(
        frontmatterObj,
        schema,
      );

      if (resolvedTemplate.isError()) {
        return Result.error(
          new TemplateError(
            `Template variable resolution failed: ${resolvedTemplate.unwrapError().message}`,
            "TEMPLATE_RESOLUTION_ERROR",
            { template: template.getPath().toString(), data: frontmatterObj },
          ),
        );
      }

      return Result.ok(
        JSON.stringify(resolvedTemplate.unwrap().getContent(), null, 2),
      );
    } catch (error) {
      return Result.error(
        new TemplateError(
          `Template rendering failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "TEMPLATE_RENDERING_ERROR",
          { template: template.getPath().toString(), error },
        ),
      );
    }
  }

  /**
   * Renders a template with array data, handling items template processing
   */
  renderWithArray(
    template: Template,
    dataArray: FrontmatterData[],
    schema?: Record<string, unknown>,
  ): Result<string, TemplateError> {
    try {
      // Convert array of FrontmatterData to plain objects
      const plainObjects = dataArray.map((data) => data.getData());

      // Create combined data object for template processing
      const combinedData = {
        items: plainObjects,
        // Include first item's data at root level for compatibility
        ...(plainObjects.length > 0 ? plainObjects[0] : {}),
      };

      const resolvedTemplate = template.resolveVariables(combinedData, schema);

      if (resolvedTemplate.isError()) {
        return Result.error(
          new TemplateError(
            `Template variable resolution failed: ${resolvedTemplate.unwrapError().message}`,
            "TEMPLATE_RESOLUTION_ERROR",
            {
              template: template.getPath().toString(),
              dataArray: plainObjects,
            },
          ),
        );
      }

      return Result.ok(
        JSON.stringify(resolvedTemplate.unwrap().getContent(), null, 2),
      );
    } catch (error) {
      return Result.error(
        new TemplateError(
          `Template rendering with array failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "TEMPLATE_ARRAY_RENDERING_ERROR",
          { template: template.getPath().toString(), error },
        ),
      );
    }
  }

  /**
   * Renders with items template support
   * This method coordinates between container and items templates
   * If ItemsProcessor is available and itemsTemplate is provided, performs {@items} expansion
   */
  async renderWithItems(
    containerTemplate: Template,
    data: FrontmatterData[],
    itemsTemplate?: Template | null,
    frontmatterPartProperty?: string | null,
    containerProperties?: string[],
  ): Promise<Result<string, TemplateError>> {
    try {
      // Convert data array to plain objects
      const plainObjects = data.map((item) => item.getData());

      // Extract array data for items processing
      // If frontmatterPartProperty is specified, extract and aggregate those arrays
      let arrayData: unknown[];
      if (frontmatterPartProperty) {
        arrayData = plainObjects.flatMap((obj) => {
          const value = obj[frontmatterPartProperty];
          return Array.isArray(value) ? value : [];
        });
      } else {
        // Fallback: use entire data objects
        arrayData = plainObjects;
      }

      // Extract container-level properties from ALL frontmatter files
      // Try to find these values in any file, preferring first occurrence
      const containerData: Record<string, unknown> = {};
      if (
        containerProperties && containerProperties.length > 0 &&
        plainObjects.length > 0
      ) {
        for (const propName of containerProperties) {
          // Search through all files to find this property
          for (const obj of plainObjects) {
            if (propName in obj) {
              containerData[propName] = obj[propName];
              break; // Use first occurrence
            }
          }
        }
      }

      // Container-level context (should NOT include item data)
      // Only container-level properties should be here (version, description, etc.)
      const containerContext = {
        ...containerData,
        items: arrayData,
      };

      // If ItemsProcessor is available and itemsTemplate provided, use it for {@items} expansion
      if (this.itemsProcessor && itemsTemplate) {
        const processingContext: ItemsProcessingContext = {
          containerTemplate,
          itemsTemplateRef: ItemsProcessor.createTemplateReference(
            itemsTemplate.getPath().toString(),
          ),
          arrayData,
          globalVariables: containerContext,
        };

        const processingResult = await this.itemsProcessor.processItems(
          processingContext,
        );

        if (processingResult.isError()) {
          return Result.error(processingResult.unwrapError());
        }

        const processed = processingResult.unwrap();
        const templateToRender = processed.wasExpanded
          ? processed.processedTemplate
          : containerTemplate;

        // Resolve variables in the processed template
        const resolvedTemplate = templateToRender.resolveVariables(
          containerContext,
        );

        if (resolvedTemplate.isError()) {
          return Result.error(
            new TemplateError(
              `Template variable resolution failed: ${resolvedTemplate.unwrapError().message}`,
              "TEMPLATE_RESOLUTION_ERROR",
              {
                template: templateToRender.getPath().toString(),
                data: containerContext,
              },
            ),
          );
        }

        return Result.ok(
          JSON.stringify(resolvedTemplate.unwrap().getContent(), null, 2),
        );
      }

      // Fallback: No ItemsProcessor or no itemsTemplate - use simple variable resolution
      const resolvedTemplate = containerTemplate.resolveVariables(
        containerContext,
      );

      if (resolvedTemplate.isError()) {
        return Result.error(
          new TemplateError(
            `Template variable resolution failed: ${resolvedTemplate.unwrapError().message}`,
            "TEMPLATE_RESOLUTION_ERROR",
            {
              template: containerTemplate.getPath().toString(),
              data: containerContext,
            },
          ),
        );
      }

      return Result.ok(
        JSON.stringify(resolvedTemplate.unwrap().getContent(), null, 2),
      );
    } catch (error) {
      return Result.error(
        new TemplateError(
          `Render with items failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "RENDER_WITH_ITEMS_ERROR",
          { error },
        ),
      );
    }
  }
}
