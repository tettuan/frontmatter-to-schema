import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, ValidationError } from "../../shared/types/errors.ts";
import type { SchemaProperty } from "./schema-property-types.ts";
import { isRefSchema } from "./schema-property-types.ts";

export interface ValidationRule {
  readonly path: string;
  readonly type?: string;
  readonly required?: boolean;
  readonly enum?: readonly unknown[];
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly format?: string;
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
    return err(createError({
      kind: "ValidationRuleNotFound",
      path: path,
    }));
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
   * Get validation rules count (compatibility for length property access)
   */
  get length(): number {
    return this.rules.length;
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
      constraintHandling: (schema as any).constraints ? "dynamic" : "none",
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
      const stringRule: ValidationRule = {
        path,
        type: "string",
        pattern: schema.constraints?.pattern,
        minLength: schema.constraints?.minLength,
        maxLength: schema.constraints?.maxLength,
        format: schema.constraints?.format,
      };
      rules.push(stringRule);
      break;
    }

    case "number": {
      const numberRule: ValidationRule = {
        path,
        type: "number",
        minimum: schema.constraints?.minimum,
        maximum: schema.constraints?.maximum,
      };
      rules.push(numberRule);
      break;
    }

    case "integer": {
      const integerRule: ValidationRule = {
        path,
        type: "integer",
        minimum: schema.constraints?.minimum,
        maximum: schema.constraints?.maximum,
      };
      rules.push(integerRule);
      break;
    }

    case "boolean": {
      const booleanRule: ValidationRule = {
        path,
        type: "boolean",
      };
      rules.push(booleanRule);
      break;
    }

    case "array": {
      const arrayRule: ValidationRule = {
        path,
        type: "array",
      };
      rules.push(arrayRule);

      // Extract rules for array items
      if (!isRefSchema(schema.items)) {
        extractRules(schema.items, `${path}[]`, rules);
      }
      break;
    }

    case "object": {
      const objectRule: ValidationRule = {
        path,
        type: "object",
      };
      rules.push(objectRule);

      // Extract rules for object properties
      for (const [key, prop] of Object.entries(schema.properties)) {
        const propPath = path ? `${path}.${key}` : key;
        if (schema.required.includes(key)) {
          const propRule = rules.find((r) => r.path === propPath);
          if (propRule) {
            Object.assign(propRule, { required: true });
          } else {
            rules.push({ path: propPath, required: true });
          }
        }
        extractRules(prop, propPath, rules);
      }
      break;
    }

    case "enum": {
      const enumRule: ValidationRule = {
        path,
        type: schema.baseType || "string",
        enum: schema.values,
      };
      rules.push(enumRule);
      break;
    }

    case "ref": {
      // References should be resolved before validation rule extraction
      const refRule: ValidationRule = {
        path,
        type: "object", // Default assumption for refs
      };
      rules.push(refRule);
      break;
    }

    case "null": {
      const nullRule: ValidationRule = {
        path,
        type: "null",
      };
      rules.push(nullRule);
      break;
    }

    case "any": {
      const anyRule: ValidationRule = {
        path,
        // No specific type for any
      };
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

  for (const rule of pathRules) {
    // Check required fields
    if (rule.required && (data === undefined || data === null)) {
      return err(createError({
        kind: "MissingRequired",
        field: path,
      }));
    }

    // Skip further validation if data is null/undefined and not required
    if (data === undefined || data === null) {
      continue;
    }

    // Type validation
    if (rule.type) {
      const actualType = getDataType(data);
      if (rule.type !== actualType) {
        // Special case: number can be integer
        if (
          !(rule.type === "integer" && actualType === "number" &&
            Number.isInteger(data))
        ) {
          return err(createError({
            kind: "InvalidType",
            expected: rule.type,
            actual: actualType,
          }));
        }
      }
    }

    // Enum validation
    if (rule.enum && rule.enum.length > 0) {
      if (!rule.enum.includes(data)) {
        return err(createError({
          kind: "InvalidType",
          expected: `enum: [${rule.enum.join(", ")}]`,
          actual: String(data),
        }));
      }
    }

    // String-specific validations
    if (typeof data === "string") {
      // Pattern validation
      if (rule.pattern) {
        try {
          const regex = new RegExp(rule.pattern);
          if (!regex.test(data)) {
            return err(createError({
              kind: "PatternMismatch",
              value: data,
              pattern: rule.pattern,
            }));
          }
        } catch {
          return err(createError({
            kind: "InvalidRegex",
            pattern: rule.pattern,
          }));
        }
      }

      // Length validations
      if (rule.minLength !== undefined && data.length < rule.minLength) {
        return err(createError({
          kind: "InvalidType",
          expected: `string with minimum length ${rule.minLength}`,
          actual: `string with length ${data.length}`,
        }));
      }

      if (rule.maxLength !== undefined && data.length > rule.maxLength) {
        return err(createError({
          kind: "TooLong",
          value: data,
          maxLength: rule.maxLength,
        }));
      }
    }

    // Number-specific validations
    if (typeof data === "number") {
      if (rule.minimum !== undefined && data < rule.minimum) {
        return err(createError({
          kind: "OutOfRange",
          value: data,
          min: rule.minimum,
          max: rule.maximum,
        }));
      }

      if (rule.maximum !== undefined && data > rule.maximum) {
        return err(createError({
          kind: "OutOfRange",
          value: data,
          min: rule.minimum,
          max: rule.maximum,
        }));
      }
    }
  }

  return ok(data);
}

function getDataType(data: unknown): string {
  if (data === null) return "null";
  if (Array.isArray(data)) return "array";
  const type = typeof data;
  if (type === "object") return "object";
  return type;
}
