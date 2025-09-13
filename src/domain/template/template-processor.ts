/**
 * Template Processor - Core template processing following requirements
 *
 * Key Principles:
 * 1. Template defines the complete output format - only what's in template is output
 * 2. {variable.path} patterns are replaced with actual values
 * 3. No schema structure inference or completion
 * 4. x-frontmatter-part arrays follow the same rules
 */

import type { Result } from "../core/result.ts";

export interface TemplateProcessingContext {
  data: Record<string, unknown>;
  arrayItems?: Record<string, unknown>[];
}

export class TemplateProcessor {
  /**
   * Process template with variable substitution
   * Template content completely defines output structure
   */
  process(
    templateContent: string,
    context: TemplateProcessingContext,
  ): Result<string, { kind: string; message: string }> {
    try {
      // Try to parse as JSON first
      let templateObj: unknown;
      let isJsonTemplate = true;

      try {
        templateObj = JSON.parse(templateContent);
      } catch {
        // If not JSON, treat as plain text template
        isJsonTemplate = false;
        templateObj = templateContent;
      }

      // Process the template
      const processed = this.processValue(templateObj, context);

      // Return processed result
      if (isJsonTemplate) {
        return {
          ok: true,
          data: JSON.stringify(processed, null, 2),
        };
      } else {
        // For plain text templates, return as string
        return {
          ok: true,
          data: String(processed),
        };
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "TemplateProcessingError",
          message: `Failed to process template: ${String(error)}`,
        },
      };
    }
  }

  private processValue(
    value: unknown,
    context: TemplateProcessingContext,
  ): unknown {
    if (typeof value === "string") {
      // Check if it's a variable pattern {variable.path}
      const varMatch = value.match(/^\{([^}]+)\}$/);
      if (varMatch) {
        const varPath = varMatch[1];
        const resolved = this.resolveVariable(varPath, context.data);
        return resolved !== undefined ? resolved : value;
      }
      return value;
    }

    if (Array.isArray(value)) {
      // Special handling for x-frontmatter-part arrays
      if (context.arrayItems && context.arrayItems.length > 0) {
        // Process template for each item
        return context.arrayItems.map((item) => {
          const itemContext = { data: item };
          return value.map((v) => this.processValue(v, itemContext));
        }).flat();
      }
      // Regular array processing
      return value.map((v) => this.processValue(v, context));
    }

    if (typeof value === "object" && value !== null) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.processValue(val, context);
      }
      return result;
    }

    return value;
  }

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
}
