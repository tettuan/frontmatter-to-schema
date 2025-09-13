/**
 * SchemaStructure Value Object
 *
 * Represents the analyzed structure of a JSON schema with focus on:
 * - x-frontmatter-part array detection
 * - Template path extraction
 * - x-derived-from derivation rules
 *
 * Implements Smart Constructor pattern with Totality principles
 */

import type { Result } from "../../core/result.ts";
import type { DomainError } from "../../core/result.ts";
import { createDomainError } from "../../core/result.ts";
import { ArrayTarget } from "./array-target.ts";
import { SchemaExtensions } from "./schema-extensions.ts";
import { SchemaPropertyAccessor } from "../services/schema-property-accessor.ts";
import { SchemaExtensionConfig } from "../../config/schema-extension-config.ts";

/**
 * Represents a derivation rule for x-derived-from processing
 */
export interface DerivationRule {
  readonly targetProperty: string;
  readonly sourceArray: string;
  readonly derivationType: "collect" | "aggregate" | "unique";
  readonly sourceField?: string;
}

/**
 * SchemaStructure represents the analyzed structure of a JSON schema
 */
export class SchemaStructure {
  private constructor(
    private readonly hasArrayTarget: boolean,
    private readonly arrayTarget?: ArrayTarget,
    private readonly templatePath?: string,
    private readonly derivationRules: readonly DerivationRule[] = [],
  ) {}

  /**
   * Smart Constructor - Analyzes schema structure and extracts processing information
   */
  static analyze(
    schema: unknown,
  ): Result<SchemaStructure, DomainError & { message: string }> {
    // Validate schema is an object
    if (typeof schema !== "object" || schema === null) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: String(schema),
            expectedFormat: "object",
          },
          `Schema must be an object, got: ${typeof schema}`,
        ),
      };
    }

    const schemaObj = schema as Record<string, unknown>;

    // Extract template path from schema root
    const templatePath = this.extractTemplatePath(schemaObj);

    // Find array targets with x-frontmatter-part
    const arrayTargetsResult = this.findArrayTargets(schemaObj);
    if (!arrayTargetsResult.ok) {
      return arrayTargetsResult;
    }

    const arrayTargets = arrayTargetsResult.data;
    const hasArrayTarget = arrayTargets.length > 0;

    // Validate at most one array target
    if (arrayTargets.length > 1) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: JSON.stringify(arrayTargets),
            expectedFormat: "single array target",
          },
          `Schema can have at most one x-frontmatter-part array, found: ${arrayTargets.length}`,
        ),
      };
    }

    const arrayTarget = arrayTargets[0];

    // Extract derivation rules
    const derivationRulesResult = this.extractDerivationRules(schemaObj);
    if (!derivationRulesResult.ok) {
      return derivationRulesResult;
    }

    return {
      ok: true,
      data: new SchemaStructure(
        hasArrayTarget,
        arrayTarget,
        templatePath,
        derivationRulesResult.data,
      ),
    };
  }

  /**
   * Extract template path from schema root
   */
  private static extractTemplatePath(
    schema: Record<string, unknown>,
  ): string | undefined {
    // Use SchemaExtensions constant instead of hardcoded string (eliminates Issue #651)
    const templatePath = schema[SchemaExtensions.TEMPLATE];
    return typeof templatePath === "string" ? templatePath : undefined;
  }

  /**
   * Find all array targets with x-frontmatter-part
   */
  private static findArrayTargets(
    schema: Record<string, unknown>,
    pathPrefix = "",
  ): Result<ArrayTarget[], DomainError & { message: string }> {
    const targets: ArrayTarget[] = [];

    // Check properties object
    const properties = schema.properties;
    if (typeof properties === "object" && properties !== null) {
      const propsObj = properties as Record<string, unknown>;

      for (const [propName, propSchema] of Object.entries(propsObj)) {
        const fullPath = pathPrefix ? `${pathPrefix}.${propName}` : propName;

        // Check if this property is an array target
        if (this.isArrayTarget(propSchema)) {
          const arrayTargetResult = ArrayTarget.create(fullPath, propSchema);
          if (!arrayTargetResult.ok) {
            return arrayTargetResult;
          }
          targets.push(arrayTargetResult.data);
        }

        // Recursively check nested objects
        if (this.isObjectSchema(propSchema)) {
          const nestedTargetsResult = this.findArrayTargets(
            propSchema as Record<string, unknown>,
            fullPath,
          );
          if (!nestedTargetsResult.ok) {
            return nestedTargetsResult;
          }
          targets.push(...nestedTargetsResult.data);
        }
      }
    }

    return { ok: true, data: targets };
  }

  /**
   * Check if schema property is an array target
   */
  private static isArrayTarget(propSchema: unknown): boolean {
    if (typeof propSchema !== "object" || propSchema === null) {
      return false;
    }

    const schema = propSchema as Record<string, unknown>;
    // Use SchemaExtensions constant instead of hardcoded string (eliminates Issue #651)
    return schema.type === "array" &&
      schema[SchemaExtensions.FRONTMATTER_PART] === true;
  }

  /**
   * Check if schema property is an object schema
   */
  private static isObjectSchema(propSchema: unknown): boolean {
    if (typeof propSchema !== "object" || propSchema === null) {
      return false;
    }

    const schema = propSchema as Record<string, unknown>;
    return schema.type === "object" && typeof schema.properties === "object";
  }

  /**
   * Extract derivation rules from schema
   */
  private static extractDerivationRules(
    schema: Record<string, unknown>,
  ): Result<readonly DerivationRule[], DomainError & { message: string }> {
    const rules: DerivationRule[] = [];

    // Create accessor for safe property access
    const configResult = SchemaExtensionConfig.createDefault();
    if (!configResult.ok) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "NotConfigured",
            component: "schema_extension_config",
          },
          `Failed to create configuration: ${configResult.error.message}`,
        ),
      };
    }
    const accessor = new SchemaPropertyAccessor(configResult.data);

    // Check properties for x-derived-from
    const properties = schema.properties;
    if (typeof properties === "object" && properties !== null) {
      const propsObj = properties as Record<string, unknown>;

      for (const [propName, propSchema] of Object.entries(propsObj)) {
        if (typeof propSchema === "object" && propSchema !== null) {
          const schemaObj = propSchema as Record<string, unknown>;
          const derivedFrom = accessor.getDerivedFrom(schemaObj);

          if (typeof derivedFrom === "string") {
            rules.push({
              targetProperty: propName,
              sourceArray: derivedFrom,
              derivationType: "collect", // Default type
            });
          }
        }
      }
    }

    return { ok: true, data: rules };
  }

  /**
   * Check if schema requires array-based processing
   */
  requiresArrayBasedProcessing(): boolean {
    return this.hasArrayTarget;
  }

  /**
   * Get the array target if present
   */
  getArrayTarget(): ArrayTarget | undefined {
    return this.arrayTarget;
  }

  /**
   * Get the template path if specified
   */
  getTemplatePath(): string | undefined {
    return this.templatePath;
  }

  /**
   * Get all derivation rules
   */
  getDerivationRules(): readonly DerivationRule[] {
    return this.derivationRules;
  }

  /**
   * Check if schema has template path
   */
  hasTemplate(): boolean {
    return this.templatePath !== undefined;
  }

  /**
   * Check if schema has derivation rules
   */
  hasDerivationRules(): boolean {
    return this.derivationRules.length > 0;
  }

  /**
   * Get processing mode based on structure analysis
   */
  getProcessingModeType(): "Individual" | "ArrayBased" {
    return this.hasArrayTarget ? "ArrayBased" : "Individual";
  }

  /**
   * Value equality comparison
   */
  equals(other: SchemaStructure): boolean {
    return this.hasArrayTarget === other.hasArrayTarget &&
      this.templatePath === other.templatePath &&
      JSON.stringify(this.derivationRules) ===
        JSON.stringify(other.derivationRules) &&
      (this.arrayTarget?.equals(other.arrayTarget!) ??
        (other.arrayTarget === undefined));
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    const mode = this.getProcessingModeType();
    const template = this.templatePath
      ? ` (template: ${this.templatePath})`
      : "";
    const rules = this.derivationRules.length > 0
      ? ` (${this.derivationRules.length} rules)`
      : "";
    return `SchemaStructure[${mode}]${template}${rules}`;
  }
}
