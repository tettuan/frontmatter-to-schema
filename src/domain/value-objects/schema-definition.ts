/**
 * SchemaDefinition Value Object
 *
 * Represents a validated schema definition
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";
import { DEFAULT_ERROR_CONTEXT_LIMIT } from "../shared/constants.ts";

/**
 * Supported schema formats as discriminated union
 */
export type SchemaFormatType = "json" | "yaml" | "custom";

/**
 * SchemaDefinition value object with validation
 * Ensures schema definition is valid and well-formed
 */
export class SchemaDefinition {
  private constructor(
    private readonly definition: string,
    private readonly format: SchemaFormatType,
    private readonly parsedSchema?: Record<string, unknown>,
  ) {}

  /**
   * Smart Constructor for SchemaDefinition
   * Validates schema structure based on format
   */
  static create(
    definition: string,
    format: SchemaFormatType,
  ): Result<SchemaDefinition, DomainError & { message: string }> {
    // Check for empty definition
    if (!definition || definition.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Schema definition cannot be empty",
        ),
      };
    }

    const trimmedDefinition = definition.trim();

    // Validate based on format
    switch (format) {
      case "json": {
        try {
          const parsed = JSON.parse(trimmedDefinition);
          if (typeof parsed !== "object" || parsed === null) {
            return {
              ok: false,
              error: createDomainError(
                {
                  kind: "InvalidFormat",
                  input: DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(
                    trimmedDefinition,
                  ),
                  expectedFormat: "JSON object",
                },
                "Schema definition must be a JSON object",
              ),
            };
          }
          return {
            ok: true,
            data: new SchemaDefinition(
              trimmedDefinition,
              format,
              parsed as Record<string, unknown>,
            ),
          };
        } catch (error) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "ParseError",
                input: DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(
                  trimmedDefinition,
                ),
                details: error instanceof Error ? error.message : String(error),
              },
              "Invalid JSON schema definition",
            ),
          };
        }
      }

      case "yaml": {
        // Basic YAML validation - check for common YAML patterns
        if (
          !trimmedDefinition.includes(":") && !trimmedDefinition.includes("-")
        ) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(
                  trimmedDefinition,
                ),
                expectedFormat: "YAML",
              },
              "Schema definition does not appear to be valid YAML",
            ),
          };
        }
        return {
          ok: true,
          data: new SchemaDefinition(trimmedDefinition, format),
        };
      }

      case "custom": {
        // Custom format - minimal validation
        return {
          ok: true,
          data: new SchemaDefinition(trimmedDefinition, format),
        };
      }

      default: {
        // Exhaustive check for discriminated union
        const _exhaustiveCheck: never = format;
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(_exhaustiveCheck),
              expectedFormat: "json, yaml, or custom",
            },
            `Unknown schema format: ${String(_exhaustiveCheck)}`,
          ),
        };
      }
    }
  }

  /**
   * Create from already parsed schema object
   */
  static createFromObject(
    schemaObject: Record<string, unknown>,
  ): Result<SchemaDefinition, DomainError & { message: string }> {
    try {
      const definition = JSON.stringify(schemaObject, null, 2);
      return {
        ok: true,
        data: new SchemaDefinition(definition, "json", schemaObject),
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: "[object]",
            expectedFormat: "serializable object",
          },
          `Cannot serialize schema object: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Get the raw schema definition string
   */
  getRawDefinition(): string {
    return this.definition;
  }

  /**
   * Get the schema format
   */
  getFormat(): SchemaFormatType {
    return this.format;
  }

  /**
   * Get parsed schema if available (only for JSON format)
   */
  getParsedSchema(): Result<
    Record<string, unknown>,
    DomainError & { message: string }
  > {
    if (this.parsedSchema) {
      return { ok: true, data: this.parsedSchema };
    }

    if (this.format === "json") {
      try {
        const parsed = JSON.parse(this.definition);
        return { ok: true, data: parsed as Record<string, unknown> };
      } catch (error) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: DEFAULT_ERROR_CONTEXT_LIMIT.truncateContent(
                this.definition,
              ),
              details: error instanceof Error ? error.message : String(error),
            },
            "Failed to parse JSON schema",
          ),
        };
      }
    }

    return {
      ok: false,
      error: createDomainError(
        {
          kind: "InvalidFormat",
          input: this.format,
          expectedFormat: "json",
        },
        `Cannot parse schema of format: ${this.format}`,
      ),
    };
  }

  /**
   * Check if schema has a specific property
   */
  hasProperty(propertyPath: string): boolean {
    const parseResult = this.getParsedSchema();
    if (!parseResult.ok) return false;

    const parts = propertyPath.split(".");
    let current: unknown = parseResult.data;

    for (const part of parts) {
      if (
        typeof current !== "object" ||
        current === null ||
        !(part in current)
      ) {
        return false;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return true;
  }

  /**
   * Get a property value from the schema
   */
  getProperty(
    propertyPath: string,
  ): Result<unknown, DomainError & { message: string }> {
    const parseResult = this.getParsedSchema();
    if (!parseResult.ok) return parseResult;

    const parts = propertyPath.split(".");
    let current: unknown = parseResult.data;

    for (const part of parts) {
      if (
        typeof current !== "object" ||
        current === null ||
        !(part in current)
      ) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "NotFound",
              resource: "property",
              name: propertyPath,
            },
            `Property not found: ${propertyPath}`,
          ),
        };
      }
      current = (current as Record<string, unknown>)[part];
    }

    return { ok: true, data: current };
  }

  /**
   * Check if this is a JSON Schema (has $schema property)
   */
  isJsonSchema(): boolean {
    return this.hasProperty("$schema");
  }

  /**
   * Get schema title if available
   */
  getTitle(): string | null {
    const titleResult = this.getProperty("title");
    if (titleResult.ok && typeof titleResult.data === "string") {
      return titleResult.data;
    }
    return null;
  }

  /**
   * Get schema description if available
   */
  getDescription(): string | null {
    const descResult = this.getProperty("description");
    if (descResult.ok && typeof descResult.data === "string") {
      return descResult.data;
    }
    return null;
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    const title = this.getTitle();
    return `SchemaDefinition(${this.format}${
      title ? `, title: "${title}"` : ""
    })`;
  }
}
