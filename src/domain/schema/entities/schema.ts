import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, SchemaError } from "../../shared/types/errors.ts";
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

  getResolved(): Result<ResolvedSchema, SchemaError & { message: string }> {
    if (this.resolved) {
      return ok(this.resolved);
    }
    return err(createError({ kind: "SchemaNotResolved" }));
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

  getTemplatePath(): Result<string, SchemaError & { message: string }> {
    return this.definition.getTemplatePath();
  }

  hasFrontmatterPart(): boolean {
    return this.definition.hasFrontmatterPart();
  }

  findFrontmatterPartSchema(): Result<
    SchemaDefinition,
    SchemaError & { message: string }
  > {
    const findInProperties = (
      def: SchemaDefinition,
    ): SchemaDefinition | undefined => {
      if (def.hasFrontmatterPart()) {
        return def;
      }

      const propertiesResult = def.getProperties();
      if (propertiesResult.ok) {
        for (const prop of Object.values(propertiesResult.data)) {
          const propDef = SchemaDefinition.create(prop);
          if (propDef.ok) {
            const found = findInProperties(propDef.data);
            if (found) return found;
          }
        }
      }

      return undefined;
    };

    const found = findInProperties(this.definition);
    if (found) {
      return ok(found);
    }
    return err(createError({ kind: "FrontmatterPartNotFound" }));
  }

  findFrontmatterPartPath(): Result<string, SchemaError & { message: string }> {
    const findPath = (
      def: SchemaDefinition,
      currentPath: string = "",
    ): string | undefined => {
      if (def.hasFrontmatterPart()) {
        return currentPath;
      }

      const propertiesResult = def.getProperties();
      if (propertiesResult.ok) {
        for (const [propName, prop] of Object.entries(propertiesResult.data)) {
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

    const path = findPath(this.definition);
    if (path !== undefined) {
      return ok(path);
    }
    return err(createError({ kind: "FrontmatterPartNotFound" }));
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
      const derivedFromResult = def.getDerivedFrom();
      if (derivedFromResult.ok) {
        rules.push({
          sourcePath: derivedFromResult.data,
          targetField: path,
          unique: def.isDerivedUnique(),
        });
      }

      const propertiesResult = def.getProperties();
      if (propertiesResult.ok) {
        for (const [key, prop] of Object.entries(propertiesResult.data)) {
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
