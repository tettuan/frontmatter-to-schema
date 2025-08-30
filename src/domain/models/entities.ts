// Domain entities following DDD principles

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import type {
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
  MappingRule,
  SchemaDefinition,
  SchemaVersion,
  TemplateFormat,
} from "./value-objects.ts";
import { StrictStructureMatcher } from "./strict-structure-matcher.ts";
import { PropertyPath, PropertyPathNavigator } from "./property-path.ts";

// Discriminated union for document frontmatter state following totality principle
export type DocumentFrontMatterState =
  | { kind: "WithFrontMatter"; frontMatter: FrontMatter }
  | { kind: "NoFrontMatter" };

// Discriminated union for template application modes following totality principle
export type TemplateApplicationMode =
  | {
    kind: "WithStructuralValidation";
    schemaData: unknown;
    templateStructure: unknown;
  }
  | { kind: "SimpleMapping" };

// Discriminated union for validated data following totality principle
export type ValidatedData<T = unknown> =
  | {
    kind: "Valid";
    data: T;
    metadata: ValidationMetadata;
  }
  | {
    kind: "PartiallyValid";
    validData: Partial<T>;
    invalidFields: Array<{ field: string; error: string }>;
    metadata: ValidationMetadata;
  };

// Validation metadata
export interface ValidationMetadata {
  schemaId: string;
  schemaVersion: string;
  validatedAt: Date;
}

// ID value objects
export class DocumentId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<DocumentId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }
    return { ok: true, data: new DocumentId(value) };
  }

  static fromPath(path: DocumentPath): DocumentId {
    return new DocumentId(path.getValue());
  }

  getValue(): string {
    return this.value;
  }

  equals(other: DocumentId): boolean {
    return this.value === other.value;
  }
}

export class SchemaId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<SchemaId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }
    return { ok: true, data: new SchemaId(value) };
  }

  getValue(): string {
    return this.value;
  }

  equals(other: SchemaId): boolean {
    return this.value === other.value;
  }
}

export class TemplateId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<TemplateId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }
    return { ok: true, data: new TemplateId(value) };
  }

  getValue(): string {
    return this.value;
  }

  equals(other: TemplateId): boolean {
    return this.value === other.value;
  }
}

export class AnalysisId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<AnalysisId, DomainError> {
    if (!value || value.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
        } as DomainError,
      };
    }
    return { ok: true, data: new AnalysisId(value) };
  }

  static generate(): AnalysisId {
    return new AnalysisId(crypto.randomUUID());
  }

  getValue(): string {
    return this.value;
  }

  equals(other: AnalysisId): boolean {
    return this.value === other.value;
  }
}

// Entities
export class Document {
  constructor(
    private readonly id: DocumentId,
    private readonly path: DocumentPath,
    private readonly frontMatterState: DocumentFrontMatterState,
    private readonly content: DocumentContent,
  ) {}

  static create(
    path: DocumentPath,
    frontMatterState: DocumentFrontMatterState,
    content: DocumentContent,
  ): Document {
    return new Document(
      DocumentId.fromPath(path),
      path,
      frontMatterState,
      content,
    );
  }

  // Convenience method for backward compatibility during migration
  static createWithFrontMatter(
    path: DocumentPath,
    frontMatter: FrontMatter | null,
    content: DocumentContent,
  ): Document {
    const frontMatterState: DocumentFrontMatterState = frontMatter
      ? { kind: "WithFrontMatter", frontMatter }
      : { kind: "NoFrontMatter" };
    return new Document(
      DocumentId.fromPath(path),
      path,
      frontMatterState,
      content,
    );
  }

  getId(): DocumentId {
    return this.id;
  }

  getPath(): DocumentPath {
    return this.path;
  }

  getFrontMatterState(): DocumentFrontMatterState {
    return this.frontMatterState;
  }

  /**
   * Get front matter as a Result type following totality principle
   * This method eliminates null returns and provides explicit error handling
   */
  getFrontMatterResult(): Result<FrontMatter, DomainError> {
    switch (this.frontMatterState.kind) {
      case "WithFrontMatter":
        return { ok: true, data: this.frontMatterState.frontMatter };
      case "NoFrontMatter":
        return {
          ok: false,
          error: {
            kind: "NoFrontMatterPresent",
          } as DomainError,
        };
      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = this.frontMatterState;
        return {
          ok: false,
          error: {
            kind: "InvalidState",
            expected: "WithFrontMatter or NoFrontMatter",
            actual: String(_exhaustiveCheck),
          } as DomainError,
        };
      }
    }
  }

  getContent(): DocumentContent {
    return this.content;
  }

  hasFrontMatter(): boolean {
    return this.frontMatterState.kind === "WithFrontMatter";
  }
}

export class FrontMatter {
  constructor(
    private readonly content: FrontMatterContent,
    private readonly raw: string,
  ) {}

  static create(
    content: FrontMatterContent,
    raw: string,
  ): FrontMatter {
    return new FrontMatter(content, raw);
  }

  getContent(): FrontMatterContent {
    return this.content;
  }

  getRaw(): string {
    return this.raw;
  }

  toObject(): unknown {
    return this.content.toJSON();
  }
}

export class Schema {
  constructor(
    private readonly id: SchemaId,
    private readonly definition: SchemaDefinition,
    private readonly version: SchemaVersion,
    private readonly description: string,
  ) {}

  static create(
    id: SchemaId,
    definition: SchemaDefinition,
    version: SchemaVersion,
    description: string = "",
  ): Schema {
    return new Schema(id, definition, version, description);
  }

  getId(): SchemaId {
    return this.id;
  }

  getDefinition(): SchemaDefinition {
    return this.definition;
  }

  getVersion(): SchemaVersion {
    return this.version;
  }

  getDescription(): string {
    return this.description;
  }

  /**
   * Validate data against schema and return typed, validated data
   * Following totality principle - returns validated data instead of void
   */
  validate<T = unknown>(data: unknown): Result<ValidatedData<T>, DomainError> {
    const result = this.definition.validate(data);
    if (result.ok) {
      // Return validated data with metadata
      return {
        ok: true,
        data: {
          kind: "Valid",
          data: data as T,
          metadata: {
            schemaId: this.id.getValue(),
            schemaVersion: this.version.toString(),
            validatedAt: new Date(),
          },
        },
      };
    }

    // Return validation failure with partial data if possible
    return {
      ok: false,
      error: result.error,
    };
  }
}

export class Template {
  private readonly pathNavigator: PropertyPathNavigator;

  constructor(
    private readonly id: TemplateId,
    private readonly format: TemplateFormat,
    private readonly mappingRules: MappingRule[],
    private readonly description: string,
  ) {
    // Initialize PropertyPathNavigator service
    const navigatorResult = PropertyPathNavigator.create();
    if (!navigatorResult.ok) {
      throw new Error(
        `Failed to initialize PropertyPathNavigator: ${navigatorResult.error.message}`,
      );
    }
    this.pathNavigator = navigatorResult.data;
  }

  static create(
    id: TemplateId,
    format: TemplateFormat,
    mappingRules: MappingRule[],
    description: string = "",
  ): Template {
    return new Template(id, format, mappingRules, description);
  }

  getId(): TemplateId {
    return this.id;
  }

  getFormat(): TemplateFormat {
    return this.format;
  }

  getMappingRules(): MappingRule[] {
    return this.mappingRules;
  }

  getDescription(): string {
    return this.description;
  }

  applyRules(
    data: Record<string, unknown>,
    mode: TemplateApplicationMode,
  ): Result<Record<string, unknown>, DomainError & { message: string }> {
    // If strict structure validation is required, perform it first
    switch (mode.kind) {
      case "WithStructuralValidation": {
        const alignmentResult = StrictStructureMatcher
          .validateStructuralAlignment(
            data,
            mode.schemaData,
            mode.templateStructure,
          );

        if (!alignmentResult.ok) {
          // Return error if structures don't match exactly
          return {
            ok: false,
            error: createDomainError({
              kind: "TemplateMappingFailed",
              template: mode.templateStructure,
              source: mode.schemaData,
            }, "Data structure does not align with template structure"),
          };
        }
        break;
      }
      case "SimpleMapping":
        // No structural validation needed
        break;
      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = mode;
        throw new Error(
          `Unhandled template application mode: ${String(_exhaustiveCheck)}`,
        );
      }
    }

    // If template has content, apply placeholder substitution
    const templateContent = this.format.getTemplate();
    if (templateContent) {
      try {
        const templateObj = JSON.parse(templateContent);
        const result = this.substituteTemplateValues(templateObj, data);
        return { ok: true, data: result };
      } catch (e) {
        // If not JSON, fall back to mapping rules
        console.error("Failed to parse template as JSON:", e);
      }
    }

    // If no mapping rules are defined, return the data as-is only if structure validation passed
    if (this.mappingRules.length === 0) {
      return { ok: true, data };
    }

    const result: Record<string, unknown> = {};

    // Apply mapping rules only if structural alignment is confirmed
    for (const rule of this.mappingRules) {
      const value = rule.apply(data);
      const target = rule.getTarget();

      // Only set value if it exists in the source data (no fallbacks or defaults)
      if (value !== undefined) {
        const setResult = this.setValueByPath(result, target, value);
        if (!setResult.ok) {
          return {
            ok: false,
            error: createDomainError(
              {
                kind: "TemplateMappingFailed",
                template: target,
                source: data,
              },
              `Failed to set value at path '${target}': ${setResult.error.message}`,
            ),
          };
        }
      }
    }

    return { ok: true, data: result };
  }

  /**
   * Recursively substitute template placeholders with actual values from data
   */
  private substituteTemplateValues(
    template: unknown,
    data: Record<string, unknown>,
  ): unknown {
    if (typeof template === "string") {
      // Replace placeholders in strings
      return template.replace(/\{([^}]+)\}/g, (match, key) => {
        const value = this.getValueByPath(data, key.trim());
        return value !== undefined ? String(value) : match;
      });
    }
    
    if (Array.isArray(template)) {
      // Process arrays recursively
      return template.map(item => this.substituteTemplateValues(item, data));
    }
    
    if (template && typeof template === "object") {
      // Process objects recursively
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template as Record<string, unknown>)) {
        result[key] = this.substituteTemplateValues(value, data);
      }
      return result;
    }
    
    // Return primitives as-is
    return template;
  }

  /**
   * Get value from data object by path (supports nested paths like "options.input")
   */
  private getValueByPath(
    data: Record<string, unknown>,
    path: string,
  ): unknown {
    const keys = path.split(".");
    let current: unknown = data;
    
    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    
    return current;
  }

  /**
   * Set value by path using PropertyPathNavigator for totality compliance
   * Returns Result type instead of void to handle all error cases explicitly
   */
  private setValueByPath(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): Result<void, DomainError & { message: string }> {
    // Create PropertyPath with validation
    const propertyPathResult = PropertyPath.create(path);
    if (!propertyPathResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: path,
          expectedFormat: "valid.property.path",
        }, `Invalid property path: ${propertyPathResult.error.message}`),
      };
    }

    // Use PropertyPathNavigator for safe assignment
    const assignmentResult = this.pathNavigator.assign(
      obj,
      propertyPathResult.data,
      value,
    );

    if (!assignmentResult.ok) {
      return assignmentResult;
    }

    // Handle specific assignment results
    switch (assignmentResult.data.kind) {
      case "Success":
      case "PathCreated":
        // Both are successful outcomes
        return { ok: true, data: undefined };
      case "TypeConflict":
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: assignmentResult.data.existingType,
              expectedFormat: "object",
            },
            `Type conflict at path segment '${assignmentResult.data.conflictSegment}': expected object, got ${assignmentResult.data.existingType}`,
          ),
        };
      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = assignmentResult.data;
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidState",
            expected: "Success, PathCreated, or TypeConflict",
            actual: String(_exhaustiveCheck),
          }, `Unhandled assignment result: ${String(_exhaustiveCheck)}`),
        };
      }
    }
  }
}

// Analysis results
export class ExtractedData {
  constructor(private readonly data: Record<string, unknown>) {}

  static create(data: Record<string, unknown>): ExtractedData {
    return new ExtractedData(data);
  }

  getData(): Record<string, unknown> {
    return { ...this.data };
  }

  getValue(key: string): unknown {
    return this.data[key];
  }

  has(key: string): boolean {
    return key in this.data;
  }

  toJSON(): Record<string, unknown> {
    return this.getData();
  }
}

export class MappedData {
  constructor(private readonly data: Record<string, unknown>) {}

  static create(data: Record<string, unknown>): MappedData {
    return new MappedData(data);
  }

  getData(): Record<string, unknown> {
    return { ...this.data };
  }

  toJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  toYAML(): string {
    // Simplified YAML generation - would use a proper YAML library
    return this.objectToYAML(this.data, 0);
  }

  private objectToYAML(obj: unknown, indent: number): string {
    const lines: string[] = [];
    const spaces = "  ".repeat(indent);

    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return String(obj);
    }

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value === null || value === undefined) {
        lines.push(`${spaces}${key}: null`);
      } else if (typeof value === "object" && !Array.isArray(value)) {
        lines.push(`${spaces}${key}:`);
        lines.push(this.objectToYAML(value, indent + 1));
      } else if (Array.isArray(value)) {
        lines.push(`${spaces}${key}:`);
        for (const item of value) {
          if (typeof item === "object") {
            lines.push(`${spaces}  -`);
            lines.push(this.objectToYAML(item, indent + 2));
          } else {
            lines.push(`${spaces}  - ${item}`);
          }
        }
      } else {
        lines.push(`${spaces}${key}: ${JSON.stringify(value)}`);
      }
    }

    return lines.join("\n");
  }
}

export class AnalysisResult {
  constructor(
    private readonly id: AnalysisId,
    private readonly document: Document,
    private readonly extractedData: ExtractedData,
    private readonly mappedData: MappedData,
    private readonly timestamp: Date,
  ) {}

  static create(
    document: Document,
    extractedData: ExtractedData,
    mappedData: MappedData,
  ): AnalysisResult {
    return new AnalysisResult(
      AnalysisId.generate(),
      document,
      extractedData,
      mappedData,
      new Date(),
    );
  }

  getId(): AnalysisId {
    return this.id;
  }

  getDocument(): Document {
    return this.document;
  }

  getExtractedData(): ExtractedData {
    return this.extractedData;
  }

  getMappedData(): MappedData {
    return this.mappedData;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }
}

export class AggregatedResult {
  constructor(
    private readonly results: AnalysisResult[],
    private readonly format: "json" | "yaml",
    private readonly timestamp: Date,
  ) {}

  static create(
    results: AnalysisResult[],
    format: "json" | "yaml" = "json",
  ): AggregatedResult {
    return new AggregatedResult(results, format, new Date());
  }

  getResults(): AnalysisResult[] {
    return [...this.results];
  }

  getFormat(): "json" | "yaml" {
    return this.format;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  /**
   * Get raw data for processing by StructuredAggregator
   * This method provides access to the underlying data for domain services
   */
  getRawData(): unknown[] {
    return this.results.map((r) => r.getMappedData().getData());
  }

  private objectToYAML(obj: unknown, indent: number): string {
    const lines: string[] = [];
    const spaces = "  ".repeat(indent);

    lines.push(`${spaces}-`);

    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return `${spaces}- ${JSON.stringify(obj)}`;
    }

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        lines.push(`${spaces}  ${key}:`);
        for (const [k, v] of Object.entries(value)) {
          lines.push(`${spaces}    ${k}: ${JSON.stringify(v)}`);
        }
      } else if (Array.isArray(value)) {
        lines.push(`${spaces}  ${key}:`);
        for (const item of value) {
          lines.push(`${spaces}    - ${JSON.stringify(item)}`);
        }
      } else {
        lines.push(`${spaces}  ${key}: ${JSON.stringify(value)}`);
      }
    }

    return lines.join("\n");
  }
}

// Re-export value objects needed by infrastructure
export { SchemaVersion } from "./value-objects.ts";
