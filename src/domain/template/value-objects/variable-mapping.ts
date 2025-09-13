import { ok, Result } from "../../shared/types/result.ts";

export interface Variable {
  readonly name: string;
  readonly path: string;
  readonly isArray?: boolean;
  readonly isDynamic?: boolean;
}

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

  getVariable(name: string): Variable | undefined {
    return this.variables.get(name);
  }

  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }

  getVariableNames(): string[] {
    return Array.from(this.variables.keys());
  }

  getArrayVariables(): Variable[] {
    return this.getVariables().filter((v) => v.isArray);
  }

  getDynamicVariables(): Variable[] {
    return this.getVariables().filter((v) => v.isDynamic);
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
          name: varName,
          path,
          isArray: true,
        });
      } else {
        variables.set(varName, {
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
          name: keyMatch[1],
          path: path ? `${path}.${key}` : key,
          isDynamic: true,
        });
      }

      const newPath = path ? `${path}.${key}` : key;
      extractVariables(value, newPath, variables);
    }
  }
}
