import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, SchemaError } from "../../shared/types/errors.ts";
import { SchemaPath } from "../value-objects/schema-path.ts";
import { SchemaDefinition } from "../value-objects/schema-definition.ts";
import { ValidationRules } from "../value-objects/validation-rules.ts";
import { DebugLogger } from "../../../infrastructure/adapters/debug-logger.ts";

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
    private readonly debugLogger?: DebugLogger,
  ) {}

  static create(
    path: SchemaPath,
    definition: SchemaDefinition,
    debugLogger?: DebugLogger,
  ): Result<Schema, SchemaError & { message: string }> {
    debugLogger?.logInfo("schema-creation", "Creating Schema instance", {
      path: path.toString(),
    });
    return ok(new Schema(path, definition, undefined, undefined, debugLogger));
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
    this.debugLogger?.logInfo(
      "schema-resolution",
      "Schema resolved with external references",
      {
        referencedSchemas: resolved.referencedSchemas.size,
      },
    );
    return new Schema(
      this.path,
      this.definition,
      this.validationRules,
      resolved,
      this.debugLogger,
    );
  }

  withValidationRules(rules: ValidationRules): Schema {
    this.debugLogger?.logInfo(
      "schema-validation",
      "Schema updated with validation rules",
    );
    return new Schema(
      this.path,
      this.definition,
      rules,
      this.resolved,
      this.debugLogger,
    );
  }

  getTemplatePath(): Result<string, SchemaError & { message: string }> {
    return this.definition.getTemplatePath();
  }

  getTemplateFormat(): Result<
    "json" | "yaml" | "toml" | "markdown",
    SchemaError & { message: string }
  > {
    return this.definition.getTemplateFormat();
  }

  hasFrontmatterPart(): boolean {
    return this.definition.hasFrontmatterPart();
  }

  findFrontmatterPartSchema(): Result<
    SchemaDefinition,
    SchemaError & { message: string }
  > {
    this.debugLogger?.logDebug(
      "schema-analysis",
      "Searching for frontmatter-part schema",
    );

    const findInProperties = (
      def: SchemaDefinition,
    ): SchemaDefinition | undefined => {
      if (def.hasFrontmatterPart()) {
        this.debugLogger?.logExtensionDetection(
          "x-frontmatter-part",
          true,
          true,
        );
        return def;
      }

      const propertiesResult = def.getProperties();
      if (propertiesResult.ok) {
        for (const [key, prop] of Object.entries(propertiesResult.data)) {
          this.debugLogger?.logDebug(
            "schema-traversal",
            `Checking property: ${key}`,
          );
          // Use fromSchemaProperty since prop is already migrated
          const propDef = SchemaDefinition.fromSchemaProperty(prop);
          const found = findInProperties(propDef);
          if (found) return found;
        }
      }

      return undefined;
    };

    const found = findInProperties(this.definition);
    if (found) {
      this.debugLogger?.logInfo(
        "schema-analysis",
        "Found frontmatter-part schema",
      );
      return ok(found);
    }

    this.debugLogger?.logInfo(
      "schema-analysis",
      "No frontmatter-part schema found",
    );
    return err(createError({ kind: "FrontmatterPartNotFound" }));
  }

  findFrontmatterPartPath(): Result<string, SchemaError & { message: string }> {
    this.debugLogger?.logDebug(
      "schema-path-analysis",
      "Searching for frontmatter-part path",
    );

    const findPath = (
      def: SchemaDefinition,
      currentPath: string = "",
    ): string | undefined => {
      if (def.hasFrontmatterPart()) {
        this.debugLogger?.logDebug(
          "schema-path-analysis",
          `Found frontmatter-part at path: ${currentPath || "root"}`,
        );
        return currentPath;
      }

      const propertiesResult = def.getProperties();
      if (propertiesResult.ok) {
        for (const [propName, prop] of Object.entries(propertiesResult.data)) {
          // Use fromSchemaProperty since prop is already migrated
          const propDef = SchemaDefinition.fromSchemaProperty(prop);
          const newPath = currentPath ? `${currentPath}.${propName}` : propName;
          this.debugLogger?.logDebug(
            "schema-path-traversal",
            `Checking path: ${newPath}`,
          );
          const found = findPath(propDef, newPath);
          if (found) return found;
        }
      }

      return undefined;
    };

    const path = findPath(this.definition);
    if (path !== undefined) {
      this.debugLogger?.logInfo(
        "schema-path-analysis",
        `Frontmatter-part path found: ${path}`,
      );
      return ok(path);
    }

    this.debugLogger?.logInfo(
      "schema-path-analysis",
      "No frontmatter-part path found",
    );
    return err(createError({ kind: "FrontmatterPartNotFound" }));
  }

  getDerivedRules(): Array<{
    sourcePath: string;
    targetField: string;
    unique: boolean;
  }> {
    this.debugLogger?.logDebug(
      "derivation-rules",
      "Extracting derivation rules from schema",
    );

    const rules: Array<{
      sourcePath: string;
      targetField: string;
      unique: boolean;
    }> = [];

    const extractRules = (def: SchemaDefinition, path: string = "") => {
      const derivedFromResult = def.getDerivedFrom();
      if (derivedFromResult.ok) {
        const rule = {
          sourcePath: derivedFromResult.data,
          targetField: path,
          unique: def.isDerivedUnique(),
        };
        rules.push(rule);
        this.debugLogger?.logDerivationRule(
          derivedFromResult.data,
          path,
          true,
          `unique=${def.isDerivedUnique()}`,
        );
      } else {
        this.debugLogger?.logExtensionDetection("x-derived-from", false);
      }

      const propertiesResult = def.getProperties();
      if (propertiesResult.ok) {
        for (const [key, prop] of Object.entries(propertiesResult.data)) {
          const propPath = path ? `${path}.${key}` : key;
          this.debugLogger?.logDebug(
            "derivation-rule-traversal",
            `Checking property: ${propPath}`,
          );
          // Use fromSchemaProperty since prop is already migrated
          const propDef = SchemaDefinition.fromSchemaProperty(prop);
          extractRules(propDef, propPath);
        }
      }
    };

    extractRules(this.definition);

    this.debugLogger?.logInfo(
      "derivation-rules",
      `Extracted ${rules.length} derivation rules`,
      {
        rules: rules.map((r) => ({
          sourcePath: r.sourcePath,
          targetField: r.targetField,
          unique: r.unique,
        })),
      },
    );

    return rules;
  }
}
