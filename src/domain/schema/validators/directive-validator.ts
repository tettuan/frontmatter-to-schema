/**
 * @fileoverview Directive Validator - Validates schema directives for quality assurance
 * @description Implements comprehensive validation for x-* directives in schema definitions
 * Following DDD and Totality principles for robust error handling
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { SchemaProperty } from "../value-objects/schema-property-types.ts";

/**
 * Validation error types for directive validation
 * Following Totality principle with discriminated unions
 */
export type DirectiveValidationError =
  | { kind: "InvalidPath"; path: string; reason: string }
  | { kind: "TypeMismatch"; expected: string; actual: string; path: string }
  | { kind: "CircularReference"; path: string; cycle: string[] }
  | { kind: "MissingRequiredDirective"; directive: string; context: string }
  | { kind: "ConflictingDirectives"; directives: string[]; context: string }
  | {
    kind: "InvalidDirectiveValue";
    directive: string;
    value: unknown;
    expected: string;
  };

/**
 * Validation result with context information
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: DirectiveValidationError[];
  readonly warnings: DirectiveValidationError[];
}

/**
 * Directive Validator - Domain Service
 * Validates schema directives for correctness and consistency
 * Following DDD Service pattern with immutable operations
 */
export class DirectiveValidator {
  private constructor() {}

  /**
   * Smart Constructor
   */
  static create(): DirectiveValidator {
    return new DirectiveValidator();
  }

  /**
   * Validate schema property directives
   * Main validation entry point following Totality principles
   */
  validateProperty(
    property: SchemaProperty,
    propertyPath: string = "root",
  ): Result<ValidationResult, SchemaError & { message: string }> {
    const errors: DirectiveValidationError[] = [];
    const warnings: DirectiveValidationError[] = [];

    try {
      // Validate x-extract-from directive
      this.validateExtractFromDirective(
        property,
        propertyPath,
        errors,
        warnings,
      );

      // Validate x-frontmatter-part directive
      this.validateFrontmatterPartDirective(
        property,
        propertyPath,
        errors,
        warnings,
      );

      // Validate x-derived-from directive
      this.validateDerivedFromDirective(
        property,
        propertyPath,
        errors,
        warnings,
      );

      // Validate directive combinations
      this.validateDirectiveCombinations(
        property,
        propertyPath,
        errors,
        warnings,
      );

      return ok({
        isValid: errors.length === 0,
        errors,
        warnings,
      });
    } catch (error) {
      return err({
        kind: "InvalidSchema",
        message: `Validation failed for property at ${propertyPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Validate x-extract-from directive
   */
  private validateExtractFromDirective(
    property: SchemaProperty,
    propertyPath: string,
    errors: DirectiveValidationError[],
    _warnings: DirectiveValidationError[],
  ): void {
    const extractFrom = property.extensions?.["x-extract-from"];
    if (extractFrom === undefined) return;

    if (typeof extractFrom !== "string") {
      errors.push({
        kind: "TypeMismatch",
        expected: "string",
        actual: typeof extractFrom,
        path: `${propertyPath}.x-extract-from`,
      });
      return;
    }

    // Validate path format
    if (!this.isValidPropertyPath(extractFrom)) {
      errors.push({
        kind: "InvalidPath",
        path: extractFrom,
        reason: this.getPathInvalidationReason(extractFrom),
      });
    }

    // Check for potential circular references
    if (this.hasCircularReference(extractFrom, propertyPath)) {
      errors.push({
        kind: "CircularReference",
        path: propertyPath,
        cycle: [propertyPath, extractFrom],
      });
    }
  }

  /**
   * Validate x-frontmatter-part directive
   */
  private validateFrontmatterPartDirective(
    property: SchemaProperty,
    propertyPath: string,
    errors: DirectiveValidationError[],
    warnings: DirectiveValidationError[],
  ): void {
    const frontmatterPart = property.extensions?.["x-frontmatter-part"];
    if (frontmatterPart === undefined) return;

    if (typeof frontmatterPart !== "boolean") {
      errors.push({
        kind: "TypeMismatch",
        expected: "boolean",
        actual: typeof frontmatterPart,
        path: `${propertyPath}.x-frontmatter-part`,
      });
      return;
    }

    // Validate that array types have frontmatter-part
    if (frontmatterPart && property.kind !== "array") {
      warnings.push({
        kind: "TypeMismatch",
        expected: "array",
        actual: property.kind || "unknown",
        path: `${propertyPath}.type`,
      });
    }

    // Check if x-extract-from is specified when x-frontmatter-part is true
    // Only check this if the type is correct (array)
    if (
      frontmatterPart && property.kind === "array" &&
      !property.extensions?.["x-extract-from"]
    ) {
      warnings.push({
        kind: "MissingRequiredDirective",
        directive: "x-extract-from",
        context: `x-frontmatter-part is true at ${propertyPath}`,
      });
    }
  }

  /**
   * Validate x-derived-from directive
   */
  private validateDerivedFromDirective(
    property: SchemaProperty,
    propertyPath: string,
    errors: DirectiveValidationError[],
    _warnings: DirectiveValidationError[],
  ): void {
    const derivedFrom = property.extensions?.["x-derived-from"];
    if (derivedFrom === undefined) return;

    if (typeof derivedFrom !== "string") {
      errors.push({
        kind: "TypeMismatch",
        expected: "string",
        actual: typeof derivedFrom,
        path: `${propertyPath}.x-derived-from`,
      });
      return;
    }

    // Validate path format
    if (!this.isValidPropertyPath(derivedFrom)) {
      errors.push({
        kind: "InvalidPath",
        path: derivedFrom,
        reason: this.getPathInvalidationReason(derivedFrom),
      });
    }

    // Check for circular references
    if (this.hasCircularReference(derivedFrom, propertyPath)) {
      errors.push({
        kind: "CircularReference",
        path: propertyPath,
        cycle: [propertyPath, derivedFrom],
      });
    }
  }

  /**
   * Validate directive combinations for conflicts
   */
  private validateDirectiveCombinations(
    property: SchemaProperty,
    propertyPath: string,
    _errors: DirectiveValidationError[],
    warnings: DirectiveValidationError[],
  ): void {
    const extensions = property.extensions || {};
    const _directives = Object.keys(extensions).filter((key) =>
      key.startsWith("x-")
    );

    // Check for conflicting directives
    const hasExtractFrom = extensions["x-extract-from"];
    const hasDerivedFrom = extensions["x-derived-from"];

    if (hasExtractFrom && hasDerivedFrom) {
      warnings.push({
        kind: "ConflictingDirectives",
        directives: ["x-extract-from", "x-derived-from"],
        context:
          `Both directives specified at ${propertyPath}, x-extract-from takes precedence`,
      });
    }

    // Validate template directives
    const hasTemplate = extensions["x-template"];
    const hasTemplateItems = extensions["x-template-items"];

    if (hasTemplateItems && !hasTemplate) {
      warnings.push({
        kind: "MissingRequiredDirective",
        directive: "x-template",
        context:
          `x-template-items specified without x-template at ${propertyPath}`,
      });
    }
  }

  /**
   * Validate property path format
   */
  private isValidPropertyPath(path: string): boolean {
    if (!path || path.trim() === "") return false;

    // Check for invalid patterns
    if (path.includes("..")) return false;
    if (path.startsWith(".") || path.endsWith(".")) return false;
    if (path.includes(" ")) return false;

    // Validate segments
    const segments = path.split(".");
    for (const segment of segments) {
      if (segment === "") return false;
      if (segment.includes("[]") && !segment.endsWith("[]")) return false;
    }

    return true;
  }

  /**
   * Get detailed reason for path invalidation
   */
  private getPathInvalidationReason(path: string): string {
    if (!path || path.trim() === "") {
      return "Path cannot be empty";
    }
    if (path.includes("..")) {
      return "Consecutive dots are not allowed";
    }
    if (path.startsWith(".") || path.endsWith(".")) {
      return "Path cannot start or end with dot";
    }
    if (path.includes(" ")) {
      return "Spaces are not allowed in property paths";
    }

    const segments = path.split(".");
    for (const segment of segments) {
      if (segment === "") {
        return "Empty segments are not allowed";
      }
      if (segment.includes("[]") && !segment.endsWith("[]")) {
        return "Array notation [] must be at the end of segment";
      }
    }

    return "Invalid path format";
  }

  /**
   * Check for circular references in directive paths
   */
  private hasCircularReference(
    sourcePath: string,
    targetPath: string,
  ): boolean {
    // Simple circular reference detection
    // More sophisticated implementation would track full dependency graph
    const sourceSegments = sourcePath.split(".");
    const targetSegments = targetPath.split(".");

    // Check if target path is a prefix of source path
    if (targetSegments.length <= sourceSegments.length) {
      const targetPrefix = sourceSegments.slice(0, targetSegments.length).join(
        ".",
      );
      return targetPrefix === targetPath;
    }

    return false;
  }

  /**
   * Validate entire schema for directive consistency
   */
  validateSchema(
    schema: Record<string, unknown>,
    schemaPath: string = "root",
  ): Result<ValidationResult, SchemaError & { message: string }> {
    const allErrors: DirectiveValidationError[] = [];
    const allWarnings: DirectiveValidationError[] = [];

    try {
      this.validateSchemaRecursive(schema, schemaPath, allErrors, allWarnings);

      return ok({
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
      });
    } catch (error) {
      return err({
        kind: "InvalidSchema",
        message: `Schema validation failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Recursive schema validation
   */
  private validateSchemaRecursive(
    obj: unknown,
    currentPath: string,
    errors: DirectiveValidationError[],
    warnings: DirectiveValidationError[],
  ): void {
    if (!obj || typeof obj !== "object") return;

    const record = obj as Record<string, unknown>;

    // Validate current level if it has extensions
    if (record.extensions) {
      const propertyResult = this.validateProperty(
        record as SchemaProperty,
        currentPath,
      );
      if (propertyResult.ok) {
        errors.push(...propertyResult.data.errors);
        warnings.push(...propertyResult.data.warnings);
      }
    }

    // Recurse into properties
    if (record.properties && typeof record.properties === "object") {
      const properties = record.properties as Record<string, unknown>;
      for (const [key, value] of Object.entries(properties)) {
        this.validateSchemaRecursive(
          value,
          `${currentPath}.${key}`,
          errors,
          warnings,
        );
      }
    }

    // Recurse into items
    if (record.items && typeof record.items === "object") {
      this.validateSchemaRecursive(
        record.items,
        `${currentPath}[]`,
        errors,
        warnings,
      );
    }
  }
}
