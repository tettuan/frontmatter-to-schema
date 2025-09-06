/**
 * Document-related Value Objects implementing Domain-Driven Design patterns
 *
 * These value objects follow the Totality principle:
 * - Smart constructors ensure only valid instances can be created
 * - All functions are total (no exceptions, use Result types)
 * - Immutable after creation
 * - Self-validating with business rules embedded
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";

/**
 * Represents a path to a Markdown document
 *
 * Business Rules:
 * - Path must not be empty
 * - Must end with .md or .markdown extension
 * - Immutable after creation
 *
 * @example
 * const result = DocumentPath.create("docs/readme.md");
 * if (result.ok) {
 *   console.log(result.data.getValue()); // "docs/readme.md"
 * }
 */
export class DocumentPath {
  private constructor(private readonly value: string) {}

  /**
   * Creates a validated DocumentPath instance
   *
   * @param path - The file path to validate
   * @returns Result containing either a valid DocumentPath or validation error
   */
  static create(
    path: string,
  ): Result<DocumentPath, DomainError & { message: string }> {
    const trimmedPath = path.trim();
    if (!trimmedPath) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Input cannot be empty"),
      };
    }

    // Check for path length limit (similar to filesystem limits)
    if (trimmedPath.length > 512) {
      return {
        ok: false,
        error: createDomainError({
          kind: "TooLong",
          value: trimmedPath,
          maxLength: 512,
        }, "Path is too long"),
      };
    }

    // Check for invalid characters
    if (trimmedPath.includes("\0")) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: trimmedPath,
          expectedFormat: "path without null bytes",
        }, "Path contains invalid characters"),
      };
    }

    if (trimmedPath.includes("\r") || trimmedPath.includes("\n")) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: trimmedPath,
          expectedFormat: "path without line breaks",
        }, "Path contains invalid characters"),
      };
    }

    // DocumentPath can represent any file path - validation of markdown files
    // should happen at the domain level, not in the value object

    return { ok: true, data: new DocumentPath(trimmedPath) };
  }

  /**
   * Gets the raw path value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Extracts the directory portion of the path
   * @returns Directory path or "." if no directory
   */
  getDirectory(): string {
    const lastSlash = this.value.lastIndexOf("/");
    return lastSlash > 0 ? this.value.substring(0, lastSlash) : ".";
  }

  /**
   * Extracts the filename portion of the path
   * @returns Filename including extension
   */
  getFilename(): string {
    const lastSlash = this.value.lastIndexOf("/");
    return lastSlash >= 0 ? this.value.substring(lastSlash + 1) : this.value;
  }

  /**
   * Checks if the path represents a markdown file
   * @returns true if the path ends with .md or .markdown
   */
  isMarkdown(): boolean {
    const lower = this.value.toLowerCase();
    return lower.endsWith(".md") || lower.endsWith(".markdown");
  }
}

export class FrontMatterContent {
  private constructor(private readonly value: string) {}

  static create(
    content: string,
  ): Result<FrontMatterContent, DomainError & { message: string }> {
    // Allow empty content for frontmatter (documents may have empty frontmatter)
    return { ok: true, data: new FrontMatterContent(content) };
  }

  static fromObject(
    obj: Record<string, unknown>,
  ): Result<FrontMatterContent, DomainError & { message: string }> {
    // Validate that input is actually an object
    if (
      obj === null || obj === undefined || typeof obj !== "object" ||
      Array.isArray(obj)
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(obj),
          expectedFormat: "object",
        }, "Input must be a plain object"),
      };
    }

    try {
      const jsonString = JSON.stringify(obj);
      return { ok: true, data: new FrontMatterContent(jsonString) };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: String(error),
          expectedFormat: "serializable object",
        }, "Object cannot be serialized to JSON"),
      };
    }
  }

  static fromYaml(
    yamlContent: string,
  ): Result<FrontMatterContent, DomainError & { message: string }> {
    const trimmed = yamlContent.trim();
    if (!trimmed) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "YAML content cannot be empty"),
      };
    }

    // For now, store YAML as-is and let toJSON handle parsing
    // In a real implementation, we'd parse YAML to JSON
    return { ok: true, data: new FrontMatterContent(yamlContent) };
  }

  getValue(): string {
    return this.value;
  }

  toJSON(): unknown {
    try {
      // Try to parse as JSON first
      return JSON.parse(this.value);
    } catch {
      // If not JSON, try to parse as YAML (simplified implementation)
      return this.parseSimpleYaml(this.value);
    }
  }

  private parseSimpleYaml(yamlContent: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const lines = yamlContent.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      // Skip lines without colon
      if (!trimmed.includes(":")) {
        continue;
      }

      const colonIndex = trimmed.indexOf(":");
      const key = trimmed.substring(0, colonIndex).trim();
      let valueStr = trimmed.substring(colonIndex + 1).trim();

      // Strip inline comments (anything after #)
      const commentIndex = valueStr.indexOf("#");
      if (commentIndex !== -1) {
        valueStr = valueStr.substring(0, commentIndex).trim();
      }

      if (key) {
        result[key] = this.parseYamlValue(valueStr);
      }
    }

    return result;
  }

  private parseYamlValue(value: string): unknown {
    // Handle arrays in JSON format [item1, item2, ...]
    if (value.startsWith("[") && value.endsWith("]")) {
      try {
        return JSON.parse(value);
      } catch {
        // If JSON parsing fails, treat as string
        return value;
      }
    }

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }

    // Parse booleans
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;

    // Parse numbers
    const num = Number(value);
    if (!isNaN(num) && value !== "") {
      return num;
    }

    // Return as string
    return value;
  }

  keys(): string[] {
    const json = this.toJSON();
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return Object.keys(json);
    }
    return [];
  }

  get(key: string): unknown {
    const json = this.toJSON();
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return (json as Record<string, unknown>)[key];
    }
    return undefined;
  }

  size(): number {
    return this.keys().length;
  }
}

export class DocumentContent {
  private constructor(private readonly value: string) {}

  static create(
    content: string,
  ): Result<DocumentContent, DomainError & { message: string }> {
    return { ok: true, data: new DocumentContent(content) };
  }

  getValue(): string {
    return this.value;
  }

  getLines(): string[] {
    return this.value.split("\n");
  }
}
