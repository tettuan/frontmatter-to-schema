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
    containerTemplate: unknown,
    data: FrontmatterData[],
    _itemsTemplate?: unknown,
  ): Result<string, TemplateError> {
    try {
      // For now, this is a simplified implementation
      // In a full implementation, this would:
      // 1. Process the items template with each data item
      // 2. Combine the results
      // 3. Apply the container template

      if (!containerTemplate || typeof containerTemplate !== "object") {
        return Result.error(
          new TemplateError(
            "Invalid container template provided",
            "INVALID_CONTAINER_TEMPLATE",
            { containerTemplate },
          ),
        );
      }

      // Convert template object to Template entity
      // This is a simplified approach - in reality we'd need proper template loading
      const templateData = containerTemplate as Record<string, unknown>;
      const _templatePath = templateData.path as string || "unknown";

      // Convert data array to combined object
      const plainObjects = data.map((item) => item.getData());
      const combinedData = {
        items: plainObjects,
        // For single item compatibility
        ...(plainObjects.length > 0 ? plainObjects[0] : {}),
      };

      // Simple template processing - replace placeholders
      let content = JSON.stringify(
        templateData.content || templateData,
        null,
        2,
      );

      // Basic variable substitution
      content = this.substituteVariables(content, combinedData);

      return Result.ok(content);
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

  /**
   * Simple variable substitution for templates
   */
  private substituteVariables(
    content: string,
    data: Record<string, unknown>,
  ): string {
    // Basic implementation - replace {variable} with values
    let result = content;

    // Handle nested property access like {items.length}
    const variableRegex = /\{([^}]+)\}/g;

    result = result.replace(variableRegex, (match, path) => {
      const value = this.getNestedValue(data, path.trim());
      if (value !== undefined) {
        return JSON.stringify(value);
      }
      return match; // Keep original if not found
    });

    return result;
  }

  /**
   * Gets nested value from object using dot notation
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current: unknown, key: string): unknown => {
      if (current && typeof current === "object" && key in current) {
        return (current as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj as unknown);
  }
}
