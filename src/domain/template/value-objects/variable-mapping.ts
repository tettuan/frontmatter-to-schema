import { ok, Result } from "../../shared/types/result.ts";
import { ValidationError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";

export type Variable =
  | {
    readonly kind: "simple";
    readonly name: string;
    readonly path: string;
  }
  | {
    readonly kind: "array";
    readonly name: string;
    readonly path: string;
  }
  | {
    readonly kind: "dynamic";
    readonly name: string;
    readonly path: string;
  };

export class VariableMapping {
  private constructor(private readonly variables: Map<string, Variable>) {}

  static create(template: unknown): Result<VariableMapping, never> {
    const variables = new Map<string, Variable>();
    extractVariables(template, "", variables);
    return ok(new VariableMapping(variables));
  }

  static empty(): VariableMapping {
    return new VariableMapping(new Map());
  }

  getVariables(): Variable[] {
    return Array.from(this.variables.values());
  }

  getVariable(
    name: string,
  ): Result<Variable, ValidationError & { message: string }> {
    const variable = this.variables.get(name);
    if (!variable) {
      return ErrorHandler.validation({
        operation: "getVariable",
        method: "findVariable",
      }).missingRequired(name);
    }
    return ok(variable);
  }

  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }

  getVariableNames(): string[] {
    return Array.from(this.variables.keys());
  }

  getArrayVariables(): Variable[] {
    return this.getVariables().filter((v) => v.kind === "array");
  }

  getDynamicVariables(): Variable[] {
    return this.getVariables().filter((v) => v.kind === "dynamic");
  }

  getSimpleVariables(): Variable[] {
    return this.getVariables().filter((v) => v.kind === "simple");
  }

  merge(other: VariableMapping): VariableMapping {
    const merged = new Map(this.variables);
    for (const [key, value] of other.variables) {
      merged.set(key, value);
    }
    return new VariableMapping(merged);
  }
}

function extractVariables(
  template: unknown,
  path: string,
  variables: Map<string, Variable>,
): void {
  if (typeof template === "string") {
    const varPattern = /\{([^}]+)\}/g;
    let match;
    while ((match = varPattern.exec(template)) !== null) {
      const varName = match[1];
      if (varName.startsWith("@")) {
        variables.set(varName, {
          kind: "array",
          name: varName,
          path,
        });
      } else {
        variables.set(varName, {
          kind: "simple",
          name: varName,
          path,
        });
      }
    }
  } else if (Array.isArray(template)) {
    template.forEach((item, index) => {
      extractVariables(item, `${path}[${index}]`, variables);
    });
  } else if (template && typeof template === "object") {
    for (const [key, value] of Object.entries(template)) {
      const keyPattern = /\{([^}]+)\}/;
      const keyMatch = keyPattern.exec(key);
      if (keyMatch) {
        variables.set(keyMatch[1], {
          kind: "dynamic",
          name: keyMatch[1],
          path: path ? `${path}.${key}` : key,
        });
      }

      const newPath = path ? `${path}.${key}` : key;
      extractVariables(value, newPath, variables);
    }
  }
}
