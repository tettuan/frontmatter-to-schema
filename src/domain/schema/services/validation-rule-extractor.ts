/**
 * ValidationRuleExtractor Domain Service
 *
 * Extracts validation rules from resolved schemas following DDD and Totality principles
 * Uses value objects and returns Result<T,E> for all operations
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type { SchemaDefinition } from "../../value-objects/schema-definition.ts";
import {
  type RuleSeverity,
  type RuleType,
  type ValidationRule,
  ValidationRules,
} from "../../value-objects/validation-rules.ts";

/**
 * Extracted validation rule
 */
export interface ExtractedRule {
  readonly path: string;
  readonly type: string;
  readonly required: boolean;
  readonly constraints: Record<string, unknown>;
}

/**
 * ValidationRuleExtractor domain service for extracting validation rules from schemas
 * Follows Totality principles - all functions are total and return Result<T,E>
 */
export class ValidationRuleExtractor {
  private constructor() {}

  /**
   * Smart Constructor for ValidationRuleExtractor
   * @returns Result containing ValidationRuleExtractor
   */
  static create(): Result<
    ValidationRuleExtractor,
    DomainError & { message: string }
  > {
    return {
      ok: true,
      data: new ValidationRuleExtractor(),
    };
  }

  /**
   * Extract validation rules from a resolved schema
   * @param schema - Resolved schema to extract rules from
   * @returns Result containing ValidationRules or error
   */
  extractRules(
    schema: SchemaDefinition,
  ): Result<ValidationRules, DomainError & { message: string }> {
    try {
      const contentResult = schema.getParsedSchema();
      if (!contentResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: schema.getRawDefinition().substring(0, 100),
              details: contentResult.error.message,
            },
            "Failed to parse schema for rule extraction",
          ),
        };
      }

      const extractedRules = this.extractRulesFromObject(
        contentResult.data,
        "",
      );

      // Convert ExtractedRule to ValidationRule format
      const validationRules: ValidationRule[] = extractedRules.map((rule) =>
        this.convertToValidationRule(rule)
      );

      return ValidationRules.create(validationRules);
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ExtractionError",
            reason: error instanceof Error ? error.message : String(error),
          },
          "Failed to extract validation rules from schema",
        ),
      };
    }
  }

  /**
   * Extract specific validation rules by property path
   * @param schema - Schema to extract from
   * @param propertyPath - Dot-separated property path
   * @returns Result containing specific validation rules or error
   */
  extractRulesForProperty(
    schema: SchemaDefinition,
    propertyPath: string,
  ): Result<ExtractedRule[], DomainError & { message: string }> {
    if (!propertyPath || propertyPath.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Property path cannot be empty",
        ),
      };
    }

    try {
      const contentResult = schema.getParsedSchema();
      if (!contentResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: schema.getRawDefinition().substring(0, 100),
              details: contentResult.error.message,
            },
            "Failed to parse schema for property rule extraction",
          ),
        };
      }

      const rules = this.extractRulesFromObject(contentResult.data, "");
      const matchingRules = rules.filter((rule) =>
        rule.path === propertyPath || rule.path.startsWith(propertyPath + ".")
      );

      return {
        ok: true,
        data: matchingRules,
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ExtractionError",
            property: propertyPath,
            reason: error instanceof Error ? error.message : String(error),
          },
          `Failed to extract validation rules for property: ${propertyPath}`,
        ),
      };
    }
  }

  /**
   * Get all property paths that have validation rules
   * @param schema - Schema to analyze
   * @returns Result containing array of property paths or error
   */
  getValidatedPaths(
    schema: SchemaDefinition,
  ): Result<string[], DomainError & { message: string }> {
    try {
      const contentResult = schema.getParsedSchema();
      if (!contentResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ParseError",
              input: schema.getRawDefinition().substring(0, 100),
              details: contentResult.error.message,
            },
            "Failed to parse schema for path extraction",
          ),
        };
      }

      const rules = this.extractRulesFromObject(contentResult.data, "");
      const paths = [...new Set(rules.map((rule) => rule.path))].sort();

      return {
        ok: true,
        data: paths,
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ExtractionError",
            reason: error instanceof Error ? error.message : String(error),
          },
          "Failed to extract validated paths from schema",
        ),
      };
    }
  }

  /**
   * Check if a property path has validation rules
   * @param schema - Schema to check
   * @param propertyPath - Property path to check
   * @returns Result containing boolean or error
   */
  hasValidationRules(
    schema: SchemaDefinition,
    propertyPath: string,
  ): Result<boolean, DomainError & { message: string }> {
    const rulesResult = this.extractRulesForProperty(schema, propertyPath);
    if (!rulesResult.ok) {
      return rulesResult;
    }

    return {
      ok: true,
      data: rulesResult.data.length > 0,
    };
  }

  /**
   * Internal method to recursively extract rules from schema object
   */
  private extractRulesFromObject(
    obj: Record<string, unknown>,
    basePath: string,
  ): ExtractedRule[] {
    const rules: ExtractedRule[] = [];

    // Handle JSON Schema properties
    if (obj.type || obj.properties || obj.items || obj.required) {
      const rule: ExtractedRule = {
        path: basePath,
        type: this.getType(obj),
        required: this.isRequired(obj, basePath),
        constraints: this.extractConstraints(obj),
      };
      rules.push(rule);
    }

    // Recursively process properties
    if (obj.properties && typeof obj.properties === "object") {
      const properties = obj.properties as Record<string, unknown>;
      for (const [propName, propSchema] of Object.entries(properties)) {
        if (typeof propSchema === "object" && propSchema !== null) {
          const newPath = basePath ? `${basePath}.${propName}` : propName;
          rules.push(
            ...this.extractRulesFromObject(
              propSchema as Record<string, unknown>,
              newPath,
            ),
          );
        }
      }
    }

    // Handle array items
    if (obj.items && typeof obj.items === "object") {
      const itemsPath = basePath ? `${basePath}[]` : "[]";
      rules.push(
        ...this.extractRulesFromObject(
          obj.items as Record<string, unknown>,
          itemsPath,
        ),
      );
    }

    // Handle additional properties
    if (
      obj.additionalProperties && typeof obj.additionalProperties === "object"
    ) {
      const additionalPath = basePath ? `${basePath}.*` : "*";
      rules.push(
        ...this.extractRulesFromObject(
          obj.additionalProperties as Record<string, unknown>,
          additionalPath,
        ),
      );
    }

    // Handle oneOf, anyOf, allOf
    for (const schemaType of ["oneOf", "anyOf", "allOf"]) {
      if (obj[schemaType] && Array.isArray(obj[schemaType])) {
        const schemas = obj[schemaType] as Record<string, unknown>[];
        schemas.forEach((subSchema, index) => {
          if (typeof subSchema === "object" && subSchema !== null) {
            const subPath = basePath
              ? `${basePath}.${schemaType}[${index}]`
              : `${schemaType}[${index}]`;
            rules.push(...this.extractRulesFromObject(subSchema, subPath));
          }
        });
      }
    }

    return rules;
  }

  /**
   * Extract type from schema object
   */
  private getType(obj: Record<string, unknown>): string {
    if (obj.type && typeof obj.type === "string") {
      return obj.type;
    }
    if (obj.properties) return "object";
    if (obj.items) return "array";
    return "unknown";
  }

  /**
   * Check if field is required
   */
  private isRequired(obj: Record<string, unknown>, path: string): boolean {
    // Check if this property is in a parent's required array
    // This is a simplified check - in practice, you'd need context from parent
    if (obj.required === true) return true;
    if (Array.isArray(obj.required)) {
      const propertyName = path.split(".").pop() || "";
      return obj.required.includes(propertyName);
    }
    return false;
  }

  /**
   * Extract validation constraints from schema object
   */
  private extractConstraints(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    const constraints: Record<string, unknown> = {};

    // String constraints
    if (obj.minLength !== undefined) constraints.minLength = obj.minLength;
    if (obj.maxLength !== undefined) constraints.maxLength = obj.maxLength;
    if (obj.pattern !== undefined) constraints.pattern = obj.pattern;
    if (obj.format !== undefined) constraints.format = obj.format;

    // Number constraints
    if (obj.minimum !== undefined) constraints.minimum = obj.minimum;
    if (obj.maximum !== undefined) constraints.maximum = obj.maximum;
    if (obj.exclusiveMinimum !== undefined) {
      constraints.exclusiveMinimum = obj.exclusiveMinimum;
    }
    if (obj.exclusiveMaximum !== undefined) {
      constraints.exclusiveMaximum = obj.exclusiveMaximum;
    }
    if (obj.multipleOf !== undefined) constraints.multipleOf = obj.multipleOf;

    // Array constraints
    if (obj.minItems !== undefined) constraints.minItems = obj.minItems;
    if (obj.maxItems !== undefined) constraints.maxItems = obj.maxItems;
    if (obj.uniqueItems !== undefined) {
      constraints.uniqueItems = obj.uniqueItems;
    }

    // Object constraints
    if (obj.minProperties !== undefined) {
      constraints.minProperties = obj.minProperties;
    }
    if (obj.maxProperties !== undefined) {
      constraints.maxProperties = obj.maxProperties;
    }

    // Enum constraints
    if (obj.enum !== undefined) constraints.enum = obj.enum;

    // Const constraints
    if (obj.const !== undefined) constraints.const = obj.const;

    return constraints;
  }

  /**
   * Convert ExtractedRule to ValidationRule format
   */
  private convertToValidationRule(
    extractedRule: ExtractedRule,
  ): ValidationRule {
    const ruleType = this.mapTypeToRuleType(
      extractedRule.type,
      extractedRule.constraints,
    );
    const severity: RuleSeverity = extractedRule.required ? "error" : "warning";

    const params: Record<string, unknown> = {
      ...extractedRule.constraints,
      originalType: extractedRule.type,
      required: extractedRule.required,
    };

    // Add expectedType parameter for type rules
    if (ruleType === "type") {
      params.expectedType = extractedRule.type;
    }

    // Map JSON Schema constraint names to ValidationRule parameter names
    if (ruleType === "range") {
      // Map minimum/maximum to min/max for ValidationRule
      if (extractedRule.constraints.minimum !== undefined) {
        params.min = extractedRule.constraints.minimum;
      }
      if (extractedRule.constraints.maximum !== undefined) {
        params.max = extractedRule.constraints.maximum;
      }
      if (extractedRule.constraints.exclusiveMinimum !== undefined) {
        params.min = extractedRule.constraints.exclusiveMinimum;
        params.exclusive = true;
      }
      if (extractedRule.constraints.exclusiveMaximum !== undefined) {
        params.max = extractedRule.constraints.exclusiveMaximum;
        params.exclusive = true;
      }
    }

    return {
      name: extractedRule.path || "root",
      type: ruleType,
      severity,
      message: this.generateRuleMessage(extractedRule),
      params,
    };
  }

  /**
   * Map schema type to ValidationRule type
   */
  private mapTypeToRuleType(
    schemaType: string,
    constraints: Record<string, unknown>,
  ): RuleType {
    if (constraints.enum) return "enum";
    if (constraints.pattern || constraints.format) return "format";
    if (
      constraints.minLength !== undefined || constraints.maxLength !== undefined
    ) return "length";
    if (
      constraints.minimum !== undefined || constraints.maximum !== undefined ||
      constraints.exclusiveMinimum !== undefined ||
      constraints.exclusiveMaximum !== undefined
    ) return "range";

    switch (schemaType) {
      case "string":
      case "number":
      case "boolean":
      case "array":
      case "object":
        return "type";
      default:
        return "custom";
    }
  }

  /**
   * Generate a human-readable message for the rule
   */
  private generateRuleMessage(extractedRule: ExtractedRule): string {
    const path = extractedRule.path || "root";
    const type = extractedRule.type;
    const required = extractedRule.required ? " (required)" : "";

    return `${path} must be of type ${type}${required}`;
  }
}
