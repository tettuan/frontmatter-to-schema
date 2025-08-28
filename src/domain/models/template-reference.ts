/**
 * Template Reference Value Object
 *
 * Implements Smart Constructor pattern following Totality principle
 * Handles template reference syntax like {"": "command-template.json"}
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Template Reference Types - Discriminated Union
 */
export type TemplateReferenceType =
  | { kind: "placeholder"; path: string } // {{path}}
  | { kind: "file_reference"; path: string } // {"": "path"}
  | { kind: "array_item"; templatePath: string } // {"": "template.json"} for arrays
  | { kind: "literal"; value: string }; // plain string

/**
 * Template Reference Value Object
 * Represents different types of template references with validation
 */
export class TemplateReference {
  private constructor(
    private readonly type: TemplateReferenceType,
    private readonly originalValue: string,
  ) {}

  /**
   * Smart Constructor - validates and creates TemplateReference
   */
  static create(
    value: string,
  ): Result<TemplateReference, DomainError & { message: string }> {
    if (typeof value !== "string") {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof value,
          expectedFormat: "string",
        }, "Template reference must be a string"),
      };
    }

    if (value.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "template_reference",
        }, "Template reference cannot be empty"),
      };
    }

    // Parse template reference type
    const typeResult = TemplateReference.parseReferenceType(value);
    if (!typeResult.ok) {
      return typeResult;
    }

    return {
      ok: true,
      data: new TemplateReference(typeResult.data, value),
    };
  }

  /**
   * Parse template reference type from string value
   */
  private static parseReferenceType(
    value: string,
  ): Result<TemplateReferenceType, DomainError & { message: string }> {
    const trimmed = value.trim();

    // Check for placeholder syntax: {{path}}
    if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
      const path = trimmed.slice(2, -2).trim();
      if (path === "") {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: value,
            expectedFormat: "{{non-empty-path}}",
          }, "Placeholder path cannot be empty"),
        };
      }
      return {
        ok: true,
        data: { kind: "placeholder", path },
      };
    }

    // Check for file reference syntax: {"": "path"}
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (
          typeof parsed === "object" && parsed !== null &&
          !Array.isArray(parsed)
        ) {
          // Check for empty key file reference pattern
          if ("" in parsed && typeof parsed[""] === "string") {
            const templatePath = parsed[""];
            if (templatePath.trim() === "") {
              return {
                ok: false,
                error: createDomainError({
                  kind: "InvalidFormat",
                  input: value,
                  expectedFormat: '{"": "non-empty-path"}',
                }, "Template file path cannot be empty"),
              };
            }

            // Determine if it's for array processing
            const isArrayTemplate = templatePath.includes("array") ||
              templatePath.includes("item") ||
              templatePath.includes("command"); // Common patterns

            if (isArrayTemplate) {
              return {
                ok: true,
                data: { kind: "array_item", templatePath },
              };
            } else {
              return {
                ok: true,
                data: { kind: "file_reference", path: templatePath },
              };
            }
          }
        }
      } catch {
        // JSON parsing failed, treat as literal
      }
    }

    // Default: literal string value
    return {
      ok: true,
      data: { kind: "literal", value: trimmed },
    };
  }

  /**
   * Get the reference type
   */
  getType(): TemplateReferenceType {
    return this.type;
  }

  /**
   * Get the original string value
   */
  getOriginalValue(): string {
    return this.originalValue;
  }

  /**
   * Check if this is a placeholder reference
   */
  isPlaceholder(): boolean {
    return this.type.kind === "placeholder";
  }

  /**
   * Check if this is a file reference
   */
  isFileReference(): boolean {
    return this.type.kind === "file_reference";
  }

  /**
   * Check if this is an array item template
   */
  isArrayItem(): boolean {
    return this.type.kind === "array_item";
  }

  /**
   * Check if this is a literal value
   */
  isLiteral(): boolean {
    return this.type.kind === "literal";
  }

  /**
   * Get the path for placeholder or file references
   */
  getPath(): Result<string, DomainError & { message: string }> {
    switch (this.type.kind) {
      case "placeholder":
        return { ok: true, data: this.type.path };
      case "file_reference":
        return { ok: true, data: this.type.path };
      case "array_item":
        return { ok: true, data: this.type.templatePath };
      case "literal":
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: this.originalValue,
            expectedFormat: "placeholder or file reference",
          }, "Cannot get path from literal template reference"),
        };
    }
  }

  /**
   * Get the literal value for literal references
   */
  getLiteralValue(): Result<string, DomainError & { message: string }> {
    if (this.type.kind === "literal") {
      return { ok: true, data: this.type.value };
    }
    return {
      ok: false,
      error: createDomainError({
        kind: "InvalidFormat",
        input: this.originalValue,
        expectedFormat: "literal value",
      }, "Cannot get literal value from non-literal template reference"),
    };
  }

  /**
   * Create a string representation for debugging
   */
  toString(): string {
    switch (this.type.kind) {
      case "placeholder":
        return `TemplateReference(placeholder: ${this.type.path})`;
      case "file_reference":
        return `TemplateReference(file: ${this.type.path})`;
      case "array_item":
        return `TemplateReference(array_item: ${this.type.templatePath})`;
      case "literal":
        return `TemplateReference(literal: ${this.type.value})`;
    }
  }
}

/**
 * Type guard for TemplateReference
 */
export function isTemplateReference(
  value: unknown,
): value is TemplateReference {
  return value instanceof TemplateReference;
}
