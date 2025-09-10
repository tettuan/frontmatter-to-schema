/**
 * Unified Template Renderer Service
 *
 * Consolidates template rendering logic into a single service
 * following DDD bounded context principles and Totality patterns.
 *
 * Replaces multiple renderer implementations with a single,
 * cohesive rendering service.
 */

import type { DomainError, Result } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  path: string;
  defaultValue?: unknown;
  required: boolean;
  transform?: string;
}

/**
 * Template rendering options
 */
export interface RenderOptions {
  strict?: boolean; // Fail on missing required variables
  preserveUnmatched?: boolean; // Keep unmatched placeholders
  format?: "json" | "yaml" | "text"; // Output format
}

/**
 * Rendered template result
 */
export interface RenderResult {
  content: string;
  format: string;
  variables: {
    used: string[];
    missing: string[];
    defaulted: string[];
  };
}

/**
 * Unified Template Renderer Service
 *
 * Handles template rendering with variable substitution
 * for all supported template formats.
 */
export class UnifiedTemplateRenderer {
  /**
   * Render a template with data
   */
  render(
    template: string,
    data: Record<string, unknown>,
    options: RenderOptions = {},
  ): Result<RenderResult, DomainError & { message: string }> {
    const {
      strict = false,
      preserveUnmatched = false,
      format = "text",
    } = options;

    const variables = this.extractVariables(template);
    const used: string[] = [];
    const missing: string[] = [];
    const defaulted: string[] = [];

    let rendered = template;

    // Process each variable
    for (const variable of variables) {
      const value = this.resolveVariable(variable, data);

      if (value.found) {
        rendered = this.replaceVariable(rendered, variable, value.value);
        used.push(variable.name);

        if (value.isDefault) {
          defaulted.push(variable.name);
        }
      } else {
        missing.push(variable.name);

        if (strict && variable.required) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "MissingRequiredField",
                fields: [variable.name],
              },
              `Required template variable '${variable.name}' is missing`,
            ),
          };
        }

        if (!preserveUnmatched) {
          rendered = this.replaceVariable(rendered, variable, "");
        }
      }
    }

    // Format output if needed
    const formatted = this.formatOutput(rendered, format, data);
    if (!formatted.ok) {
      return formatted;
    }

    return {
      ok: true,
      data: {
        content: formatted.data,
        format,
        variables: {
          used,
          missing,
          defaulted,
        },
      },
    };
  }

  /**
   * Extract variables from template
   */
  private extractVariables(template: string): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    const seen = new Set<string>();

    // Match {{variable}} and {{variable|default}} patterns
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(template)) !== null) {
      const full = match[1].trim();

      if (seen.has(full)) {
        continue;
      }
      seen.add(full);

      // Parse variable syntax
      const parts = full.split("|");
      const namePath = parts[0].trim();
      const defaultValue = parts[1]?.trim();

      // Check for required marker (!)
      const required = namePath.endsWith("!");
      const cleanPath = required ? namePath.slice(0, -1) : namePath;

      // Extract name from path
      const pathParts = cleanPath.split(".");
      const name = pathParts[pathParts.length - 1];

      variables.push({
        name,
        path: cleanPath,
        defaultValue,
        required,
      });
    }

    return variables;
  }

  /**
   * Resolve a variable value from data
   */
  private resolveVariable(
    variable: TemplateVariable,
    data: Record<string, unknown>,
  ): { found: boolean; value: unknown; isDefault: boolean } {
    // Navigate path in data
    const parts = variable.path.split(".");
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        break;
      }

      // Handle array index notation
      if (part.includes("[")) {
        const [arrayName, indexStr] = part.split("[");
        const index = parseInt(indexStr.replace("]", ""));

        current = (current as Record<string, unknown>)[arrayName];
        if (Array.isArray(current) && index < current.length) {
          current = current[index];
        } else {
          current = undefined;
        }
      } else {
        current = (current as Record<string, unknown>)[part];
      }
    }

    if (current !== undefined && current !== null) {
      return { found: true, value: current, isDefault: false };
    }

    if (variable.defaultValue !== undefined) {
      return { found: true, value: variable.defaultValue, isDefault: true };
    }

    return { found: false, value: undefined, isDefault: false };
  }

  /**
   * Replace a variable in template with value
   */
  private replaceVariable(
    template: string,
    variable: TemplateVariable,
    value: unknown,
  ): string {
    // Build the original variable pattern
    let pattern = variable.path;
    if (variable.required) {
      pattern += "!";
    }
    if (variable.defaultValue !== undefined) {
      pattern += `|${variable.defaultValue}`;
    }

    const regex = new RegExp(
      `\\{\\{\\s*${this.escapeRegex(pattern)}\\s*\\}\\}`,
      "g",
    );

    // Convert value to string
    const stringValue = this.valueToString(value);

    return template.replace(regex, stringValue);
  }

  /**
   * Convert value to string for template
   */
  private valueToString(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Format output based on format option
   */
  private formatOutput(
    content: string,
    format: string,
    data: Record<string, unknown>,
  ): Result<string, DomainError & { message: string }> {
    switch (format) {
      case "json":
        try {
          // Try to parse as JSON and re-stringify
          const parsed = JSON.parse(content);
          return { ok: true, data: JSON.stringify(parsed, null, 2) };
        } catch {
          // If not valid JSON, wrap in JSON
          return { ok: true, data: JSON.stringify({ content, data }, null, 2) };
        }

      case "yaml":
        // For YAML, just ensure proper formatting
        return { ok: true, data: content };

      case "text":
      default:
        return { ok: true, data: content };
    }
  }

  /**
   * Render with template validation
   */
  renderWithValidation(
    template: string,
    data: Record<string, unknown>,
    schema: unknown,
    options: RenderOptions = {},
  ): Result<RenderResult, DomainError & { message: string }> {
    // First render the template
    const renderResult = this.render(template, data, options);
    if (!renderResult.ok) {
      return renderResult;
    }

    // Then validate if schema provided
    if (schema) {
      try {
        const content = renderResult.data.content;
        const _parsed = JSON.parse(content);

        // Here we would call the schema validator
        // For now, just return the render result
        return renderResult;
      } catch (error) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "SchemaValidationFailed",
              schema,
              data: renderResult.data.content,
            },
            `Template output validation failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        };
      }
    }

    return renderResult;
  }
}
