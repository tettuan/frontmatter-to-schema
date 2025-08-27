// Domain entities following DDD principles

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import type {
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
  MappingRule,
  SchemaDefinition,
  SchemaVersion,
  TemplateFormat,
} from "./value-objects.ts";
import { StrictStructureMatcher } from "./StrictStructureMatcher.ts";

// Discriminated union for document frontmatter state following totality principle
export type DocumentFrontMatterState =
  | { kind: "WithFrontMatter"; frontMatter: FrontMatter }
  | { kind: "NoFrontMatter" };

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
    return new Document(DocumentId.fromPath(path), path, frontMatterState, content);
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
    return new Document(DocumentId.fromPath(path), path, frontMatterState, content);
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

  // Convenience method for backward compatibility
  getFrontMatter(): FrontMatter | null {
    switch (this.frontMatterState.kind) {
      case "WithFrontMatter":
        return this.frontMatterState.frontMatter;
      case "NoFrontMatter":
        return null;
      default: {
        // Exhaustive check - TypeScript will error if we miss a case
        const _exhaustiveCheck: never = this.frontMatterState;
        throw new Error(`Unhandled frontmatter state: ${(_exhaustiveCheck as any).kind}`);
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

  validate(data: unknown): Result<void, DomainError> {
    const result = this.definition.validate(data);
    if (result.ok) {
      return { ok: true, data: undefined };
    }

    // The result from definition.validate is already a DomainError
    return { ok: false, error: result.error };
  }
}

export class Template {
  constructor(
    private readonly id: TemplateId,
    private readonly format: TemplateFormat,
    private readonly mappingRules: MappingRule[],
    private readonly description: string,
  ) {}

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
    schemaData?: unknown,
    templateStructure?: unknown,
  ): Record<string, unknown> {
    // If strict structure validation is required, perform it first
    if (schemaData && templateStructure) {
      const alignmentResult = StrictStructureMatcher
        .validateStructuralAlignment(
          data,
          schemaData,
          templateStructure,
        );

      if (!alignmentResult.ok) {
        // Return empty object if structures don't match exactly
        return {};
      }
    }

    // If no mapping rules are defined, return the data as-is only if structure validation passed
    if (this.mappingRules.length === 0) {
      return data;
    }

    const result: Record<string, unknown> = {};

    // Apply mapping rules only if structural alignment is confirmed
    for (const rule of this.mappingRules) {
      const value = rule.apply(data);
      const target = rule.getTarget();

      // Only set value if it exists in the source data (no fallbacks or defaults)
      if (value !== undefined) {
        this.setValueByPath(result, target, value);
      }
    }

    return result;
  }

  private setValueByPath(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const parts = path.split(".");
    const last = parts.pop()!;

    let current: Record<string, unknown> = obj as Record<string, unknown>;
    for (const part of parts) {
      if (!(part in current)) {
        current[part] = {};
      }
      const next = current[part];
      if (typeof next === "object" && next !== null && !Array.isArray(next)) {
        current = next as Record<string, unknown>;
      } else {
        // If the path doesn't lead to an object, create one
        current[part] = {};
        current = current[part] as Record<string, unknown>;
      }
    }

    current[last] = value;
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

  toOutput(): string {
    const data = this.results.map((r) => r.getMappedData().getData());

    if (this.format === "json") {
      return JSON.stringify({ results: data }, null, 2);
    } else {
      // Simplified YAML - would use proper YAML library
      return `results:\n${data.map((d) => this.objectToYAML(d, 1)).join("\n")}`;
    }
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
