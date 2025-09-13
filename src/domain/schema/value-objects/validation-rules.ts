import { ok, Result } from "../../shared/types/result.ts";
import { ValidationError } from "../../shared/types/errors.ts";
import type { SchemaProperty } from "./schema-definition.ts";

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

  getRuleForPath(path: string): ValidationRule | undefined {
    return this.rules.find((rule) => rule.path === path);
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
  const rule: ValidationRule = {
    path,
    type: schema.type,
    pattern: schema.pattern,
    minimum: schema.minimum,
    maximum: schema.maximum,
    minLength: schema.minLength,
    maxLength: schema.maxLength,
    format: schema.format,
    enum: schema.enum,
  };

  rules.push(rule);

  if (schema.properties) {
    const required = schema.required || [];
    for (const [key, prop] of Object.entries(schema.properties)) {
      const propPath = path ? `${path}.${key}` : key;
      if (required.includes(key)) {
        const propRule = rules.find((r) => r.path === propPath);
        if (propRule) {
          Object.assign(propRule, { required: true });
        } else {
          rules.push({ path: propPath, required: true });
        }
      }
      extractRules(prop, propPath, rules);
    }
  }

  if (
    schema.items && typeof schema.items === "object" &&
    !("$ref" in schema.items)
  ) {
    extractRules(schema.items, `${path}[]`, rules);
  }
}

function validateWithRules(
  data: unknown,
  _rules: readonly ValidationRule[],
  _path: string,
): Result<unknown, ValidationError & { message: string }> {
  return ok(data);
}
