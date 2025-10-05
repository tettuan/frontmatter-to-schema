import { Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { Schema } from "../entities/schema.ts";
import { TemplatePath } from "../../shared/value-objects/template-path.ts";
import {
  SchemaContext,
  TemplateHandoffContext,
  TemplateResolutionStrategy,
} from "../../../application/services/template-schema-coordinator.ts";
import { DIRECTIVE_NAMES } from "../constants/directive-names.ts";

/**
 * Schema Domain - Template Resolution Service
 *
 * Responsible for extracting template references from schema extensions
 * and providing template context for cross-domain coordination.
 */
export class SchemaTemplateResolver {
  /**
   * Resolves template context from schema extensions
   *
   * Extracts x-template and x-template-items references and provides
   * the handoff context needed for template processing coordination.
   */
  resolveTemplateContext(
    schema: Schema,
  ): Result<TemplateHandoffContext, DomainError> {
    try {
      const schemaDataResult = schema.getData();
      if (schemaDataResult.isError()) {
        return Result.error(schemaDataResult.unwrapError());
      }
      const schemaData = schemaDataResult.unwrap();

      // Extract template references from root level
      const containerTemplateResult = this.extractContainerTemplate(schemaData);
      if (containerTemplateResult.isError()) {
        return Result.error(containerTemplateResult.unwrapError());
      }

      const itemsTemplate = this.extractItemsTemplate(schemaData);

      const nestedArrayProperty = this.extractNestedArrayProperty(
        schemaData,
      );

      const schemaContext: SchemaContext = {
        sourceSchema: schema,
        resolvedExtensions: this.extractExtensions(schemaData),
        templateResolutionStrategy: this.getResolutionStrategy(schema),
        nestedArrayProperty,
      };

      // x-template-items is optional - without it, {@items} won't be expanded
      // This is valid and not an error condition
      return Result.ok({
        containerTemplate: containerTemplateResult.unwrap(),
        itemsTemplate,
        schemaContext,
      });
    } catch (error) {
      return Result.error(
        new DomainError(
          `Failed to resolve template context: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "TEMPLATE_CONTEXT_RESOLUTION_ERROR",
          { schema: schema.getPath(), error },
        ),
      );
    }
  }

  /**
   * Extracts container template path from x-template extension
   */
  private extractContainerTemplate(
    schemaData: Record<string, unknown>,
  ): Result<TemplatePath, DomainError> {
    const templateRef = schemaData[DIRECTIVE_NAMES.TEMPLATE];

    if (!templateRef || typeof templateRef !== "string") {
      return Result.error(
        new DomainError(
          "Schema must contain x-template extension",
          "MISSING_CONTAINER_TEMPLATE",
          { schemaData },
        ),
      );
    }

    return TemplatePath.create(
      templateRef,
      "container",
      DIRECTIVE_NAMES.TEMPLATE,
    );
  }

  /**
   * Extracts items template path from x-template-items extension
   * Returns null if not present (optional)
   */
  private extractItemsTemplate(
    schemaData: Record<string, unknown>,
  ): TemplatePath | null {
    const itemsTemplateRef = schemaData[DIRECTIVE_NAMES.TEMPLATE_ITEMS];

    if (!itemsTemplateRef || typeof itemsTemplateRef !== "string") {
      return null;
    }

    const templatePathResult = TemplatePath.create(
      itemsTemplateRef,
      "items",
      DIRECTIVE_NAMES.TEMPLATE_ITEMS,
    );

    // If template path creation fails, treat as if extension wasn't present
    return templatePathResult.isOk() ? templatePathResult.unwrap() : null;
  }

  /**
   * Extracts the nested array property name from x-flatten-arrays directive.
   * Returns the property name if x-frontmatter-part has x-flatten-arrays,
   * otherwise returns null (meaning: use entire frontmatter as array element).
   */
  private extractNestedArrayProperty(
    schemaData: Record<string, unknown>,
  ): string | null {
    const properties = schemaData.properties;
    if (!properties || typeof properties !== "object") {
      return null;
    }

    for (const [propName, propSchema] of Object.entries(properties)) {
      if (typeof propSchema === "object" && propSchema !== null) {
        const schema = propSchema as Record<string, unknown>;
        if (schema[DIRECTIVE_NAMES.FRONTMATTER_PART] === true) {
          // If x-flatten-arrays is present, return its value (nested array property name)
          // Otherwise, return null (use entire frontmatter as array element)
          const flattenArrays = schema[DIRECTIVE_NAMES.FLATTEN_ARRAYS];
          if (flattenArrays && typeof flattenArrays === "string") {
            return flattenArrays;
          }
          return null;
        }
      }
    }

    return null;
  }

  /**
   * Extracts all x-* extensions from schema
   */
  private extractExtensions(
    schemaData: Record<string, unknown>,
  ): Record<string, unknown> {
    const extensions: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schemaData)) {
      if (key.startsWith("x-")) {
        extensions[key] = value;
      }
    }

    return extensions;
  }

  /**
   * Determines template resolution strategy based on schema
   */
  private getResolutionStrategy(_schema: Schema): TemplateResolutionStrategy {
    // For now, use relative path resolution
    // This could be enhanced based on schema configuration
    return "relative";
  }

  /**
   * Resolves template path based on strategy
   */
  private resolveTemplatePath(
    templateRef: string,
    strategy: TemplateResolutionStrategy = "relative",
  ): string {
    if (strategy === "absolute") {
      return templateRef;
    }

    // For relative paths, ensure they are properly formatted
    return templateRef.startsWith("./") ? templateRef : `./${templateRef}`;
  }
}
