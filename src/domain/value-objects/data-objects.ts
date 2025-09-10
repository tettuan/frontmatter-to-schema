// Data Value Objects following DDD and Totality principles
// Value objects for data extraction and transformation results

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";
import type { AnalysisId, DocumentId } from "./ids.ts";
import type { Document } from "../entities/document.ts";

/**
 * ExtractedData value object
 * Immutable container for extracted data from documents
 */
export class ExtractedData {
  private constructor(private readonly data: Record<string, unknown>) {}

  /**
   * Create ExtractedData with validation
   * Ensures data is not null or undefined
   */
  static create(
    data: Record<string, unknown>,
  ): Result<ExtractedData, DomainError> {
    if (!data) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "data",
        }),
      };
    }
    return { ok: true, data: new ExtractedData(data) };
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

  /**
   * Get all keys in the extracted data
   */
  getKeys(): string[] {
    return Object.keys(this.data);
  }

  /**
   * Check if data is empty
   */
  isEmpty(): boolean {
    return Object.keys(this.data).length === 0;
  }
}

/**
 * MappedData value object
 * Immutable container for transformed/mapped data
 */
export class MappedData {
  private constructor(private readonly data: Record<string, unknown>) {}

  /**
   * Create MappedData with validation
   * Ensures data is not null or undefined
   */
  static create(
    data: Record<string, unknown>,
  ): Result<MappedData, DomainError> {
    if (!data) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "data",
        }),
      };
    }
    return { ok: true, data: new MappedData(data) };
  }

  getData(): Record<string, unknown> {
    return { ...this.data };
  }

  toJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Convert to YAML format
   * Basic implementation without external dependencies
   */
  toYAML(): string {
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

  /**
   * Get size of mapped data in bytes
   */
  getSize(): number {
    return JSON.stringify(this.data).length;
  }

  /**
   * Check if data is empty
   */
  isEmpty(): boolean {
    return Object.keys(this.data).length === 0;
  }
}

/**
 * AnalysisResult entity
 * Represents the complete result of document analysis
 */
export class AnalysisResult {
  private constructor(
    private readonly id: AnalysisId,
    private readonly document: Document,
    private readonly extractedData: ExtractedData,
    private readonly mappedData: MappedData,
    private readonly timestamp: Date,
  ) {}

  /**
   * Create analysis result with validation
   */
  static create(
    id: AnalysisId,
    document: Document,
    extractedData: ExtractedData,
    mappedData: MappedData,
    timestamp?: Date,
  ): Result<AnalysisResult, DomainError> {
    const safeTimestamp = timestamp ?? new Date();

    if (!document || !extractedData || !mappedData) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "required parameters",
        }),
      };
    }

    return {
      ok: true,
      data: new AnalysisResult(
        id,
        document,
        extractedData,
        mappedData,
        safeTimestamp,
      ),
    };
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

  /**
   * Get document ID for quick reference
   */
  getDocumentId(): DocumentId {
    return this.document.getId();
  }

  /**
   * Check if analysis was successful
   */
  isSuccessful(): boolean {
    return !this.extractedData.isEmpty() || !this.mappedData.isEmpty();
  }
}

/**
 * AggregatedResult value object
 * Container for aggregated analysis results
 */
export class AggregatedResult {
  private constructor(
    private readonly results: AnalysisResult[],
    private readonly aggregatedData: Record<string, unknown>,
    private readonly timestamp: Date,
  ) {}

  /**
   * Create aggregated result with validation
   */
  static create(
    results: AnalysisResult[],
    aggregatedData: Record<string, unknown>,
    timestamp?: Date,
  ): Result<AggregatedResult, DomainError> {
    const safeTimestamp = timestamp ?? new Date();

    if (!results || results.length === 0) {
      return {
        ok: false,
        error: createDomainError({
          kind: "EmptyInput",
          field: "results",
        }),
      };
    }

    return {
      ok: true,
      data: new AggregatedResult(results, aggregatedData, safeTimestamp),
    };
  }

  getResults(): AnalysisResult[] {
    return [...this.results];
  }

  getAggregatedData(): Record<string, unknown> {
    return { ...this.aggregatedData };
  }

  getTimestamp(): Date {
    return this.timestamp;
  }

  /**
   * Get count of aggregated results
   */
  getResultCount(): number {
    return this.results.length;
  }

  /**
   * Get specific result by index
   */
  getResultAt(index: number): AnalysisResult | undefined {
    return this.results[index];
  }
}
