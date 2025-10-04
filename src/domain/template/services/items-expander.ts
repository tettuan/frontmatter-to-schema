import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import {
  createTemplateProcessor,
  InvalidJsonError,
  TemplateNotFoundError,
  TemplateReadError,
  VariableNotFoundError,
} from "../../../../sub_modules/json-template/src/mod.ts";

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
  | {
    kind: "VariableResolutionError";
    variable: string;
    context: string;
    availableKeys?: string[];
  }
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
  async expandItems(
    context: ItemsExpansionContext,
  ): Promise<Result<ItemsExpansionResult, TemplateError>> {
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
      const expandedItems = await this.processArrayItems(
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
    // Priority: arrayItem data > globalVariables (container-level)
    // Array item data should NOT be overridden by global variables
    const itemData = this.isObject(arrayItem)
      ? arrayItem
      : { value: arrayItem };

    const itemContext: Record<string, unknown> = {
      // Container-level variables (e.g., version, description)
      ...globalVariables,
      // Array item data takes precedence
      ...itemData,
      // Array context variables (always added)
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
  private async processArrayItems(
    arrayData: readonly unknown[],
    itemsTemplate: Template,
    globalVariables: Record<string, unknown>,
    _schema?: Record<string, unknown>,
  ): Promise<Result<unknown[], ItemsExpansionError>> {
    const processedItems: unknown[] = [];
    const processor = createTemplateProcessor();
    const templatePath = itemsTemplate.getPath().toString();

    for (let i = 0; i < arrayData.length; i++) {
      const arrayItem = arrayData[i];
      const itemContext = this.createItemContext(arrayItem, i, globalVariables);

      // Set $last for the final item
      if (i === arrayData.length - 1) {
        itemContext.$last = true;
      }

      // Use json-template processor for variable resolution
      try {
        const resolvedContent = await processor.process(
          itemContext,
          templatePath,
        );
        processedItems.push(resolvedContent);
      } catch (error) {
        // Log warning but continue processing other items
        const convertedError = this.convertJsonTemplateError(
          error,
          templatePath,
        );
        console.error(
          `⚠️  Warning: Failed to process item ${i} with template ${templatePath}: ${
            convertedError.kind === "VariableResolutionError"
              ? `Variable '${convertedError.variable}' not found`
              : convertedError.kind === "TemplateProcessingError"
              ? convertedError.error
              : "Unknown error"
          }`,
        );
        // Skip this item and continue with others
        continue;
      }
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
   * Converts json-template errors to ItemsExpansionError.
   */
  private convertJsonTemplateError(
    error: unknown,
    templatePath: string,
  ): ItemsExpansionError {
    if (error instanceof VariableNotFoundError) {
      return {
        kind: "VariableResolutionError",
        variable: (error as VariableNotFoundError).variablePath || "unknown",
        context: templatePath,
      };
    }

    if (error instanceof TemplateNotFoundError) {
      return {
        kind: "TemplateProcessingError",
        template: templatePath,
        error: `Template file not found: ${templatePath}`,
      };
    }

    if (error instanceof InvalidJsonError) {
      return {
        kind: "TemplateProcessingError",
        template: templatePath,
        error: `Invalid JSON in template: ${
          (error as InvalidJsonError).message
        }`,
      };
    }

    if (error instanceof TemplateReadError) {
      return {
        kind: "TemplateProcessingError",
        template: templatePath,
        error: `Failed to read template: ${
          (error as TemplateReadError).message
        }`,
      };
    }

    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return {
      kind: "TemplateProcessingError",
      template: templatePath,
      error: errorMessage,
    };
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
          `Variable resolution error for ${error.variable} in context ${error.context}` +
            (error.availableKeys
              ? `\nAvailable keys: ${error.availableKeys.join(", ")}`
              : ""),
          "VARIABLE_RESOLUTION_ERROR",
          {
            variable: error.variable,
            context: error.context,
            availableKeys: error.availableKeys,
          },
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
