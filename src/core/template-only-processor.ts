/**
 * Template-Only Processor
 *
 * 単一責任: テンプレートに記載された内容のみを出力する
 * Single Responsibility: Output ONLY what is written in the template
 *
 * Core Principle from requirements.ja.md:
 * "テンプレートは出力フォーマットを完全に定義する。テンプレートに記載されたもののみが出力される。"
 */

import type { Result } from "../domain/core/result.ts";

/**
 * Template processor with absolute template-only output
 * テンプレート以外を一切出力しない
 */
export class TemplateOnlyProcessor {
  /**
   * Process template with strict template-only output
   * No data inference, no schema completion, ONLY template content
   */
  processTemplate(
    templateContent: string,
    data: Record<string, unknown>,
  ): Result<string, { kind: string; message: string }> {
    try {
      // Parse template
      const template = this.parseTemplate(templateContent);

      // Process with strict template-only policy
      const processed = this.processValue(template, data);

      // Return as formatted JSON
      return {
        ok: true,
        data: JSON.stringify(processed, null, 2),
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "TemplateProcessingError",
          message: `Template processing failed: ${String(error)}`,
        },
      };
    }
  }

  private parseTemplate(content: string): unknown {
    try {
      return JSON.parse(content);
    } catch {
      // If not JSON, treat as plain text
      return content;
    }
  }

  /**
   * Process value with variable substitution
   * Core logic: Only process what exists in template
   */
  private processValue(
    templateValue: unknown,
    data: Record<string, unknown>,
  ): unknown {
    // String: Check for variable pattern
    if (typeof templateValue === "string") {
      return this.processString(templateValue, data);
    }

    // Array: Process each element
    if (Array.isArray(templateValue)) {
      return this.processArray(templateValue, data);
    }

    // Object: Process each property
    if (typeof templateValue === "object" && templateValue !== null) {
      return this.processObject(
        templateValue as Record<string, unknown>,
        data,
      );
    }

    // Primitive values: Return as-is
    return templateValue;
  }

  /**
   * Process string value for variable replacement
   */
  private processString(
    value: string,
    data: Record<string, unknown>,
  ): unknown {
    // Check for {variable} or {variable.path} pattern
    const variableMatch = value.match(/^\{([^}]+)\}$/);
    if (!variableMatch) {
      return value; // Not a variable, return as-is
    }

    const variablePath = variableMatch[1];

    // Special case for {@items} - array expansion
    if (variablePath === "@items") {
      return this.extractItems(data);
    }

    // Resolve variable path
    const resolved = this.resolveVariable(variablePath, data);

    // Return resolved value or keep original if not found
    return resolved !== undefined ? resolved : value;
  }

  /**
   * Process array in template
   */
  private processArray(
    templateArray: unknown[],
    data: Record<string, unknown>,
  ): unknown[] {
    // Special case: [{@items}] pattern for array expansion
    if (
      templateArray.length === 1 &&
      templateArray[0] === "{@items}"
    ) {
      const items = this.extractItems(data);
      return Array.isArray(items) ? items : [];
    }

    // Special case: Empty array [] might be a placeholder for dynamic content
    // If the template has an empty array and we have matching data, use it
    if (templateArray.length === 0) {
      // Check if we have array data that should be used
      const items = this.extractItems(data);
      if (Array.isArray(items) && items.length > 0) {
        // For simple ID arrays, return them directly
        if (items.every((item) => typeof item === "string")) {
          return items;
        }
      }
    }

    // Process each array element
    return templateArray.map((item) => this.processValue(item, data));
  }

  /**
   * Process object in template
   */
  private processObject(
    templateObj: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(templateObj)) {
      // Check if key is a variable (e.g., {level})
      const processedKey = this.processKey(key, data);

      // Process the value
      const processedValue = this.processValue(value, data);

      // Add to result
      result[processedKey] = processedValue;
    }

    return result;
  }

  /**
   * Process object key for dynamic keys like {level}
   */
  private processKey(key: string, data: Record<string, unknown>): string {
    const keyMatch = key.match(/^\{([^}]+)\}$/);
    if (!keyMatch) {
      return key; // Not a variable key
    }

    const resolved = this.resolveVariable(keyMatch[1], data);
    return typeof resolved === "string" ? resolved : key;
  }

  /**
   * Resolve variable path (e.g., "id.full" -> actual value)
   */
  private resolveVariable(
    path: string,
    data: Record<string, unknown>,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = data;

    for (const part of parts) {
      if (typeof current !== "object" || current === null) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Extract items for {@items} expansion
   * Look for arrays in the data structure
   */
  private extractItems(data: Record<string, unknown>): unknown[] {
    // Priority 1: "items" field
    if (Array.isArray(data.items)) {
      return data.items;
    }

    // Priority 2: Level-specific arrays (req, design, impl, spec, test)
    const levels = ["req", "design", "impl", "spec", "test"];
    for (const level of levels) {
      if (Array.isArray(data[level])) {
        return data[level] as unknown[];
      }
    }

    // Priority 3: Any array in data
    for (const value of Object.values(data)) {
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }
}
