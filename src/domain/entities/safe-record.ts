/**
 * Smart Constructor for safe Record<string, unknown> operations
 * Eliminates type assertions violating Totality principles
 *
 * Domain Context: Schema管理コンテキスト (Schema Management Context)
 * Purpose: Type-safe object navigation and property access
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";

/**
 * Safe wrapper for Record<string, unknown> with validation
 */
export class SafeRecord {
  protected constructor(private readonly data: Record<string, unknown>) {}

  /**
   * Smart Constructor - creates SafeRecord from unknown input
   */
  static from(
    input: unknown,
  ): Result<SafeRecord, DomainError & { message: string }> {
    if (input === null || input === undefined) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(input),
            expectedFormat: "object",
          },
          "Cannot create SafeRecord from null or undefined",
        ),
      };
    }

    if (typeof input !== "object") {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(input),
            expectedFormat: "object",
          },
          `Cannot create SafeRecord from ${typeof input}`,
        ),
      };
    }

    if (Array.isArray(input)) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(input),
            expectedFormat: "object",
          },
          "Cannot create SafeRecord from array",
        ),
      };
    }

    return { ok: true, data: new SafeRecord(input as Record<string, unknown>) };
  }

  /**
   * Safe property access with validation
   */
  get(key: string): unknown {
    return this.data[key];
  }

  /**
   * Safe property check
   */
  has(key: string): boolean {
    return key in this.data;
  }

  /**
   * Safe nested property navigation
   */
  getPath(segments: string[]): unknown {
    let current: unknown = this.data;

    for (const segment of segments) {
      if (!current || typeof current !== "object" || Array.isArray(current)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    return current;
  }

  /**
   * Safe nested SafeRecord creation
   */
  getSafeRecord(
    key: string,
  ): Result<SafeRecord, DomainError & { message: string }> {
    const value = this.data[key];
    return SafeRecord.from(value);
  }

  /**
   * Convert back to plain object (for serialization)
   */
  toObject(): Record<string, unknown> {
    return { ...this.data };
  }

  /**
   * Safe array access for properties that should be arrays
   */
  getArray(key: string): unknown[] | undefined {
    const value = this.data[key];
    return Array.isArray(value) ? value : undefined;
  }

  /**
   * Safe string access for properties that should be strings
   */
  getString(key: string): string | undefined {
    const value = this.data[key];
    return typeof value === "string" ? value : undefined;
  }

  /**
   * Safe number access for properties that should be numbers
   */
  getNumber(key: string): number | undefined {
    const value = this.data[key];
    return typeof value === "number" ? value : undefined;
  }

  /**
   * Safe boolean access for properties that should be booleans
   */
  getBoolean(key: string): boolean | undefined {
    const value = this.data[key];
    return typeof value === "boolean" ? value : undefined;
  }
}

/**
 * Type-safe frontmatter data access
 * Specialized for frontmatter data structures
 */
export class SafeFrontmatterData extends SafeRecord {
  /**
   * Smart Constructor specifically for frontmatter data
   */
  static fromFrontmatter(
    data: unknown,
  ): Result<SafeFrontmatterData, DomainError & { message: string }> {
    const recordResult = SafeRecord.from(data);
    if (!recordResult.ok) {
      return recordResult;
    }

    return {
      ok: true,
      data: new SafeFrontmatterData(recordResult.data.toObject()),
    };
  }

  /**
   * Safe traceability array access
   * Handles the specific "traceability" pattern from schema-constraints
   */
  getTraceabilityFirst(): unknown {
    const traceability = this.getArray("traceability");
    if (!traceability || traceability.length === 0) {
      return undefined;
    }
    return traceability[0];
  }

  /**
   * Safe path navigation with traceability support
   */
  getPathWithTraceability(segments: string[]): unknown {
    // Special handling for traceability as first segment
    if (segments.length > 0 && segments[0] === "traceability") {
      const firstTraceability = this.getTraceabilityFirst();
      if (!firstTraceability) {
        return undefined;
      }

      // Navigate remaining segments from traceability object
      const remainingSegments = segments.slice(1);
      if (remainingSegments.length === 0) {
        return firstTraceability;
      }

      const traceabilityRecordResult = SafeRecord.from(firstTraceability);
      if (!traceabilityRecordResult.ok) {
        return undefined;
      }

      return traceabilityRecordResult.data.getPath(remainingSegments);
    }

    // Standard path navigation
    return this.getPath(segments);
  }
}
