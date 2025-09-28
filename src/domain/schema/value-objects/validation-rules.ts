import { err, ok, Result } from "../../shared/types/result.ts";
import { ValidationError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import type { SchemaProperty } from "./schema-property-types.ts";
import { isRefSchema } from "./schema-property-types.ts";
import { SafePropertyAccess } from "../../shared/utils/safe-property-access.ts";

/**
 * Validation rules following Totality principles with discriminated unions
 * Eliminates optional properties in favor of explicit rule types
 */
export type ValidationRule =
  | {
    readonly kind: "string";
    readonly path: string;
    readonly required: boolean;
    readonly pattern?: string;
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly format?: string;
  }
  | {
    readonly kind: "number";
    readonly path: string;
    readonly required: boolean;
    readonly minimum?: number;
    readonly maximum?: number;
  }
  | {
    readonly kind: "integer";
    readonly path: string;
    readonly required: boolean;
    readonly minimum?: number;
    readonly maximum?: number;
  }
  | {
    readonly kind: "boolean";
    readonly path: string;
    readonly required: boolean;
  }
  | {
    readonly kind: "array";
    readonly path: string;
    readonly required: boolean;
  }
  | {
    readonly kind: "object";
    readonly path: string;
    readonly required: boolean;
  }
  | {
    readonly kind: "enum";
    readonly path: string;
    readonly required: boolean;
    readonly baseType: string;
    readonly values: readonly unknown[];
  }
  | { readonly kind: "ref"; readonly path: string; readonly required: boolean }
  | { readonly kind: "null"; readonly path: string; readonly required: boolean }
  | { readonly kind: "any"; readonly path: string; readonly required: boolean };

/**
 * Smart constructors for validation rules following Totality principles
 */
export class ValidationRuleFactory {
  static createStringRule(
    path: string,
    required: boolean,
    constraints?: {
      pattern?: string;
      minLength?: number;
      maxLength?: number;
      format?: string;
    },
  ): ValidationRule {
    return {
      kind: "string",
      path,
      required,
      ...constraints,
    };
  }

  static createNumberRule(
    path: string,
    required: boolean,
    constraints?: { minimum?: number; maximum?: number },
  ): ValidationRule {
    return {
      kind: "number",
      path,
      required,
      ...constraints,
    };
  }

  static createIntegerRule(
    path: string,
    required: boolean,
    constraints?: { minimum?: number; maximum?: number },
  ): ValidationRule {
    return {
      kind: "integer",
      path,
      required,
      ...constraints,
    };
  }

  static createBooleanRule(path: string, required: boolean): ValidationRule {
    return { kind: "boolean", path, required };
  }

  static createArrayRule(path: string, required: boolean): ValidationRule {
    return { kind: "array", path, required };
  }

  static createObjectRule(path: string, required: boolean): ValidationRule {
    return { kind: "object", path, required };
  }

  static createEnumRule(
    path: string,
    required: boolean,
    baseType: string,
    values: readonly unknown[],
  ): ValidationRule {
    return { kind: "enum", path, required, baseType, values };
  }

  static createRefRule(path: string, required: boolean): ValidationRule {
    return { kind: "ref", path, required };
  }

  static createNullRule(path: string, required: boolean): ValidationRule {
    return { kind: "null", path, required };
  }

  static createAnyRule(path: string, required: boolean): ValidationRule {
    return { kind: "any", path, required };
  }
}

export class ValidationRules {
  private constructor(private readonly rules: readonly ValidationRule[]) {}

  static create(rules: ValidationRule[]): ValidationRules {
    return new ValidationRules(rules);
  }

  static fromSchema(
    schema: SchemaProperty,
    path: string = "",
  ): ValidationRules {
    const rules: ValidationRule[] = [];
    extractRules(schema, path, rules);
    return new ValidationRules(rules);
  }

  getRules(): readonly ValidationRule[] {
    return this.rules;
  }

  getRuleForPath(
    path: string,
  ): Result<ValidationRule, ValidationError & { message: string }> {
    const rule = this.rules.find((rule) => rule.path === path);
    if (rule) {
      return ok(rule);
    }
    return ErrorHandler.validation({
      operation: "getRuleForPath",
      method: "findRule",
    }).validationRuleNotFound(path);
  }

  validate(
    data: unknown,
    path: string = "",
  ): Result<unknown, ValidationError & { message: string }> {
    return validateWithRules(data, this.rules, path);
  }

  /**
   * Get the number of validation rules
   */
  getCount(): number {
    return this.rules.length;
  }

  /**
   * Get validation rules count
   * Note: Use getCount() method instead of direct property access for Totality compliance
   * @deprecated Use getCount() method instead for proper encapsulation
   */
  get length(): number {
    // This getter is deprecated to maintain Totality principle compliance
    // Direct property access violates encapsulation - use getCount() instead
    return this.getCount();
  }
}

function extractRules(
  schema: SchemaProperty,
  path: string,
  rules: ValidationRule[],
): void {
  // 全域性デバッグ: schema.kind別の完全性確認
  const _totalityDebugInfo = {
    schemaKind: schema.kind,
    path: path,
    currentRulesCount: rules.length,
    expectedExhaustiveness: "complete",
  };

  // 段階的品質向上 - 振れ幅分析デバッグ情報追加
  const _varianceAnalysisDebug = {
    functionName: "extractRules",
    varianceImpactLevel: "high", // このメソッドは全域性違反の中心点
    specialCaseDetection: schema.kind === "ref" || schema.kind === "any"
      ? "detected"
      : "none",
    totalityViolationRisk: schema.kind === "ref" ? "medium" : "low",
    hardcodingPatterns: {
      switchStatementBranches: 10, // 10種類のschema.kind分岐
      specialHandlingRequired: ["ref", "any"], // 特殊処理が必要な型
      constraintHandling: (() => {
        const schemaObjResult = SafePropertyAccess.asRecord(schema);
        if (schemaObjResult.ok && "constraints" in schemaObjResult.data) {
          return "dynamic";
        }
        return "none";
      })(),
    },
    entropyContribution: {
      branchingFactor: 10, // switch文の分岐数
      complexityScore: 15.2, // この関数の推定エントロピー貢献度
      refactoringPriority: "high",
    },
    reductionStrategy: "strategy-pattern-replacement", // switch → 戦略パターン化
  };

  // Exhaustive switch based on schema kind - 全域性原則適用
  switch (schema.kind) {
    case "string": {
      const stringRule = ValidationRuleFactory.createStringRule(
        path,
        false, // Will be updated later for required properties
        {
          pattern: schema.constraints?.pattern,
          minLength: schema.constraints?.minLength,
          maxLength: schema.constraints?.maxLength,
          format: schema.constraints?.format,
        },
      );
      rules.push(stringRule);
      break;
    }

    case "number": {
      const numberRule = ValidationRuleFactory.createNumberRule(
        path,
        false, // Will be updated later for required properties
        {
          minimum: schema.constraints?.minimum,
          maximum: schema.constraints?.maximum,
        },
      );
      rules.push(numberRule);
      break;
    }

    case "integer": {
      const integerRule = ValidationRuleFactory.createIntegerRule(
        path,
        false, // Will be updated later for required properties
        {
          minimum: schema.constraints?.minimum,
          maximum: schema.constraints?.maximum,
        },
      );
      rules.push(integerRule);
      break;
    }

    case "boolean": {
      const booleanRule = ValidationRuleFactory.createBooleanRule(path, false);
      rules.push(booleanRule);
      break;
    }

    case "array": {
      const arrayRule = ValidationRuleFactory.createArrayRule(path, false);
      rules.push(arrayRule);

      // Extract rules for array items
      if (!isRefSchema(schema.items)) {
        extractRules(schema.items, `${path}[]`, rules);
      }
      break;
    }

    case "object": {
      const objectRule = ValidationRuleFactory.createObjectRule(path, false);
      rules.push(objectRule);

      // Extract rules for object properties
      for (const [key, prop] of Object.entries(schema.properties)) {
        const propPath = path ? `${path}.${key}` : key;
        const isRequired = schema.required.includes(key);
        extractRules(prop, propPath, rules);

        // Update the rule to mark as required if needed
        if (isRequired) {
          const propRule = rules.find((r) => r.path === propPath);
          if (propRule) {
            // Create a new rule with required=true following immutability
            const index = rules.indexOf(propRule);
            rules[index] = { ...propRule, required: true };
          }
        }
      }
      break;
    }

    case "enum": {
      const enumRule = ValidationRuleFactory.createEnumRule(
        path,
        false, // Will be updated later for required properties
        schema.baseType || "string",
        schema.values,
      );
      rules.push(enumRule);
      break;
    }

    case "ref": {
      // References should be resolved before validation rule extraction
      const refRule = ValidationRuleFactory.createRefRule(path, false);
      rules.push(refRule);
      break;
    }

    case "null": {
      const nullRule = ValidationRuleFactory.createNullRule(path, false);
      rules.push(nullRule);
      break;
    }

    case "any": {
      const anyRule = ValidationRuleFactory.createAnyRule(path, false);
      rules.push(anyRule);
      break;
    }
  }
}

function validateWithRules(
  data: unknown,
  rules: readonly ValidationRule[],
  path: string,
): Result<unknown, ValidationError & { message: string }> {
  // Filter rules for current path
  const pathRules = rules.filter((rule) => rule.path === path);

  // If no rules for this path, data is valid
  if (pathRules.length === 0) {
    return ok(data);
  }

  let normalizedData = data;

  // Normalize boolean arrays to single boolean value (frontmatter may emit `[true]`)
  if (
    pathRules.some((rule) => rule.kind === "boolean") &&
    Array.isArray(normalizedData)
  ) {
    normalizedData = normalizedData.length > 0 ? normalizedData[0] : undefined;
  }

  for (const rule of pathRules) {
    // Check required fields
    if (
      rule.required && (normalizedData === undefined || normalizedData === null)
    ) {
      return ErrorHandler.validation({
        operation: "validateWithRules",
        method: "checkRequired",
      }).missingRequired(path);
    }

    // Skip further validation if data is null/undefined and not required
    if (normalizedData === undefined || normalizedData === null) {
      continue;
    }

    // Type validation using discriminated union
    const actualType = getDataType(normalizedData);
    if (rule.kind !== actualType) {
      // Special case: number can be integer
      if (
        !(rule.kind === "integer" && actualType === "number" &&
          Number.isInteger(normalizedData))
      ) {
        return ErrorHandler.validation({
          operation: "validateWithRules",
          method: "validateType",
        }).invalidType(rule.kind, actualType);
      }
    }

    // Enum validation using discriminated union
    if (rule.kind === "enum") {
      if (!rule.values.includes(normalizedData)) {
        return ErrorHandler.validation({
          operation: "validateWithRules",
          method: "validateEnum",
        }).invalidType(
          `enum: [${rule.values.join(", ")}]`,
          String(normalizedData),
        );
      }
    }

    // String-specific validations using discriminated union
    if (rule.kind === "string" && typeof normalizedData === "string") {
      // Pattern validation
      if (rule.pattern) {
        try {
          const regex = new RegExp(rule.pattern);
          if (!regex.test(normalizedData)) {
            return ErrorHandler.validation({
              operation: "validateWithRules",
              method: "validatePattern",
            }).patternMismatch(normalizedData, rule.pattern);
          }
        } catch {
          return ErrorHandler.validation({
            operation: "validateWithRules",
            method: "compilePattern",
          }).invalidRegex(rule.pattern);
        }
      }

      // Length validations
      if (
        rule.minLength !== undefined &&
        normalizedData.length < rule.minLength
      ) {
        return ErrorHandler.validation({
          operation: "validateWithRules",
          method: "validateMinLength",
        }).invalidType(
          `string with minimum length ${rule.minLength}`,
          `string with length ${normalizedData.length}`,
        );
      }

      if (
        rule.maxLength !== undefined &&
        normalizedData.length > rule.maxLength
      ) {
        return ErrorHandler.validation({
          operation: "validateWithRules",
          method: "validateMaxLength",
        }).tooLong(normalizedData, rule.maxLength);
      }
    }

    // Number-specific validations using discriminated union
    if (
      (rule.kind === "number" || rule.kind === "integer") &&
      typeof normalizedData === "number"
    ) {
      if (rule.minimum !== undefined && normalizedData < rule.minimum) {
        return ErrorHandler.validation({
          operation: "validateWithRules",
          method: "validateMinimum",
        }).outOfRange(normalizedData, rule.minimum, rule.maximum);
      }

      if (rule.maximum !== undefined && normalizedData > rule.maximum) {
        return ErrorHandler.validation({
          operation: "validateWithRules",
          method: "validateMaximum",
        }).outOfRange(normalizedData, rule.minimum, rule.maximum);
      }
    }
  }

  if (normalizedData === undefined || normalizedData === null) {
    return ok(normalizedData);
  }

  if (Array.isArray(normalizedData)) {
    const normalizedArray = normalizedData;
    const itemPath = path ? `${path}[]` : "[]";

    for (let i = 0; i < normalizedArray.length; i++) {
      const itemResult = validateWithRules(normalizedArray[i], rules, itemPath);
      if (!itemResult.ok) {
        return itemResult;
      }
      normalizedArray[i] = itemResult.data;
    }

    return ok(normalizedArray);
  }

  if (typeof normalizedData === "object") {
    const recordResult = SafePropertyAccess.asRecord(normalizedData);
    if (!recordResult.ok) {
      return err(recordResult.error);
    }

    const record = recordResult.data;
    const keysToValidate = getDirectChildKeys(rules, path);
    for (const key of Object.keys(record)) {
      keysToValidate.add(key);
    }

    for (const key of keysToValidate) {
      const childPath = path ? `${path}.${key}` : key;
      const childValue = record[key];
      const childResult = validateWithRules(childValue, rules, childPath);
      if (!childResult.ok) {
        return childResult;
      }

      if (childResult.data !== childValue && childResult.data !== undefined) {
        record[key] = childResult.data;
      }
    }

    return ok(record);
  }

  return ok(normalizedData);
}

function getDataType(data: unknown): string {
  if (data === null) return "null";
  if (Array.isArray(data)) return "array";
  const type = typeof data;
  if (type === "object") return "object";
  return type;
}

function getDirectChildKeys(
  rules: readonly ValidationRule[],
  parentPath: string,
): Set<string> {
  const keys = new Set<string>();
  const prefix = parentPath ? `${parentPath}.` : "";

  for (const rule of rules) {
    if (rule.path === parentPath) {
      continue;
    }

    if (!rule.path.startsWith(prefix)) {
      continue;
    }

    const remainder = rule.path.slice(prefix.length);
    if (remainder.length === 0) {
      continue;
    }

    if (remainder.includes(".")) {
      continue;
    }

    if (remainder.endsWith("[]")) {
      continue;
    }

    keys.add(remainder);
  }

  return keys;
}
