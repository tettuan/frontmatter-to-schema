/**
 * ArrayTarget Value Object
 *
 * Represents a schema array that should be populated from frontmatter files
 * following the x-frontmatter-part: true specification from requirements.ja.md
 *
 * Implements Smart Constructor pattern with Totality principles
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";

/**
 * ArrayTarget represents a schema property that should collect frontmatter data
 */
export class ArrayTarget {
  private constructor(
    private readonly propertyPath: string,
    private readonly itemSchema: unknown,
    private readonly templatePath?: string,
  ) {}

  /**
   * Smart Constructor - Creates ArrayTarget from schema property analysis
   */
  static create(
    propertyPath: string,
    propertySchema: unknown,
  ): Result<ArrayTarget, DomainError & { message: string }> {
    // Validate property path
    if (!propertyPath || propertyPath.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "ArrayTarget property path cannot be empty",
        ),
      };
    }

    // Validate schema is an object
    if (typeof propertySchema !== "object" || propertySchema === null) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(propertySchema),
            expectedFormat: "object",
          },
          `ArrayTarget schema must be an object, got: ${typeof propertySchema}`,
        ),
      };
    }

    const schema = propertySchema as Record<string, unknown>;

    // Validate type is array
    if (schema.type !== "array") {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(schema.type),
            expectedFormat: "array",
          },
          `ArrayTarget must have type 'array', got: ${schema.type}`,
        ),
      };
    }

    // Validate has x-frontmatter-part: true
    if (schema["x-frontmatter-part"] !== true) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(schema["x-frontmatter-part"]),
            expectedFormat: "true",
          },
          "ArrayTarget must have 'x-frontmatter-part': true",
        ),
      };
    }

    // Extract item schema
    const itemSchema = schema.items;
    if (!itemSchema) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: JSON.stringify(schema),
            expectedFormat: "schema with items property",
          },
          "ArrayTarget must have 'items' schema definition",
        ),
      };
    }

    // Extract template path if specified (for array items)
    const templatePath = this.extractTemplatePath(itemSchema);

    return {
      ok: true,
      data: new ArrayTarget(propertyPath, itemSchema, templatePath),
    };
  }

  /**
   * Extract template path from item schema if present
   */
  private static extractTemplatePath(itemSchema: unknown): string | undefined {
    if (typeof itemSchema === "object" && itemSchema !== null) {
      const schema = itemSchema as Record<string, unknown>;
      const templatePath = schema["x-template"];
      return typeof templatePath === "string" ? templatePath : undefined;
    }
    return undefined;
  }

  /**
   * Get the property path (e.g., "tools.commands", "books")
   */
  getPropertyPath(): string {
    return this.propertyPath;
  }

  /**
   * Get the schema for individual array items
   */
  getItemSchema(): unknown {
    return this.itemSchema;
  }

  /**
   * Get the template path for array items if specified
   */
  getItemTemplatePath(): string | undefined {
    return this.templatePath;
  }

  /**
   * Check if array items have their own template
   */
  hasItemTemplate(): boolean {
    return this.templatePath !== undefined;
  }

  /**
   * Get the final property name (last part of path)
   */
  getPropertyName(): string {
    return this.propertyPath.split(".").pop() || this.propertyPath;
  }

  /**
   * Get the parent path (all but last part)
   */
  getParentPath(): string | undefined {
    const parts = this.propertyPath.split(".");
    if (parts.length <= 1) return undefined;
    return parts.slice(0, -1).join(".");
  }

  /**
   * Check if this target is nested (has parent path)
   */
  isNested(): boolean {
    return this.propertyPath.includes(".");
  }

  /**
   * Value equality comparison
   */
  equals(other: ArrayTarget): boolean {
    return this.propertyPath === other.propertyPath &&
      JSON.stringify(this.itemSchema) === JSON.stringify(other.itemSchema) &&
      this.templatePath === other.templatePath;
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    const template = this.templatePath
      ? ` (template: ${this.templatePath})`
      : "";
    return `ArrayTarget[${this.propertyPath}]${template}`;
  }
}
