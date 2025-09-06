// Analysis-related entities following DDD principles

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import type { Document } from "./document-entities.ts";

// AnalysisId value object
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

// ExtractedData entity
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

  hasProperty(key: string): boolean {
    return key in this.data;
  }

  has(key: string): boolean {
    return key in this.data;
  }

  getKeys(): string[] {
    return Object.keys(this.data);
  }

  toJSON(): Record<string, unknown> {
    return this.getData();
  }
}

// MappedData entity
export class MappedData {
  constructor(private readonly data: Record<string, unknown>) {}

  static create(data: Record<string, unknown>): MappedData {
    return new MappedData(data);
  }

  getData(): Record<string, unknown> {
    return { ...this.data };
  }

  getValue(key: string): unknown {
    return this.data[key];
  }

  hasProperty(key: string): boolean {
    return key in this.data;
  }

  getKeys(): string[] {
    return Object.keys(this.data);
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
          lines.push(`${spaces}  - ${this.objectToYAML(item, 0)}`);
        }
      } else {
        lines.push(`${spaces}${key}: ${String(value)}`);
      }
    }

    return lines.join("\n");
  }
}

// AnalysisResult entity
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

// AggregatedResult entity
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
