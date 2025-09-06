/**
 * Configuration-related Value Objects implementing Domain-Driven Design patterns
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
 * Represents a path to a configuration file
 *
 * Business Rules:
 * - Path must not be empty
 * - Must have valid config file extension (.json, .yaml, .yml, .toml)
 * - Immutable after creation
 *
 * @example
 * const result = ConfigPath.create("config.json");
 * if (result.ok) {
 *   console.log(result.data.getValue()); // "config.json"
 * }
 */
export class ConfigPath {
  private constructor(private readonly value: string) {}

  /**
   * Creates a validated ConfigPath instance
   *
   * @param path - The config file path to validate
   * @returns Result containing either a valid ConfigPath or validation error
   */
  static create(
    path: string,
  ): Result<ConfigPath, DomainError & { message: string }> {
    if (!path || path.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Input cannot be empty"),
      };
    }
    // Validate config file extensions
    if (
      !path.endsWith(".json") && !path.endsWith(".yaml") &&
      !path.endsWith(".yml") && !path.endsWith(".toml")
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: path,
          expectedFormat: ".json, .yaml, .yml, or .toml",
        }, "Invalid file extension"),
      };
    }
    return { ok: true, data: new ConfigPath(path) };
  }

  /**
   * Gets the raw path value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Resolves the config path relative to a base path
   * @param basePath - Base directory path
   * @returns Resolved absolute or relative path
   */
  resolve(basePath: string): string {
    if (this.value.startsWith("/")) {
      return this.value;
    }
    return `${basePath}/${this.value}`;
  }
}

/**
 * Represents a path to a template file
 *
 * Business Rules:
 * - Path must not be empty
 * - Immutable after creation
 *
 * @example
 * const result = TemplatePath.create("templates/output.hbs");
 * if (result.ok) {
 *   console.log(result.data.getValue()); // "templates/output.hbs"
 * }
 */
export class TemplatePath {
  private constructor(private readonly value: string) {}

  /**
   * Creates a validated TemplatePath instance
   *
   * @param path - The template file path to validate
   * @returns Result containing either a valid TemplatePath or validation error
   */
  static create(
    path: string,
  ): Result<TemplatePath, DomainError & { message: string }> {
    if (!path || path.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Input cannot be empty"),
      };
    }

    return { ok: true, data: new TemplatePath(path) };
  }

  /**
   * Gets the raw path value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Resolves the template path relative to a base path
   * @param basePath - Base directory path
   * @returns Resolved absolute or relative path
   */
  resolve(basePath: string): string {
    if (this.value.startsWith("/")) {
      return this.value;
    }
    return `${basePath}/${this.value}`;
  }
}

/**
 * Represents a path for output file generation
 *
 * Business Rules:
 * - Path must not be empty
 * - Immutable after creation
 * - Can be modified to add file extensions
 *
 * @example
 * const result = OutputPath.create("output/result.json");
 * if (result.ok) {
 *   const withYaml = result.data.withExtension("yaml");
 *   console.log(withYaml.getValue()); // "output/result.yaml"
 * }
 */
export class OutputPath {
  private constructor(private readonly value: string) {}

  /**
   * Creates a validated OutputPath instance
   *
   * @param path - The output file path to validate
   * @returns Result containing either a valid OutputPath or validation error
   */
  static create(
    path: string,
  ): Result<OutputPath, DomainError & { message: string }> {
    if (!path || path.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Input cannot be empty"),
      };
    }

    return { ok: true, data: new OutputPath(path) };
  }

  /**
   * Gets the raw path value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Creates a new OutputPath with a different file extension
   * @param ext - New file extension (without dot)
   * @returns New OutputPath instance with the specified extension
   */
  withExtension(ext: string): OutputPath {
    const withoutExt = this.value.replace(/\.[^/.]+$/, "");
    return new OutputPath(`${withoutExt}.${ext}`);
  }
}
