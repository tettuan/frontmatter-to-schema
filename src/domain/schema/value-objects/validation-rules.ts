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
}

function extractRules(
  schema: SchemaProperty,
  path: string,
  rules: ValidationRule[],
): void {
  // Exhaustive switch based on schema kind
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
  _rules: readonly ValidationRule[],
  _path: string,
): Result<unknown, ValidationError & { message: string }> {
  return ok(data);
}
