import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

/**
 * Template rendering service for processing templates with data
 * Handles both single template rendering and items template processing
 */
export class TemplateRenderer {
  private constructor() {}

  /**
   * Creates a TemplateRenderer instance
   */
  static create(): Result<TemplateRenderer, TemplateError> {
    return Result.ok(new TemplateRenderer());
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
   */
  renderWithItems(
    containerTemplate: Template,
    data: FrontmatterData[],
    _itemsTemplate?: unknown,
  ): Result<string, TemplateError> {
    try {
      // For now, this is a simplified implementation
      // In a full implementation, this would:
      // 1. Process the items template with each data item
      // 2. Combine the results
      // 3. Apply the container template

      // Convert data array to combined object
      const plainObjects = data.map((item) => item.getData());
      const combinedData = {
        items: plainObjects,
        // For single item compatibility
        ...(plainObjects.length > 0 ? plainObjects[0] : {}),
      };

      // Use Template entity's resolveVariables() instead of duplicate logic
      const resolvedTemplate = containerTemplate.resolveVariables(combinedData);

      if (resolvedTemplate.isError()) {
        return Result.error(
          new TemplateError(
            `Template variable resolution failed: ${resolvedTemplate.unwrapError().message}`,
            "TEMPLATE_RESOLUTION_ERROR",
            {
              template: containerTemplate.getPath().toString(),
              data: combinedData,
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
