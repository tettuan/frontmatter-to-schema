/**
 * Template Variable Resolver Service
 *
 * Resolves template variables with support for nested paths,
 * fallback values, and various substitution patterns.
 * Follows DDD principles with robust error handling.
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";

export class TemplateVariableResolver {
  /**
   * Resolve template variables in a template object
   */
  resolve(
    template: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Result<Record<string, unknown>, DomainError> {
    try {
      const resolved = this.resolveObject(template, data);
      return { ok: true, data: resolved as Record<string, unknown> };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ParseError",
          input: JSON.stringify(template).substring(0, 100),
          details: `Failed to resolve template: ${error}`,
        } as DomainError,
      };
    }
  }

  /**
   * Recursively resolve an object's template variables
   */
  private resolveObject(
    obj: unknown,
    data: Record<string, unknown>,
  ): unknown {
    if (typeof obj === "string") {
      return this.resolveString(obj, data);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.resolveObject(item, data));
    }

    if (obj && typeof obj === "object") {
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveObject(value, data);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Resolve variables in a string template
   */
  private resolveString(
    template: string,
    data: Record<string, unknown>,
  ): string {
    return template.replace(
      /\{\{([^}]+)\}\}/g,
      (_match, expression) => {
        const trimmed = expression.trim();

        // Handle fallback syntax: {{path || 'default'}}
        if (trimmed.includes("||")) {
          const [path, fallback] = trimmed.split("||").map((s: string) =>
            s.trim()
          );
          const value = this.getNestedValue(data, path);
          if (value === undefined || value === null || value === "") {
            // Remove quotes from fallback if present
            return fallback.replace(/^['"]|['"]$/g, "");
          }
          return String(value);
        }

        // Regular path resolution
        const value = this.getNestedValue(data, trimmed);
        return value !== undefined ? String(value) : "";
      },
    );
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      if (typeof current === "object") {
        // Handle array index notation
        const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
        if (arrayMatch) {
          const [, key, index] = arrayMatch;
          const arr = (current as Record<string, unknown>)[key];
          if (Array.isArray(arr)) {
            current = arr[parseInt(index, 10)];
          } else {
            return undefined;
          }
        } else if (part.match(/^\d+$/)) {
          // Direct array index
          if (Array.isArray(current)) {
            current = current[parseInt(part, 10)];
          } else {
            return undefined;
          }
        } else {
          // Regular object property
          current = (current as Record<string, unknown>)[part];
        }
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Validate template syntax
   */
  validateTemplate(template: unknown): Result<void, DomainError> {
    try {
      this.validateObject(template);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ParseError",
          input: "template",
          details: `Template validation failed: ${error}`,
        } as DomainError,
      };
    }
  }

  /**
   * Recursively validate template object
   */
  private validateObject(obj: unknown): void {
    if (typeof obj === "string") {
      this.validateTemplateString(obj);
    } else if (Array.isArray(obj)) {
      obj.forEach((item) => this.validateObject(item));
    } else if (obj && typeof obj === "object") {
      Object.values(obj).forEach((value) => this.validateObject(value));
    }
  }

  /**
   * Validate template string syntax
   */
  private validateTemplateString(template: string): void {
    let openCount = 0;
    let closeCount = 0;

    for (let i = 0; i < template.length - 1; i++) {
      if (template[i] === "{" && template[i + 1] === "{") {
        openCount++;
        i++; // Skip next character
      } else if (template[i] === "}" && template[i + 1] === "}") {
        closeCount++;
        i++; // Skip next character
      }
    }

    if (openCount !== closeCount) {
      throw new Error(
        `Unmatched template delimiters: ${openCount} opens, ${closeCount} closes`,
      );
    }
  }
}
