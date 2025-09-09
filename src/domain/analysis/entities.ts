/**
 * Analysis domain entities following DDD principles
 * Part of Analysis bounded context
 */

import type { Result } from "../core/result.ts";
import type { DomainError } from "../core/result.ts";
import type { Document } from "../document/entities.ts";

/**
 * Analysis identifier value object with Smart Constructor pattern
 */
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

/**
 * Extracted data value object
 * Represents raw data extracted from documents
 */
export class ExtractedData {
  constructor(private readonly data: Record<string, unknown>) {}

  static create(data: Record<string, unknown>): ExtractedData {
    return new ExtractedData(data);
  }

  getData(): Record<string, unknown> {
    return { ...this.data }; // Return copy to prevent mutation
  }

  isEmpty(): boolean {
    return Object.keys(this.data).length === 0;
  }

  hasProperty(key: string): boolean {
    return key in this.data;
  }

  getProperty(key: string): unknown {
    return this.data[key];
  }

  // Legacy methods for backward compatibility with tests
  getValue(key: string): unknown {
    return this.data[key];
  }

  has(key: string): boolean {
    return key in this.data;
  }

  toJSON(): Record<string, unknown> {
    return { ...this.data };
  }
}

/**
 * Mapped data value object
 * Represents data after template mapping
 */
export class MappedData {
  constructor(private readonly data: Record<string, unknown>) {}

  static create(data: Record<string, unknown>): MappedData {
    return new MappedData(data);
  }

  getData(): Record<string, unknown> {
    return { ...this.data }; // Return copy to prevent mutation
  }

  isEmpty(): boolean {
    return Object.keys(this.data).length === 0;
  }

  hasProperty(key: string): boolean {
    return key in this.data;
  }

  getProperty(key: string): unknown {
    return this.data[key];
  }

  toJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  // Legacy method for backward compatibility with tests
  toYAML(): string {
    // Simple YAML serialization - in a real implementation this would use a YAML library
    const yamlify = (obj: unknown, indent = 0): string => {
      if (typeof obj !== "object" || obj === null) {
        return String(obj);
      }

      const indentStr = "  ".repeat(indent);
      const lines: string[] = [];

      for (const [key, value] of Object.entries(obj)) {
        if (
          typeof value === "object" && value !== null && !Array.isArray(value)
        ) {
          lines.push(`${indentStr}${key}:`);
          lines.push(yamlify(value, indent + 1));
        } else if (Array.isArray(value)) {
          lines.push(`${indentStr}${key}:`);
          for (const item of value) {
            lines.push(`${indentStr}  - ${item}`);
          }
        } else {
          lines.push(`${indentStr}${key}: ${value}`);
        }
      }

      return lines.join("\n");
    };

    return yamlify(this.data);
  }
}

/**
 * Analysis result aggregate root
 * Represents the complete analysis of a single document
 */
export class AnalysisResult {
  constructor(
    private readonly id: AnalysisId,
    private readonly document: Document,
    private readonly extractedData: ExtractedData,
    private readonly mappedData: MappedData,
    private readonly timestamp: Date = new Date(),
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

  isSuccessful(): boolean {
    return !this.extractedData.isEmpty() && !this.mappedData.isEmpty();
  }
}

/**
 * Aggregated result aggregate root
 * Represents the complete results of analyzing multiple documents
 */
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
    return [...this.results]; // Return copy to prevent mutation
  }

  getFormat(): "json" | "yaml" {
    return this.format;
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  getResultCount(): number {
    return this.results.length;
  }

  getSuccessfulResultCount(): number {
    return this.results.filter((result) => result.isSuccessful()).length;
  }

  getFailedResultCount(): number {
    return this.results.filter((result) => !result.isSuccessful()).length;
  }

  isEmpty(): boolean {
    return this.results.length === 0;
  }

  /**
   * Aggregate all mapped data into a single structure
   */
  aggregateData(): Record<string, unknown> {
    const aggregated: Record<string, unknown> = {};
    let index = 0;

    for (const result of this.results) {
      if (result.isSuccessful()) {
        const documentId = result.getDocument().getId().getValue();
        aggregated[documentId || `result_${index}`] = result.getMappedData()
          .getData();
      }
      index++;
    }

    return aggregated;
  }

  // Legacy method for backward compatibility with tests
  getRawData(): Record<string, unknown> {
    return this.aggregateData();
  }
}
