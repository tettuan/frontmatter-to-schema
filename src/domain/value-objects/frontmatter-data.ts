/**
 * FrontmatterData Value Object
 *
 * Represents validated frontmatter data extracted from documents
 * Follows Totality principles with Smart Constructor pattern
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

/**
 * Frontmatter format types as discriminated union
 */
export type FrontmatterFormat = "yaml" | "json" | "toml";

/**
 * FrontmatterData value object with validation
 * Ensures frontmatter data is valid and well-formed
 */
export class FrontmatterData {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly format: FrontmatterFormat,
    private readonly rawContent: string,
  ) {}

  /**
   * Smart Constructor for FrontmatterData
   * Validates frontmatter structure and content
   */
  static create(
    rawContent: string,
    format: FrontmatterFormat,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Check for empty content
    if (!rawContent || rawContent.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Frontmatter content cannot be empty",
        ),
      };
    }

    const trimmedContent = rawContent.trim();

    // Parse based on format
    let parsedData: Record<string, unknown>;

    switch (format) {
      case "yaml": {
        // Basic YAML validation
        if (!trimmedContent.includes(":") && !trimmedContent.includes("-")) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: trimmedContent.substring(0, 100),
                expectedFormat: "YAML",
              },
              "Content does not appear to be valid YAML frontmatter",
            ),
          };
        }
        // For now, store as unparsed YAML
        // In production, would use a YAML parser
        parsedData = { _raw: trimmedContent };
        break;
      }

      case "json": {
        try {
          const parsed = JSON.parse(trimmedContent);
          if (typeof parsed !== "object" || parsed === null) {
            return {
              ok: false,
              error: createDomainError(
                {
                  kind: "InvalidFormat",
                  input: trimmedContent.substring(0, 100),
                  expectedFormat: "JSON object",
                },
                "Frontmatter must be a JSON object",
              ),
            };
          }
          parsedData = parsed as Record<string, unknown>;
        } catch (error) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "ParseError",
                input: trimmedContent.substring(0, 100),
                details: error instanceof Error ? error.message : String(error),
              },
              "Invalid JSON frontmatter",
            ),
          };
        }
        break;
      }

      case "toml": {
        // Basic TOML validation
        if (!trimmedContent.includes("=") && !trimmedContent.includes("[")) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "InvalidFormat",
                input: trimmedContent.substring(0, 100),
                expectedFormat: "TOML",
              },
              "Content does not appear to be valid TOML frontmatter",
            ),
          };
        }
        // For now, store as unparsed TOML
        // In production, would use a TOML parser
        parsedData = { _raw: trimmedContent };
        break;
      }

      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = format;
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(_exhaustiveCheck),
              expectedFormat: "yaml, json, or toml",
            },
            `Unknown frontmatter format: ${String(_exhaustiveCheck)}`,
          ),
        };
      }
    }

    return {
      ok: true,
      data: new FrontmatterData(parsedData, format, trimmedContent),
    };
  }

  /**
   * Create from already parsed data
   */
  static createFromParsed(
    data: Record<string, unknown>,
    format: FrontmatterFormat = "yaml",
  ): Result<FrontmatterData, DomainError & { message: string }> {
    // Validate data is not empty
    if (!data || Object.keys(data).length === 0) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Frontmatter data cannot be empty",
        ),
      };
    }

    // Generate raw content based on format
    let rawContent: string;
    try {
      if (format === "json") {
        rawContent = JSON.stringify(data, null, 2);
      } else {
        // For YAML/TOML, store a simplified representation
        rawContent = Object.entries(data)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join("\n");
      }
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "SerializationError",
            data: "[object]",
            format,
          },
          `Cannot serialize frontmatter data: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }

    return {
      ok: true,
      data: new FrontmatterData(data, format, rawContent),
    };
  }

  /**
   * Get the parsed data
   */
  getData(): Record<string, unknown> {
    return { ...this.data };
  }

  /**
   * Get the format
   */
  getFormat(): FrontmatterFormat {
    return this.format;
  }

  /**
   * Get the raw content
   */
  getRawContent(): string {
    return this.rawContent;
  }

  /**
   * Check if a field exists
   */
  hasField(fieldName: string): boolean {
    return fieldName in this.data;
  }

  /**
   * Get a field value
   */
  getField(
    fieldName: string,
  ): Result<unknown, DomainError & { message: string }> {
    if (!this.hasField(fieldName)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "NotFound",
            resource: "field",
            name: fieldName,
          },
          `Field not found in frontmatter: ${fieldName}`,
        ),
      };
    }
    return { ok: true, data: this.data[fieldName] };
  }

  /**
   * Get a field value with type checking
   */
  getFieldAs<T>(
    fieldName: string,
    validator: (value: unknown) => value is T,
  ): Result<T, DomainError & { message: string }> {
    const fieldResult = this.getField(fieldName);
    if (!fieldResult.ok) return fieldResult;

    if (!validator(fieldResult.data)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(fieldResult.data),
            expectedFormat: "expected type",
          },
          `Field '${fieldName}' has invalid type`,
        ),
      };
    }

    return { ok: true, data: fieldResult.data };
  }

  /**
   * Get all field names
   */
  getFieldNames(): string[] {
    return Object.keys(this.data);
  }

  /**
   * Count fields
   */
  getFieldCount(): number {
    return Object.keys(this.data).length;
  }

  /**
   * Check if data is empty
   */
  isEmpty(): boolean {
    return Object.keys(this.data).length === 0;
  }

  /**
   * Merge with another frontmatter data
   */
  merge(
    other: FrontmatterData,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const mergedData = {
      ...this.data,
      ...other.data,
    };

    return FrontmatterData.createFromParsed(mergedData, this.format);
  }

  /**
   * Filter fields by predicate
   */
  filter(
    predicate: (key: string, value: unknown) => boolean,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    const filteredData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(this.data)) {
      if (predicate(key, value)) {
        filteredData[key] = value;
      }
    }

    if (Object.keys(filteredData).length === 0) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Filtered frontmatter data is empty",
        ),
      };
    }

    return FrontmatterData.createFromParsed(filteredData, this.format);
  }

  /**
   * Transform to different format
   */
  transformTo(
    targetFormat: FrontmatterFormat,
  ): Result<FrontmatterData, DomainError & { message: string }> {
    if (targetFormat === this.format) {
      return { ok: true, data: this };
    }

    return FrontmatterData.createFromParsed(this.data, targetFormat);
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    const fieldCount = this.getFieldCount();
    return `FrontmatterData(${this.format}, ${fieldCount} fields)`;
  }
}
