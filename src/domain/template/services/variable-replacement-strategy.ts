import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { ProcessingContext } from "../value-objects/processing-context.ts";

/**
 * VariableReplacementStrategy defines the contract for template variable replacement.
 * Follows Strategy Pattern to unify different processing approaches.
 * Implements Totality principle with Result<T,E> return types.
 */
export interface VariableReplacementStrategy {
  /**
   * Replace variables in template content using the provided data and context.
   * This is the core method that all strategies must implement.
   *
   * @param content - Template content (string, object, or array)
   * @param data - Frontmatter data containing variable values
   * @param context - Processing context determining replacement behavior
   * @param verbose - Whether to run in verbose mode (affects null/undefined handling)
   * @returns Result containing processed content or error
   */
  replaceVariables(
    content: unknown,
    data: FrontmatterData,
    context: ProcessingContext,
    verbose?: boolean,
  ): Result<unknown, TemplateError & { message: string }>;

  /**
   * Check if the strategy can handle the given content and context combination.
   * Used for strategy selection and validation.
   *
   * @param content - Template content to be processed
   * @param context - Processing context
   * @returns true if strategy can handle this combination
   */
  canHandle(content: unknown, context: ProcessingContext): boolean;

  /**
   * Get strategy identifier for debugging and logging purposes.
   * @returns Strategy name/identifier
   */
  getStrategyName(): string;
}

/**
 * UnifiedVariableReplacementStrategy implements the strategy interface
 * to provide consistent variable replacement across all contexts.
 * This eliminates the dual-path processing architecture.
 */
export class UnifiedVariableReplacementStrategy
  implements VariableReplacementStrategy {
  private constructor() {}

  /**
   * Smart Constructor for the unified strategy
   */
  static create(): Result<
    UnifiedVariableReplacementStrategy,
    TemplateError & { message: string }
  > {
    return ok(new UnifiedVariableReplacementStrategy());
  }

  getStrategyName(): string {
    return "UnifiedVariableReplacementStrategy";
  }

  canHandle(_content: unknown, _context: ProcessingContext): boolean {
    // This unified strategy can handle all content types and contexts
    return true;
  }

  replaceVariables(
    content: unknown,
    data: FrontmatterData,
    context: ProcessingContext,
    verbose: boolean = false,
  ): Result<unknown, TemplateError & { message: string }> {
    // Route to appropriate processing method based on context
    if (context.isArrayExpansion) {
      return this.processArrayExpansion(content, context, data, verbose);
    }

    if (context.isArrayProcessing) {
      return this.processArrayItems(content, context, data, verbose);
    }

    // Default to single item processing
    return this.processSingleItem(content, data, context, verbose);
  }

  private processSingleItem(
    content: unknown,
    data: FrontmatterData,
    context?: ProcessingContext,
    verbose: boolean = false,
  ): Result<unknown, TemplateError & { message: string }> {
    if (typeof content === "string") {
      return this.replaceStringVariables(content, data, verbose);
    }

    if (Array.isArray(content)) {
      return this.processArray(content, data, context, verbose);
    }

    if (content && typeof content === "object") {
      return this.processObject(
        content as Record<string, unknown>,
        data,
        context,
        verbose,
      );
    }

    // Return primitive values as-is
    return ok(content);
  }

  private processArrayExpansion(
    content: unknown,
    context: ProcessingContext,
    data: FrontmatterData,
    verbose: boolean = false,
  ): Result<unknown, TemplateError & { message: string }> {
    const arrayData = context.arrayData;
    if (!arrayData) {
      return err({
        kind: "DataCompositionFailed",
        reason: "Array expansion requires array data in context",
        message: "Array expansion requires array data in context",
      });
    }

    if (typeof content === "string") {
      // Handle {@items} expansion in string templates
      if (content.includes("{@items}")) {
        const itemsJson = JSON.stringify(arrayData);
        const expanded = content.replace("{@items}", itemsJson);
        return this.replaceStringVariables(expanded, data, verbose);
      }
    }

    // For non-string templates, process recursively
    return this.processSingleItem(content, data, context, verbose);
  }

  private processArrayItems(
    content: unknown,
    context: ProcessingContext,
    _data: FrontmatterData,
    verbose: boolean = false,
  ): Result<unknown, TemplateError & { message: string }> {
    const arrayData = context.arrayData;
    if (!arrayData) {
      return err({
        kind: "DataCompositionFailed",
        reason: "Array processing requires array data in context",
        message: "Array processing requires array data in context",
      });
    }

    // Process template for each item in the array
    const results: unknown[] = [];
    for (const item of arrayData) {
      // Create FrontmatterData from each item
      const itemDataResult = FrontmatterData.create(item);
      if (!itemDataResult.ok) {
        return err({
          kind: "DataCompositionFailed",
          reason:
            `Failed to create FrontmatterData from array item: ${itemDataResult.error.message}`,
          message:
            `Failed to create FrontmatterData from array item: ${itemDataResult.error.message}`,
        });
      }

      const itemResult = this.processSingleItem(
        content,
        itemDataResult.data,
        undefined,
        verbose,
      );
      if (!itemResult.ok) {
        return itemResult;
      }
      results.push(itemResult.data);
    }

    return { ok: true, data: results };
  }

  private replaceStringVariables(
    template: string,
    data: FrontmatterData,
    verbose: boolean = false,
  ): Result<string, TemplateError & { message: string }> {
    if (!template.includes("{")) {
      return ok(template);
    }

    try {
      // Use the fixed restrictive regex pattern to avoid matching across JSON structure
      let result = template.replace(/\{\{([\w.@-]+)\}\}/g, (match, varName) => {
        return this.getVariableValue(varName, data, match, verbose);
      });

      result = result.replace(/\{([\w.@-]+)\}/g, (match, varName) => {
        return this.getVariableValue(varName, data, match, verbose);
      });

      return ok(result);
    } catch (error) {
      return err(createError({
        kind: "RenderFailed",
        message: error instanceof Error
          ? `Variable replacement failed: ${error.message}`
          : "Variable replacement failed",
      }));
    }
  }

  private getVariableValue(
    varName: string,
    data: FrontmatterData,
    originalMatch: string,
    verbose: boolean = false,
  ): string {
    // Skip @ variables (special processing markers) except @items
    if (varName.startsWith("@") && varName !== "@items") {
      return originalMatch;
    }

    const valueResult = data.get(varName);
    if (!valueResult.ok) {
      // In verbose mode, keep the template variable as-is for debugging
      // In normal mode, replace with empty string for cleaner output
      return verbose ? originalMatch : "";
    }

    const value = valueResult.data;

    // Handle null/undefined values based on mode
    if (value === null || value === undefined) {
      return verbose ? originalMatch : "";
    }

    return this.formatValue(value);
  }

  private formatValue(value: unknown): string {
    if (
      typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }

    if (value === null) {
      return "null";
    }

    if (value === undefined) {
      return "";
    }

    return JSON.stringify(value);
  }

  private processArray(
    array: unknown[],
    data: FrontmatterData,
    context?: ProcessingContext,
    verbose: boolean = false,
  ): Result<unknown[], TemplateError & { message: string }> {
    const results: unknown[] = [];
    for (const item of array) {
      const itemResult = this.processSingleItem(item, data, context, verbose);
      if (!itemResult.ok) {
        return itemResult;
      }
      results.push(itemResult.data);
    }
    return ok(results);
  }

  private processObject(
    obj: Record<string, unknown>,
    data: FrontmatterData,
    context?: ProcessingContext,
    verbose: boolean = false,
  ): Result<Record<string, unknown>, TemplateError & { message: string }> {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      // Process the key itself for variable substitution
      const renderedKeyResult = this.replaceStringVariables(key, data, verbose);
      if (!renderedKeyResult.ok) {
        return renderedKeyResult;
      }
      const renderedKey = renderedKeyResult.data;

      // Handle special frontmatter_value objects
      if (
        typeof val === "object" && val !== null && "frontmatter_value" in val
      ) {
        const fmValue = val as { frontmatter_value: string };
        const fmValueResult = data.get(fmValue.frontmatter_value);
        result[renderedKey] = fmValueResult.ok ? fmValueResult.data : undefined;
        continue;
      }

      // Special handling for JSON context: if the string is exactly a variable reference,
      // preserve the original data type instead of converting to string
      if (typeof val === "string") {
        const variableMatch = val.match(/^\{([\w.@-]+)\}$/);
        if (variableMatch) {
          const varName = variableMatch[1];

          // Handle {@items} array expansion in JSON object context
          if (varName === "@items" && context?.hasArrayData) {
            // In object property context, use raw array for proper JSON structure
            result[renderedKey] = context.arrayData;
            continue;
          }

          const valueResult = data.get(varName);
          if (valueResult.ok) {
            const value = valueResult.data;
            // In verbose mode, keep template variable for null/undefined
            // In normal mode, use empty string
            if (value === null || value === undefined) {
              result[renderedKey] = verbose ? val : "";
            } else {
              // Preserve original data type for JSON context
              result[renderedKey] = value;
            }
            continue;
          } else {
            // Variable not found - handle based on mode
            result[renderedKey] = verbose ? val : "";
            continue;
          }
        }
      }

      // Process the value normally
      const valueResult = this.processSingleItem(val, data, context, verbose);
      if (!valueResult.ok) {
        return valueResult;
      }
      result[renderedKey] = valueResult.data;
    }

    return ok(result);
  }
}
