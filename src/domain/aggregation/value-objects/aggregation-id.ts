import { Result } from "../../shared/types/result.ts";
import { AggregationError } from "../../shared/types/errors.ts";

/**
 * Value object representing a unique identifier for aggregations.
 * Ensures proper identification and tracking of aggregation instances.
 */
export class AggregationId {
  private constructor(private readonly value: string) {}

  /**
   * Creates an AggregationId from a string value.
   */
  static create(value: string): Result<AggregationId, AggregationError> {
    if (!value || typeof value !== "string") {
      return Result.error(
        new AggregationError(
          "AggregationId value must be a non-empty string",
          "INVALID_AGGREGATION_ID",
          { value },
        ),
      );
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return Result.error(
        new AggregationError(
          "AggregationId value cannot be empty or whitespace only",
          "INVALID_AGGREGATION_ID",
          { value },
        ),
      );
    }

    if (trimmed.length < 3) {
      return Result.error(
        new AggregationError(
          "AggregationId value must be at least 3 characters long",
          "INVALID_AGGREGATION_ID",
          { value, length: trimmed.length },
        ),
      );
    }

    return Result.ok(new AggregationId(trimmed));
  }

  /**
   * Generates a new unique AggregationId.
   */
  static generate(): AggregationId {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    const uniqueValue = `agg_${timestamp}_${random}`;

    // This should never fail since we control the generation
    const result = AggregationId.create(uniqueValue);
    if (result.isError()) {
      // Fallback if somehow generation fails
      return new AggregationId(`agg_${Date.now()}_fallback`);
    }

    return result.unwrap();
  }

  /**
   * Creates an AggregationId from a source identifier.
   */
  static fromSource(
    sourceId: string,
    suffix = "",
  ): Result<AggregationId, AggregationError> {
    const cleanSourceId = sourceId.replace(/[^a-zA-Z0-9_]/g, "_");
    const timestamp = Date.now().toString(36);
    const value = suffix
      ? `agg_${cleanSourceId}_${suffix}_${timestamp}`
      : `agg_${cleanSourceId}_${timestamp}`;

    return AggregationId.create(value);
  }

  /**
   * Returns the string value of this ID.
   */
  toString(): string {
    return this.value;
  }

  /**
   * Returns the raw value.
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Checks if this ID represents a generated aggregation.
   */
  isGenerated(): boolean {
    return this.value.startsWith("agg_") && this.value.includes("_");
  }

  /**
   * Extracts timestamp from generated ID if available.
   */
  getTimestamp(): number | null {
    if (!this.isGenerated()) {
      return null;
    }

    try {
      const parts = this.value.split("_");
      if (parts.length >= 3) {
        // Convert base36 timestamp back to number
        return parseInt(parts[1], 36);
      }
    } catch {
      // Ignore parsing errors
    }

    return null;
  }

  /**
   * Compares this ID with another for equality.
   */
  equals(other: AggregationId): boolean {
    return this.value === other.value;
  }

  /**
   * Returns hash code for this ID.
   */
  hashCode(): number {
    let hash = 0;
    for (let i = 0; i < this.value.length; i++) {
      const char = this.value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * Creates a child ID derived from this aggregation ID.
   */
  createChild(suffix: string): Result<AggregationId, AggregationError> {
    if (!suffix || suffix.trim().length === 0) {
      return Result.error(
        new AggregationError(
          "Child suffix cannot be empty",
          "INVALID_AGGREGATION_ID",
          { suffix },
        ),
      );
    }

    const childValue = `${this.value}_child_${suffix.trim()}`;
    return AggregationId.create(childValue);
  }
}
