/**
 * Analysis result domain entities
 * Extracted from entities-original.ts for better organization
 * Represents the results of document analysis and aggregation
 */

import { AnalysisId } from "../value-objects/identifier-value-objects.ts";
import type {
  ExtractedData,
  MappedData,
} from "../value-objects/data-value-objects.ts";
import type { Document } from "./document.entity.ts";

/**
 * AnalysisResult entity representing the result of analyzing a single document
 * Encapsulates the document, extracted data, mapped data, and analysis metadata
 */
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

/**
 * AggregatedResult entity representing the aggregation of multiple analysis results
 * Provides methods for accessing and formatting aggregated data
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
