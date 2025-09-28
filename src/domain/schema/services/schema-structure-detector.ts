import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { Schema } from "../entities/schema.ts";
import {
  StructureType,
  StructureTypeFactory,
} from "../value-objects/structure-type.ts";
import { SchemaFieldPatterns } from "../../configuration/value-objects/schema-field-patterns.ts";

/**
 * Domain service responsible for detecting schema structure types.
 *
 * This service replaces hardcoded structure assumptions with schema-driven detection.
 * It analyzes the schema definition to determine what kind of data structure
 * the schema represents (registry, collection, or custom).
 *
 * Following DDD principles:
 * - Domain service for complex logic that doesn't belong to entities
 * - Totality principle with Result types
 * - Schema-driven detection instead of hardcoding
 */
export class SchemaStructureDetector {
  constructor(
    private readonly fieldPatterns: SchemaFieldPatterns,
  ) {}

  /**
   * Create detector with default field patterns for static usage
   */
  static createWithDefaults(): Result<
    SchemaStructureDetector,
    DomainError & { message: string }
  > {
    const defaultPatternsResult = SchemaFieldPatterns.createDefault();
    if (!defaultPatternsResult.ok) {
      return defaultPatternsResult;
    }
    return ok(new SchemaStructureDetector(defaultPatternsResult.data));
  }

  /**
   * Static convenience method for backwards compatibility
   * Uses default field patterns configuration
   */
  static detectStructureType(
    schema: Schema,
  ): Result<StructureType, DomainError & { message: string }> {
    const detectorResult = SchemaStructureDetector.createWithDefaults();
    if (!detectorResult.ok) {
      return detectorResult;
    }
    return detectorResult.data.detectStructureType(schema);
  }

  /**
   * Detect the structure type from a schema definition.
   *
   * This method follows pure schema-driven analysis using x-frontmatter-part directives
   * with configurable fallback patterns when directives are not present.
   */
  detectStructureType(
    schema: Schema,
  ): Result<StructureType, DomainError & { message: string }> {
    // Primary: Try to find x-frontmatter-part path in schema (schema-driven)
    const frontmatterPartResult = schema.findFrontmatterPartPath();

    if (frontmatterPartResult.ok) {
      const path = frontmatterPartResult.data;
      // Detect structure type from the frontmatter-part path
      return StructureTypeFactory.fromPath(path);
    }

    // Secondary: Use configurable pattern-based fallback detection
    const registryDetectionResult = this.detectRegistryByStructure(schema);
    if (registryDetectionResult.ok) {
      return registryDetectionResult;
    }

    // Tertiary: Analyze schema properties to infer structure type
    const inferredTypeResult = this.inferStructureFromProperties(schema);
    if (inferredTypeResult.ok) {
      return inferredTypeResult;
    }

    // Default: Collection type with generic path (safest fallback)
    const collectionResult = StructureTypeFactory.collection(
      "items",
      "Generic collection structure (no x-frontmatter-part detected)",
    );
    if (!collectionResult.ok) {
      return ErrorHandler.aggregation({
        operation: "detectFromSchema",
        method: "createDefault",
      }).aggregationFailed(
        "Failed to create default collection structure type",
      );
    }

    return collectionResult;
  }

  /**
   * Detect registry structure by analyzing schema properties.
   *
   * This checks for registry-specific patterns in the schema:
   * - tools property with commands sub-property
   * - command-related field names
   * - registry-specific extensions
   */
  private detectRegistryByStructure(
    schema: Schema,
  ): Result<StructureType, DomainError & { message: string }> {
    const definition = schema.getDefinition();
    const rawSchema = definition.getRawSchema();

    // Check for registry-specific structure patterns
    if (this.hasRegistryStructurePattern(rawSchema)) {
      return ok(StructureTypeFactory.registry());
    }

    return ErrorHandler.schema({
      operation: "detectFromSchema",
      method: "registry",
    }).frontmatterPartNotFound();
  }

  /**
   * Check if schema has registry-specific structural patterns using configurable patterns only.
   * No hardcoded structure assumptions - purely schema-driven detection.
   */
  private hasRegistryStructurePattern(rawSchema: unknown): boolean {
    if (typeof rawSchema !== "object" || rawSchema === null) {
      return false;
    }

    const schema = rawSchema as Record<string, unknown>;

    // Only check for command properties using configurable patterns
    const properties = schema.properties as Record<string, unknown> | undefined;
    if (properties && typeof properties === "object") {
      const propertyKeys = Object.keys(properties);

      // Check if any properties match the configured patterns
      const hasMatchingFields = this.fieldPatterns.hasAnyMatch(propertyKeys);

      // Require minimum number of matches as configured
      if (hasMatchingFields) {
        const matchCount = propertyKeys.filter((key) =>
          this.fieldPatterns.matchesPattern(key)
        ).length;
        return matchCount >= this.fieldPatterns.getMinimumMatchCount();
      }
    }

    return false;
  }

  /**
   * Infer structure type from schema properties when x-frontmatter-part is not available.
   * Uses configurable patterns to make intelligent guesses about structure type.
   */
  private inferStructureFromProperties(
    schema: Schema,
  ): Result<StructureType, DomainError & { message: string }> {
    const definition = schema.getDefinition();
    const rawSchema = definition.getRawSchema();

    if (typeof rawSchema !== "object" || rawSchema === null) {
      return ErrorHandler.validation({
        operation: "inferFromProperties",
        method: "validateSchema",
      }).invalidType(
        "object",
        "null",
      );
    }

    const schemaObj = rawSchema as Record<string, unknown>;
    const properties = schemaObj.properties as
      | Record<string, unknown>
      | undefined;

    if (!properties || typeof properties !== "object") {
      return ErrorHandler.schema({
        operation: "inferFromProperties",
        method: "getProperties",
      }).propertiesNotDefined();
    }

    const _propertyKeys = Object.keys(properties);

    // Look for array properties that might indicate the structure type
    for (const [key, value] of Object.entries(properties)) {
      if (typeof value === "object" && value !== null) {
        const propertyDef = value as Record<string, unknown>;

        // If this is an array property, it might be our data collection
        if (propertyDef.type === "array") {
          // Check if it matches any configured patterns
          if (this.fieldPatterns.matchesPattern(key)) {
            // This looks like a registry structure
            return ok(StructureTypeFactory.registry());
          }

          // Otherwise, treat as collection with this path
          const collectionResult = StructureTypeFactory.collection(
            key,
            `Inferred collection structure from array property: ${key}`,
          );
          if (collectionResult.ok) {
            return collectionResult;
          }
        }
      }
    }

    // If no array properties found, check for object properties
    for (const [key] of Object.entries(properties)) {
      if (this.fieldPatterns.matchesPattern(key)) {
        // Found a pattern match, assume custom structure
        const customResult = StructureTypeFactory.custom(
          key,
          `Inferred custom structure from pattern match: ${key}`,
        );
        if (customResult.ok) {
          return customResult;
        }
      }
    }

    return ErrorHandler.schema({
      operation: "inferFromProperties",
      method: "infer",
    }).frontmatterPartNotFound();
  }

  /**
   * Helper to check for nested property existence.
   */
  private static hasNestedProperty(
    obj: Record<string, unknown>,
    path: string[],
  ): boolean {
    let current: unknown = obj;

    for (const segment of path) {
      if (
        typeof current !== "object" || current === null || !(segment in current)
      ) {
        return false;
      }
      current = (current as Record<string, unknown>)[segment];
    }

    return current !== undefined;
  }

  /**
   * Get structure-specific processing hints based on schema-driven detection.
   *
   * Different structure types may require different processing approaches.
   * This method provides hints for the processing pipeline using configurable patterns.
   */
  getProcessingHints(
    structureType: StructureType,
  ): ProcessingHints {
    switch (structureType.kind) {
      case "registry":
        // Use configurable patterns instead of hardcoded values
        return {
          requiresAggregation: true,
          expectedArrayFields: [...this.fieldPatterns.getNamedPatterns()],
          derivationRules: ["availableConfigs"], // Core business derivation rule
          templateFormat: "json", // Registry schemas typically use JSON format
        };

      case "collection":
        return {
          requiresAggregation: false,
          expectedArrayFields: [structureType.path],
          derivationRules: [],
          templateFormat: "auto",
        };

      case "custom": {
        // Extract field name from path dynamically
        const pathSegments = structureType.path.split(".");
        const fieldName = pathSegments[pathSegments.length - 1] || "items";
        return {
          requiresAggregation: true,
          expectedArrayFields: [fieldName],
          derivationRules: [],
          templateFormat: "auto",
        };
      }
    }
  }

  /**
   * Static convenience method for backwards compatibility
   * Uses default field patterns configuration
   */
  static getProcessingHints(
    structureType: StructureType,
  ): ProcessingHints {
    const detectorResult = SchemaStructureDetector.createWithDefaults();
    if (!detectorResult.ok) {
      // Fallback to minimal hints if detector creation fails
      return {
        requiresAggregation: false,
        expectedArrayFields: [],
        derivationRules: [],
        templateFormat: "auto",
      };
    }
    return detectorResult.data.getProcessingHints(structureType);
  }
}

/**
 * Processing hints based on detected structure type.
 */
export interface ProcessingHints {
  readonly requiresAggregation: boolean;
  readonly expectedArrayFields: string[];
  readonly derivationRules: string[];
  readonly templateFormat: "json" | "yaml" | "auto";
}
