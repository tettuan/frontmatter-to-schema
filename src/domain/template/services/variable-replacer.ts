import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

/**
 * VariableReplacer handles template variable substitution.
 * Follows Totality principles with Result<T,E> pattern.
 */
export class VariableReplacer {
  private constructor() {}

  /**
   * Smart Constructor for VariableReplacer
   * @returns Result containing VariableReplacer instance or error
   */
  static create(): Result<
    VariableReplacer,
    TemplateError & { message: string }
  > {
    return ok(new VariableReplacer());
  }

  /**
   * Replaces variables in template content with values from data
   * @param template - Template string with {variable} placeholders
   * @param data - FrontmatterData containing values for replacement
   * @returns Result containing processed template string or error
   */
  replaceVariables(
    template: string,
    data: FrontmatterData,
  ): Result<string, TemplateError & { message: string }> {
    try {
      if (!template.includes("{")) {
        return ok(template);
      }

      const result = template.replace(/\{([^}]+)\}/g, (match, varName) => {
        // Skip @ variables (special processing markers)
        if (varName.startsWith("@")) {
          return match;
        }

        const valueResult = data.get(varName);
        if (!valueResult.ok) {
          return match; // Keep placeholder if value not found
        }

        return this.formatValue(valueResult.data);
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
          return this.processValue(resultValue.data, data);
        }
        // For error Results, return empty string
        return ok("");
      }

      if (typeof value === "string") {
        return this.replaceVariables(value, data);
      }

      if (Array.isArray(value)) {
        const results: unknown[] = [];
        for (const item of value) {
          const processedResult = this.processValue(item, data);
          if (!processedResult.ok) {
            return processedResult;
          }
          results.push(processedResult.data);
        }
        return ok(results);
      }

      if (value && typeof value === "object") {
        return this.processObject(value as Record<string, unknown>, data);
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
      const processedResult = this.processValue(val, data);
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

    const results: unknown[] = [];
    for (const item of iterateData) {
      const itemDataResult = FrontmatterData.create(item);
      if (itemDataResult.ok) {
        const valueResult = itemDataResult.data.get(
          iterateValue.frontmatter_value!,
        );
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
}
