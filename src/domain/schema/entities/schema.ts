import { ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { SchemaPath } from "../value-objects/schema-path.ts";
import { SchemaDefinition } from "../value-objects/schema-definition.ts";
import { ValidationRules } from "../value-objects/validation-rules.ts";

export interface ResolvedSchema {
  readonly definition: SchemaDefinition;
  readonly referencedSchemas: Map<string, SchemaDefinition>;
}

export class Schema {
  private constructor(
    private readonly path: SchemaPath,
    private readonly definition: SchemaDefinition,
    private readonly validationRules?: ValidationRules,
    private readonly resolved?: ResolvedSchema,
  ) {}

  static create(
    path: SchemaPath,
    definition: SchemaDefinition,
  ): Result<Schema, SchemaError & { message: string }> {
    return ok(new Schema(path, definition));
  }

  getPath(): SchemaPath {
    return this.path;
  }

  getDefinition(): SchemaDefinition {
    return this.definition;
  }

  getValidationRules(): ValidationRules {
    if (!this.validationRules) {
      return ValidationRules.fromSchema(this.definition.getRawSchema());
    }
    return this.validationRules;
  }

  isResolved(): boolean {
    return this.resolved !== undefined;
  }

  getResolved(): ResolvedSchema | undefined {
    return this.resolved;
  }

  withResolved(resolved: ResolvedSchema): Schema {
    return new Schema(
      this.path,
      this.definition,
      this.validationRules,
      resolved,
    );
  }

  withValidationRules(rules: ValidationRules): Schema {
    return new Schema(
      this.path,
      this.definition,
      rules,
      this.resolved,
    );
  }

  getTemplatePath(): string | undefined {
    return this.definition.getTemplatePath();
  }

  hasFrontmatterPart(): boolean {
    return this.definition.hasFrontmatterPart();
  }

  findFrontmatterPartSchema(): SchemaDefinition | undefined {
    const findInProperties = (
      def: SchemaDefinition,
    ): SchemaDefinition | undefined => {
      if (def.hasFrontmatterPart()) {
        return def;
      }

      const properties = def.getProperties();
      if (properties) {
        for (const prop of Object.values(properties)) {
          const propDef = SchemaDefinition.create(prop);
          if (propDef.ok) {
            const found = findInProperties(propDef.data);
            if (found) return found;
          }
        }
      }

      return undefined;
    };

    return findInProperties(this.definition);
  }

  findFrontmatterPartPath(): string | undefined {
    const findPath = (
      def: SchemaDefinition,
      currentPath: string = "",
    ): string | undefined => {
      if (def.hasFrontmatterPart()) {
        return currentPath;
      }

      const properties = def.getProperties();
      if (properties) {
        for (const [propName, prop] of Object.entries(properties)) {
          const propDef = SchemaDefinition.create(prop);
          if (propDef.ok) {
            const newPath = currentPath
              ? `${currentPath}.${propName}`
              : propName;
            const found = findPath(propDef.data, newPath);
            if (found) return found;
          }
        }
      }

      return undefined;
    };

    return findPath(this.definition);
  }

  getDerivedRules(): Array<{
    sourcePath: string;
    targetField: string;
    unique: boolean;
  }> {
    const rules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }> = [];

    const extractRules = (def: SchemaDefinition, path: string = "") => {
      const derivedFrom = def.getDerivedFrom();
      if (derivedFrom) {
        rules.push({
          sourcePath: derivedFrom,
          targetField: path,
          unique: def.isDerivedUnique(),
        });
      }

      const properties = def.getProperties();
      if (properties) {
        for (const [key, prop] of Object.entries(properties)) {
          const propPath = path ? `${path}.${key}` : key;
          const propDef = SchemaDefinition.create(prop);
          if (propDef.ok) {
            extractRules(propDef.data, propPath);
          }
        }
      }
    };

    extractRules(this.definition);
    return rules;
  }
}
