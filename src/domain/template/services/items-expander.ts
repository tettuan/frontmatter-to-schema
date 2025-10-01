import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";

/**
 * Context for {@items} expansion containing data and template information.
 */
export interface ItemsExpansionContext {
  readonly arrayData: readonly unknown[];
  readonly itemsTemplate: Template;
  readonly containerTemplate: Template;
  readonly globalVariables: Record<string, unknown>;
  readonly schema?: Record<string, unknown>;
}

/**
 * Result of {@items} expansion.
 */
export interface ItemsExpansionResult {
  readonly expandedContent: Record<string, unknown>;
  readonly expandedItemCount: number;
  readonly preservedVariables: Record<string, unknown>;
}

/**
 * Expansion errors following totality principle.
 */
export type ItemsExpansionError =
  | { kind: "InvalidArrayData"; reason: string }
  | { kind: "TemplateProcessingError"; template: string; error: string }
  | { kind: "VariableResolutionError"; variable: string; context: string }
  | { kind: "ExpansionContextError"; reason: string };

/**
 * Service for expanding {@items} patterns with array data.
 * Implements totality principle with comprehensive error handling.
 */
export class ItemsExpander {
  private constructor() {}

  /**
   * Creates an ItemsExpander instance.
   */
  static create(): ItemsExpander {
    return new ItemsExpander();
  }

  /**
   * Expands {@items} patterns in template content using provided context.
   */
  expandItems(
    context: ItemsExpansionContext,
  ): Result<ItemsExpansionResult, TemplateError> {
    try {
      // Validate expansion context
      const contextValidation = this.validateExpansionContext(context);
      if (contextValidation.isError()) {
        return Result.error(
          this.convertExpansionErrorToTemplateError(
            contextValidation.unwrapError(),
          ),
        );
      }

      // Process each array item with the items template
      const expandedItems = this.processArrayItems(
        context.arrayData,
        context.itemsTemplate,
        context.globalVariables,
        context.schema,
      );

      if (expandedItems.isError()) {
        return Result.error(
          this.convertExpansionErrorToTemplateError(
            expandedItems.unwrapError(),
          ),
        );
      }

      // Replace {@items} patterns in container template
      const finalContent = this.replaceItemsPatterns(
        context.containerTemplate.getContent(),
        expandedItems.unwrap(),
      );

      if (finalContent.isError()) {
        return Result.error(
          this.convertExpansionErrorToTemplateError(finalContent.unwrapError()),
        );
      }

      return Result.ok({
        expandedContent: finalContent.unwrap(),
        expandedItemCount: context.arrayData.length,
        preservedVariables: { ...context.globalVariables },
      });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new TemplateError(
          `Items expansion failed: ${errorMessage}`,
          "ITEMS_EXPANSION_ERROR",
          { context, error },
        ),
      );
    }
  }

  /**
   * Expands {@items} with no template (leaves patterns unexpanded).
   */
  expandItemsWithoutTemplate(
    templateContent: Record<string, unknown>,
  ): Result<ItemsExpansionResult, TemplateError> {
    // When no x-template-items is specified, {@items} remains unexpanded
    return Result.ok({
      expandedContent: { ...templateContent },
      expandedItemCount: 0,
      preservedVariables: {},
    });
  }

  /**
   * Creates array context for items template processing.
   */
  createItemContext(
    arrayItem: unknown,
    itemIndex: number,
    globalVariables: Record<string, unknown>,
  ): Record<string, unknown> {
    const itemContext: Record<string, unknown> = {
      ...globalVariables,
      // Array item data becomes the root context
      ...(this.isObject(arrayItem) ? arrayItem : { value: arrayItem }),
      // Add array context variables
      $index: itemIndex,
      $first: itemIndex === 0,
      $last: false, // Will be set by caller if needed
    };

    return itemContext;
  }

  /**
   * Validates the expansion context for correctness.
   */
  private validateExpansionContext(
    context: ItemsExpansionContext,
  ): Result<void, ItemsExpansionError> {
    if (!Array.isArray(context.arrayData)) {
      return Result.error({
        kind: "InvalidArrayData",
        reason: "Array data must be an array",
      });
    }

    if (!context.itemsTemplate) {
      return Result.error({
        kind: "ExpansionContextError",
        reason: "Items template is required for expansion",
      });
    }

    if (!context.containerTemplate) {
      return Result.error({
        kind: "ExpansionContextError",
        reason: "Container template is required for expansion",
      });
    }

    // Verify container template has {@items} patterns
    if (!context.containerTemplate.hasItemsExpansion()) {
      return Result.error({
        kind: "ExpansionContextError",
        reason: "Container template must contain {@items} patterns",
      });
    }

    return Result.ok(undefined);
  }

  /**
   * Processes array items using the items template.
   */
  private processArrayItems(
    arrayData: readonly unknown[],
    itemsTemplate: Template,
    globalVariables: Record<string, unknown>,
    schema?: Record<string, unknown>,
  ): Result<unknown[], ItemsExpansionError> {
    const processedItems: unknown[] = [];

    for (let i = 0; i < arrayData.length; i++) {
      const arrayItem = arrayData[i];
      const itemContext = this.createItemContext(arrayItem, i, globalVariables);

      // Set $last for the final item
      if (i === arrayData.length - 1) {
        itemContext.$last = true;
      }

      // Resolve variables in items template with item context and schema
      const resolvedTemplate = itemsTemplate.resolveVariables(
        itemContext,
        schema,
      );
      if (resolvedTemplate.isError()) {
        return Result.error({
          kind: "TemplateProcessingError",
          template: itemsTemplate.getPath().toString(),
          error: resolvedTemplate.unwrapError().message,
        });
      }

      processedItems.push(resolvedTemplate.unwrap().getContent());
    }

    return Result.ok(processedItems);
  }

  /**
   * Replaces {@items} patterns in container template with expanded items.
   */
  private replaceItemsPatterns(
    containerContent: Record<string, unknown>,
    expandedItems: unknown[],
  ): Result<Record<string, unknown>, ItemsExpansionError> {
    try {
      const replaced = this.replaceItemsInObject(
        containerContent,
        expandedItems,
      );
      // Safe assertion: caller ensures containerContent is a Record<string, unknown>
      return Result.ok(replaced as Record<string, unknown>);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error({
        kind: "TemplateProcessingError",
        template: "container",
        error: `Pattern replacement failed: ${errorMessage}`,
      });
    }
  }

  /**
   * Recursively replaces {@items} patterns in an object.
   */
  private replaceItemsInObject(
    obj: unknown,
    expandedItems: unknown[],
  ): unknown {
    if (typeof obj === "string") {
      return this.replaceItemsInString(obj, expandedItems);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.replaceItemsInObject(item, expandedItems));
    }

    if (this.isObject(obj)) {
      const result: Record<string, unknown> = {};
      for (
        const [key, value] of Object.entries(obj)
      ) {
        const replacedValue = this.replaceItemsInObject(value, expandedItems);

        // Special handling for array expansion
        if (typeof value === "string" && value === "{@items}") {
          // Replace the entire property value with expanded items array
          result[key] = expandedItems;
        } else {
          result[key] = replacedValue;
        }
      }
      return result;
    }

    return obj;
  }

  /**
   * Replaces {@items} patterns in a string.
   */
  private replaceItemsInString(str: string, expandedItems: unknown[]): unknown {
    // If the entire string is {@items}, replace with the array
    if (str.trim() === "{@items}") {
      return expandedItems;
    }

    // For partial replacements, convert items to string representation
    const itemsString = this.convertItemsToString(expandedItems);
    return str.replace(/\{@items\}/g, itemsString);
  }

  /**
   * Converts expanded items to string representation for inline replacement.
   */
  private convertItemsToString(items: unknown[]): string {
    try {
      return JSON.stringify(items);
    } catch {
      return `[${items.length} items]`;
    }
  }

  /**
   * Type guard for objects.
   */
  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" &&
      value !== null &&
      !Array.isArray(value);
  }

  /**
   * Converts expansion error to template error.
   */
  private convertExpansionErrorToTemplateError(
    error: ItemsExpansionError,
  ): TemplateError {
    switch (error.kind) {
      case "InvalidArrayData":
        return new TemplateError(
          `Invalid array data for {@items} expansion: ${error.reason}`,
          "INVALID_ARRAY_DATA",
          { reason: error.reason },
        );
      case "TemplateProcessingError":
        return new TemplateError(
          `Template processing error in ${error.template}: ${error.error}`,
          "TEMPLATE_PROCESSING_ERROR",
          { template: error.template, error: error.error },
        );
      case "VariableResolutionError":
        return new TemplateError(
          `Variable resolution error for ${error.variable} in context ${error.context}`,
          "VARIABLE_RESOLUTION_ERROR",
          { variable: error.variable, context: error.context },
        );
      case "ExpansionContextError":
        return new TemplateError(
          `Expansion context error: ${error.reason}`,
          "EXPANSION_CONTEXT_ERROR",
          { reason: error.reason },
        );
    }
  }
}
