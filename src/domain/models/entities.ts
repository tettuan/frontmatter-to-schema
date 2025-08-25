// Domain entities following DDD principles

import {
  createError,
  type Result,
  type ValidationError,
} from "../shared/types.ts";
import type {
  DocumentContent,
  DocumentPath,
  FrontMatterContent,
  MappingRule,
  SchemaDefinition,
  SchemaVersion,
  TemplateFormat,
} from "./value-objects.ts";

// ID value objects
export class DocumentId {
  private constructor(private readonly value: string) {}

  static create(
    value: string,
  ): Result<DocumentId, ValidationError & { message: string }> {
    if (!value || value.trim() === "") {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
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
  ): Result<SchemaId, ValidationError & { message: string }> {
    if (!value || value.trim() === "") {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
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
  ): Result<TemplateId, ValidationError & { message: string }> {
    if (!value || value.trim() === "") {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
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
  ): Result<AnalysisId, ValidationError & { message: string }> {
    if (!value || value.trim() === "") {
      return { ok: false, error: createError({ kind: "EmptyInput" }) };
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
    private readonly frontMatter: FrontMatter | null,
    private readonly content: DocumentContent,
  ) {}

  static create(
    path: DocumentPath,
    frontMatter: FrontMatter | null,
    content: DocumentContent,
  ): Document {
    return new Document(DocumentId.fromPath(path), path, frontMatter, content);
  }

  getId(): DocumentId {
    return this.id;
  }

  getPath(): DocumentPath {
    return this.path;
  }

  getFrontMatter(): FrontMatter | null {
    return this.frontMatter;
  }

  getContent(): DocumentContent {
    return this.content;
  }

  hasFrontMatter(): boolean {
    return this.frontMatter !== null;
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

  validate(data: unknown): Result<void, ValidationError & { message: string }> {
    const result = this.definition.validate(data);
    if (result.ok) {
      return { ok: true, data: undefined };
    }

    // Convert the error from core/result.ts format to shared/types.ts format
    const coreError = result.error;
    const sharedError = this.convertErrorFormat(coreError);
    return { ok: false, error: sharedError };
  }

  private convertErrorFormat(
    coreError: { kind: string; [key: string]: unknown },
  ): ValidationError & { message: string } {
    if (coreError.kind === "InvalidFormat" && "expectedFormat" in coreError) {
      return createError({
        kind: "InvalidFormat",
        format: String(coreError.expectedFormat),
        input: String(coreError.input),
      });
    }

    if (coreError.kind === "EmptyInput") {
      return createError({ kind: "EmptyInput" });
    }

    // For other error types, try to map them or return a generic error
    return createError({
      kind: "InvalidFormat",
      format: "valid data",
      input: String(coreError),
    });
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

  applyRules(data: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const rule of this.mappingRules) {
      const value = rule.apply(data);
      const target = rule.getTarget();
      this.setValueByPath(result, target, value);
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
