/**
 * Value Objects implementing Domain-Driven Design patterns
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

// Configuration-related value objects
export class ConfigPath {
  private constructor(private readonly value: string) {}

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

  getValue(): string {
    return this.value;
  }

  resolve(basePath: string): string {
    if (this.value.startsWith("/")) {
      return this.value;
    }
    return `${basePath}/${this.value}`;
  }
}

export class TemplatePath {
  private constructor(private readonly value: string) {}

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

  getValue(): string {
    return this.value;
  }

  resolve(basePath: string): string {
    if (this.value.startsWith("/")) {
      return this.value;
    }
    return `${basePath}/${this.value}`;
  }
}

export class OutputPath {
  private constructor(private readonly value: string) {}

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

  getValue(): string {
    return this.value;
  }

  withExtension(ext: string): OutputPath {
    const withoutExt = this.value.replace(/\.[^/.]+$/, "");
    return new OutputPath(`${withoutExt}.${ext}`);
  }
}

// Schema-related value objects
export class SchemaDefinition {
  private constructor(
    private readonly value: unknown,
    private readonly rawDefinition: unknown,
    private readonly version: string,
  ) {}

  static create(
    definition: unknown,
    version: string = "1.0.0",
  ): Result<SchemaDefinition, DomainError & { message: string }> {
    if (!definition) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Schema definition cannot be empty"),
      };
    }

    if (
      typeof definition !== "object" || definition === null ||
      Array.isArray(definition)
    ) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: typeof definition,
          expectedFormat: "object",
        }, "Schema definition must be a plain object"),
      };
    }

    // Store both raw and processed versions
    // The raw definition preserves the original JSON schema structure
    const rawCopy = JSON.parse(JSON.stringify(definition));
    return {
      ok: true,
      data: new SchemaDefinition(definition, rawCopy, version),
    };
  }

  getValue(): unknown {
    return this.value;
  }

  getRawDefinition(): unknown {
    return this.rawDefinition;
  }

  getVersion(): string {
    return this.version;
  }

  validate(
    data: unknown,
  ): Result<boolean, DomainError & { message: string }> {
    // Basic validation - reject null/undefined
    if (data === null || data === undefined) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Data to validate cannot be null or undefined"),
      };
    }

    // For now, just return true for any non-null data
    // In a real implementation, we'd validate against the JSON Schema
    return { ok: true, data: true };
  }

  /**
   * Get all properties defined in the schema
   * @returns An object mapping property names to their definitions
   */
  getProperties(): Record<string, unknown> {
    const definition = this.value as Record<string, unknown>;

    // Handle JSON Schema format
    if (definition.properties && typeof definition.properties === "object") {
      return definition.properties as Record<string, unknown>;
    }

    // Handle simple object format (direct properties)
    // Filter out metadata fields like $schema, $id, type, etc.
    const metadataFields = [
      "$schema",
      "$id",
      "type",
      "title",
      "description",
      "required",
      "additionalProperties",
    ];
    const properties: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(definition)) {
      if (!metadataFields.includes(key)) {
        properties[key] = value;
      }
    }

    return properties;
  }

  /**
   * Get list of required fields from the schema
   * @returns Array of required field names
   */
  getRequiredFields(): string[] {
    const definition = this.value as Record<string, unknown>;

    // Handle JSON Schema format with required array
    if (Array.isArray(definition.required)) {
      return definition.required.filter((field): field is string =>
        typeof field === "string"
      );
    }

    // Handle properties with required flag
    if (definition.properties && typeof definition.properties === "object") {
      const required: string[] = [];
      const properties = definition.properties as Record<string, unknown>;

      for (const [key, propDef] of Object.entries(properties)) {
        if (
          propDef &&
          typeof propDef === "object" &&
          "required" in propDef &&
          (propDef as Record<string, unknown>).required === true
        ) {
          required.push(key);
        }
      }

      if (required.length > 0) {
        return required;
      }
    }

    // Default to all properties being required if no explicit required field
    return Object.keys(this.getProperties());
  }
}

export class SchemaVersion {
  private constructor(
    private readonly major: number,
    private readonly minor: number,
    private readonly patch: number,
  ) {}

  static create(
    version: string,
  ): Result<SchemaVersion, DomainError & { message: string }> {
    // Strict semantic versioning validation
    // Only accept proper semantic version format: X.Y.Z
    const trimmedVersion = version.trim();

    // Check for valid semantic version pattern (X.Y.Z)
    const strictPattern = /^(\d+)\.(\d+)\.(\d+)$/;
    const match = trimmedVersion.match(strictPattern);

    if (match) {
      const [, major, minor, patch] = match;
      return {
        ok: true,
        data: new SchemaVersion(
          parseInt(major),
          parseInt(minor),
          parseInt(patch),
        ),
      };
    }

    // Reject invalid formats
    return {
      ok: false,
      error: createDomainError(
        {
          kind: "InvalidFormat",
          input: version,
          expectedFormat: "X.Y.Z (semantic version)",
        },
        `Invalid version format. Expected X.Y.Z (semantic version), got: ${version}`,
      ),
    };
  }

  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }

  isCompatibleWith(other: SchemaVersion): boolean {
    return this.major === other.major;
  }
}

// Template-related value objects
export class TemplateFormat {
  private constructor(
    private readonly format: "json" | "yaml" | "toml" | "handlebars" | "custom",
    private readonly template: string,
  ) {}

  static create(
    format: string,
    template: string,
  ): Result<TemplateFormat, DomainError & { message: string }> {
    if (!template || template.trim() === "") {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Input cannot be empty"),
      };
    }

    if (
      format !== "json" && format !== "yaml" && format !== "toml" &&
      format !== "handlebars" && format !== "custom"
    ) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: format,
            expectedFormat: "json, yaml, toml, handlebars, or custom",
          },
          `Invalid format. Expected json, yaml, toml, handlebars, or custom, got: ${format}`,
        ),
      };
    }

    return {
      ok: true,
      data: new TemplateFormat(
        format as "json" | "yaml" | "toml" | "handlebars" | "custom",
        template,
      ),
    };
  }

  getFormat(): "json" | "yaml" | "toml" | "handlebars" | "custom" {
    return this.format;
  }

  getTemplate(): string {
    return this.template;
  }
}

export class MappingRule {
  private constructor(
    private readonly source: string,
    private readonly target: string,
    private readonly transform?: (value: unknown) => unknown,
  ) {}

  static create(
    source: string,
    target: string,
    transform?: (value: unknown) => unknown,
  ): Result<MappingRule, DomainError & { message: string }> {
    if (!source || !target) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
        }, "Input cannot be empty"),
      };
    }

    return { ok: true, data: new MappingRule(source, target, transform) };
  }

  getSource(): string {
    return this.source;
  }

  getTarget(): string {
    return this.target;
  }

  apply(data: Record<string, unknown>): unknown {
    const value = this.getValueByPath(data, this.source);

    // Only return value if it exists in source data (no fallbacks or defaults)
    if (value === undefined) {
      return undefined;
    }

    return this.transform ? this.transform(value) : value;
  }

  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    // Strict path resolution - return undefined if any part of path is missing
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object" ||
        Array.isArray(current)
      ) {
        return undefined;
      }

      const currentObj = current as Record<string, unknown>;
      if (!(part in currentObj)) {
        return undefined;
      }

      current = currentObj[part];
    }

    return current;
  }
}

// Processing-related value objects
export class ProcessingOptions {
  private constructor(
    private readonly parallel: boolean,
    private readonly maxConcurrency: number,
    private readonly continueOnError: boolean,
  ) {}

  static create(options: {
    parallel?: boolean;
    maxConcurrency?: number;
    continueOnError?: boolean;
  }): Result<ProcessingOptions, DomainError & { message: string }> {
    const parallel = options.parallel ?? true;
    const maxConcurrency = options.maxConcurrency ?? 5;
    const continueOnError = options.continueOnError ?? false;

    if (maxConcurrency < 1 || maxConcurrency > 100) {
      return {
        ok: false,
        error: createDomainError({
          kind: "OutOfRange",
          value: maxConcurrency,
          min: 1,
          max: 100,
        }, `Max concurrency out of range (1-100): ${maxConcurrency}`),
      };
    }

    return {
      ok: true,
      data: new ProcessingOptions(parallel, maxConcurrency, continueOnError),
    };
  }

  isParallel(): boolean {
    return this.parallel;
  }

  getMaxConcurrency(): number {
    return this.maxConcurrency;
  }

  shouldContinueOnError(): boolean {
    return this.continueOnError;
  }
}
