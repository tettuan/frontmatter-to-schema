import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../frontmatter/factories/frontmatter-data-factory.ts";
import { DebugLoggerFactory } from "../../../infrastructure/adapters/debug-logger.ts";
import { ArrayExpansionStrategy } from "./array-expansion-strategy.ts";

/**
 * VariableReplacer handles template variable substitution.
 * Follows Totality principles with Result<T,E> pattern.
 */
export class VariableReplacer {
  private constructor(
    private readonly arrayExpansionStrategy: ArrayExpansionStrategy,
  ) {}
  private debugLogger = DebugLoggerFactory.create();

  /**
   * Smart Constructor for VariableReplacer
   * @returns Result containing VariableReplacer instance or error
   */
  static create(): Result<
    VariableReplacer,
    TemplateError & { message: string }
  > {
    const strategyResult = ArrayExpansionStrategy.create();
    if (!strategyResult.ok) return strategyResult;

    return ok(new VariableReplacer(strategyResult.data));
  }

  /**
   * Replaces variables in template content with values from data
   * @param template - Template string with {variable} placeholders
   * @param data - FrontmatterData containing values for replacement
   * @param arrayData - Optional array data for {@items} expansion
   * @returns Result containing processed template string or error
   */
  replaceVariables(
    template: string,
    data: FrontmatterData,
    arrayData?: unknown[],
  ): Result<string, TemplateError & { message: string }> {
    try {
      if (!template.includes("{")) {
        return ok(template);
      }

      this.debugLogger?.logDebug(
        "variable-replacer",
        "Starting variable replacement",
        {
          template: template.substring(0, 200) +
            (template.length > 200 ? "..." : ""),
          hasArrayData: !!arrayData,
          arrayDataLength: arrayData?.length,
        },
      );

      // Support both single and double brace syntax: {var} and {{var}}
      // Use more restrictive regex to avoid matching across JSON structure
      let result = template.replace(/\{\{([\w.@-]+)\}\}/g, (match, varName) => {
        this.debugLogger?.logDebug(
          "variable-replacer",
          "Processing variable",
          { varName, match },
        );

        // Handle {@items} array expansion
        if (varName === "@items" && arrayData) {
          this.debugLogger?.logDebug(
            "variable-replacer",
            "Processing @items array expansion",
            { arrayDataLength: arrayData.length },
          );
          // Return special marker for array expansion
          return "[@ITEMS_EXPANSION]";
        }

        // Skip other @ variables (special processing markers)
        if (varName.startsWith("@")) {
          this.debugLogger?.logDebug(
            "variable-replacer",
            "Skipping @ variable",
            { varName },
          );
          return match;
        }

        const valueResult = data.get(varName);
        if (!valueResult.ok) {
          this.debugLogger?.logDebug(
            "variable-replacer",
            "Variable not found - keeping placeholder",
            { varName, error: valueResult.error },
          );
          return match; // Keep placeholder if value not found
        }

        const formattedValue = this.formatValue(valueResult.data);
        this.debugLogger?.logDebug(
          "variable-replacer",
          "Variable resolved successfully",
          {
            varName,
            rawDataType: typeof valueResult.data,
            rawDataIsArray: Array.isArray(valueResult.data),
            formattedValue: typeof formattedValue === "string"
              ? formattedValue.substring(0, 100) +
                (formattedValue.length > 100 ? "..." : "")
              : formattedValue,
          },
        );

        return formattedValue;
      });

      // Also support single brace syntax: {var}
      // Use more restrictive regex to avoid matching across JSON structure
      result = result.replace(/\{([\w.@-]+)\}/g, (match, varName) => {
        this.debugLogger?.logDebug(
          "variable-replacer",
          "Processing single-brace variable",
          { varName, match },
        );

        // Handle {@items} array expansion
        if (varName === "@items" && arrayData) {
          this.debugLogger?.logDebug(
            "variable-replacer",
            "Processing @items array expansion (single-brace)",
            { arrayDataLength: arrayData.length },
          );
          // Return special marker for array expansion
          return "[@ITEMS_EXPANSION]";
        }

        // Skip other @ variables (special processing markers)
        if (varName.startsWith("@")) {
          this.debugLogger?.logDebug(
            "variable-replacer",
            "Skipping @ variable (single-brace)",
            { varName },
          );
          return match;
        }

        const valueResult = data.get(varName);
        if (!valueResult.ok) {
          this.debugLogger?.logDebug(
            "variable-replacer",
            "Single-brace variable not found - keeping placeholder",
            { varName, error: valueResult.error },
          );
          return match; // Keep placeholder if value not found
        }

        const formattedValue = this.formatValue(valueResult.data);
        this.debugLogger?.logDebug(
          "variable-replacer",
          "Single-brace variable resolved successfully",
          {
            varName,
            rawDataType: typeof valueResult.data,
            rawDataIsArray: Array.isArray(valueResult.data),
            formattedValue: typeof formattedValue === "string"
              ? formattedValue.substring(0, 100) +
                (formattedValue.length > 100 ? "..." : "")
              : formattedValue,
          },
        );

        return formattedValue;
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

  /**
   * Processes template values recursively, handling objects and arrays
   * @param value - Value to process (can be object, array, or primitive)
   * @param data - FrontmatterData for variable substitution
   * @returns Result containing processed value or error
   */
  processValue(
    value: unknown,
    data: FrontmatterData,
    arrayData?: unknown[],
  ): Result<unknown, TemplateError & { message: string }> {
    try {
      // Handle Result types first - unwrap successful Results, return empty for errors
      if (this.isResultType(value)) {
        const resultValue = value as {
          ok: boolean;
          data?: unknown;
          error?: unknown;
        };
        if (resultValue.ok && resultValue.data !== undefined) {
          // Recursively process the unwrapped data
          return this.processValue(resultValue.data, data, arrayData);
        }
        // For error Results, return empty string
        return ok("");
      }

      if (typeof value === "string") {
        return this.replaceVariables(value, data, arrayData);
      }

      if (Array.isArray(value)) {
        const results: unknown[] = [];
        for (const item of value) {
          const processedResult = this.processValue(item, data, arrayData);
          if (!processedResult.ok) {
            return processedResult;
          }
          results.push(processedResult.data);
        }
        return ok(results);
      }

      if (value && typeof value === "object") {
        return this.processObject(
          value as Record<string, unknown>,
          data,
          arrayData,
        );
      }

      return ok(value);
    } catch (error) {
      return err(createError({
        kind: "RenderFailed",
        message: error instanceof Error
          ? `Value processing failed: ${error.message}`
          : "Value processing failed",
      }));
    }
  }

  private formatValue(value: unknown): string {
    if (
      typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }

    // Handle Result types - prevent serialization of Result objects
    if (this.isResultType(value)) {
      const resultValue = value as {
        ok: boolean;
        data?: unknown;
        error?: unknown;
      };
      if (resultValue.ok && resultValue.data !== undefined) {
        // Recursively format the data inside successful Result
        return this.formatValue(resultValue.data);
      }
      // For error Results, return empty string (fail gracefully)
      return "";
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }

    // Handle null/undefined
    if (value === null) {
      return "null";
    }
    if (value === undefined) {
      return "";
    }

    // For complex objects, stringify but be cautious
    return JSON.stringify(value);
  }

  private isResultType(value: unknown): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      "ok" in value &&
      typeof (value as { ok: unknown }).ok === "boolean"
    );
  }

  private processObject(
    obj: Record<string, unknown>,
    data: FrontmatterData,
    arrayData?: unknown[],
  ): Result<Record<string, unknown>, TemplateError & { message: string }> {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      const renderedKeyResult = this.replaceVariables(key, data);
      if (!renderedKeyResult.ok) {
        return err(renderedKeyResult.error);
      }
      const renderedKey = renderedKeyResult.data;

      // Handle iterate objects first (they can have frontmatter_value as sub-property)
      if (typeof val === "object" && val !== null && "iterate" in val) {
        const iterateResult = this.processIterateObject(val, data);
        if (!iterateResult.ok) {
          return err(iterateResult.error);
        }
        result[renderedKey] = iterateResult.data;
        continue;
      }

      // Handle special frontmatter_value objects
      if (
        typeof val === "object" && val !== null && "frontmatter_value" in val
      ) {
        const fmValue = val as { frontmatter_value: string };
        const fmValueResult = data.get(fmValue.frontmatter_value);
        result[renderedKey] = fmValueResult.ok ? fmValueResult.data : undefined;
        continue;
      }

      // Process regular values
      if (typeof val === "string") {
        // Special handling for JSON context: if the string is exactly a variable reference,
        // preserve the original data type instead of converting to string
        const variableMatch = val.match(/^\{([\w.@-]+)\}$/);
        if (variableMatch) {
          const varName = variableMatch[1];

          // Handle {@items} array expansion in JSON object context
          if (varName === "@items" && arrayData) {
            // In object property context, use raw array for proper JSON structure
            result[renderedKey] = arrayData;
            continue;
          }

          const valueResult = data.get(varName);
          if (valueResult.ok) {
            // Preserve original data type for JSON context
            result[renderedKey] = valueResult.data;
            continue;
          }
        }
      }

      const processedResult = this.processValue(val, data, arrayData);
      if (!processedResult.ok) {
        return err(processedResult.error);
      }
      result[renderedKey] = processedResult.data;
    }

    return ok(result);
  }

  private processIterateObject(
    iterateObj: Record<string, unknown>,
    data: FrontmatterData,
  ): Result<unknown, TemplateError & { message: string }> {
    const iterateValue = iterateObj as {
      iterate: string;
      frontmatter_value?: string;
    };

    const iterateDataResult = data.get(iterateValue.iterate);
    if (!iterateDataResult.ok) {
      return ok(undefined);
    }

    const iterateData = iterateDataResult.data;
    if (!Array.isArray(iterateData) || !iterateValue.frontmatter_value) {
      return ok(iterateData);
    }

    // At this point we know frontmatter_value exists due to the guard above
    const frontmatterValueKey = iterateValue.frontmatter_value;

    const results: unknown[] = [];
    for (const item of iterateData) {
      const itemDataResult = FrontmatterDataFactory.fromParsedData(item);
      if (itemDataResult.ok) {
        const valueResult = itemDataResult.data.get(frontmatterValueKey);
        if (valueResult.ok) {
          results.push(valueResult.data);
        }
        // Note: Failed value extraction is silently ignored to maintain existing behavior
        // In a future version, we could collect and return these errors
      }
      // Note: Failed item creation is silently ignored to maintain existing behavior
    }

    return ok(results);
  }

  /**
   * Schema-aware variable replacement method
   * This is a compatibility method for schema-aware variable replacement
   * @param template - Template string with {variable} placeholders
   * @param data - FrontmatterData containing values for replacement
   * @param schema - Schema information (currently unused, for future enhancement)
   * @returns Result containing processed template string or error
   */
  replaceVariablesWithSchema(
    template: string,
    data: FrontmatterData,
    _schema?: unknown,
  ): Result<string, TemplateError & { message: string }> {
    // For now, delegate to the existing replaceVariables method
    // This provides compatibility while maintaining the interface for future schema integration
    return this.replaceVariables(template, data);
  }

  /**
   * Process template with {@items} array expansion support
   * @param template - Template content with potential {@items} marker
   * @param dataArray - Array of data items to expand
   * @param itemTemplate - Optional template to apply to each item
   * @returns Result containing expanded content or error
   */
  processArrayExpansion(
    template: unknown,
    dataArray: unknown[],
    itemTemplate?: unknown,
  ): Result<unknown, TemplateError & { message: string }> {
    // If template is a string and contains {@items}, expand it
    if (typeof template === "string" && template.includes("{@items}")) {
      if (!itemTemplate) {
        // ✅ DDD Fix: Use strategy pattern for consistent array expansion
        return this.arrayExpansionStrategy.expandItems(template, dataArray);
      }

      // Process each item with the item template
      const processedItems: unknown[] = [];
      for (const item of dataArray) {
        const itemDataResult = FrontmatterDataFactory.fromParsedData(item);
        if (!itemDataResult.ok) {
          return err(createError({
            kind: "RenderFailed",
            message:
              `Failed to create FrontmatterData from item: ${itemDataResult.error.message}`,
          }));
        }

        const processedResult = this.processValue(
          itemTemplate,
          itemDataResult.data,
          dataArray,
        );
        if (!processedResult.ok) {
          return processedResult;
        }
        processedItems.push(processedResult.data);
      }

      // Replace {@items} with processed items
      if (typeof template === "string") {
        // For JSON templates, directly insert the array
        if (template.trim().startsWith("[") && template.trim().endsWith("]")) {
          return ok(processedItems);
        }
        // For string templates, join the items
        const expanded = template.replace(
          "{@items}",
          JSON.stringify(processedItems),
        );
        return ok(expanded);
      }

      return ok(processedItems);
    }

    // If template is an array containing {@items}, expand it
    if (Array.isArray(template)) {
      const result: unknown[] = [];
      for (const item of template) {
        if (typeof item === "string" && item === "{@items}") {
          // Expand array items here
          result.push(...dataArray);
        } else {
          result.push(item);
        }
      }
      return ok(result);
    }

    // If template is an object, recursively process it
    if (template && typeof template === "object") {
      const result: Record<string, unknown> = {};
      for (
        const [key, value] of Object.entries(
          template as Record<string, unknown>,
        )
      ) {
        const processedResult = this.processArrayExpansion(
          value,
          dataArray,
          itemTemplate,
        );
        if (!processedResult.ok) {
          return processedResult;
        }
        result[key] = processedResult.data;
      }
      return ok(result);
    }

    // Return template as-is if no {@items} processing needed
    return ok(template);
  }
}
