import { ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { SchemaPath } from "../value-objects/schema-path.ts";
import { SchemaDefinition } from "../value-objects/schema-definition.ts";
import { ValidationRules } from "../value-objects/validation-rules.ts";
// Removed unused imports - DomainLogger, NullDomainLogger
import { DebugLogger } from "../../../infrastructure/adapters/debug-logger.ts";
import { defaultSchemaExtensionRegistry } from "../value-objects/schema-extension-registry.ts";
// Removed unused import - isRefSchema

export interface ResolvedSchema {
  readonly definition: SchemaDefinition;
  readonly referencedSchemas: Map<string, SchemaDefinition>;
}

// Totality: Convert optional properties to discriminated union state
export type SchemaState =
  | {
    kind: "initial";
    path: SchemaPath;
    definition: SchemaDefinition;
    logger: DebugLogger | null;
  }
  | {
    kind: "resolved";
    path: SchemaPath;
    definition: SchemaDefinition;
    resolved: ResolvedSchema;
    logger: DebugLogger | null;
  }
  | {
    kind: "validated";
    path: SchemaPath;
    definition: SchemaDefinition;
    validationRules: ValidationRules;
    logger: DebugLogger | null;
  }
  | {
    kind: "complete";
    path: SchemaPath;
    definition: SchemaDefinition;
    validationRules: ValidationRules;
    resolved: ResolvedSchema;
    logger: DebugLogger | null;
  };

export class Schema {
  private constructor(private readonly state: SchemaState) {}

  // Smart Constructor pattern
  static create(
    path: SchemaPath,
    definition: SchemaDefinition,
    debugLogger?: DebugLogger,
  ): Result<Schema, SchemaError & { message: string }> {
    const logger = debugLogger || null;
    logger?.logInfo("schema-creation", "Creating Schema instance", {
      path: path.toString(),
    });

    const initialState: SchemaState = {
      kind: "initial",
      path,
      definition,
      logger,
    };

    return ok(new Schema(initialState));
  }

  getPath(): SchemaPath {
    return this.state.path;
  }

  getDefinition(): SchemaDefinition {
    return this.state.definition;
  }

  // Totality: Replace partial function with total function using Result pattern
  getValidationRules(): Result<
    ValidationRules,
    SchemaError & { message: string }
  > {
    switch (this.state.kind) {
      case "validated":
      case "complete": {
        return ok(this.state.validationRules);
      }
      case "initial":
      case "resolved": {
        // Generate rules on-demand for backwards compatibility
        const rules = ValidationRules.fromSchema(
          this.state.definition.getRawSchema(),
        );
        return ok(rules);
      }
    }
  }

  // Totality: Clear state checking through discriminated union
  isResolved(): boolean {
    return this.state.kind === "resolved" || this.state.kind === "complete";
  }

  getResolved(): Result<ResolvedSchema, SchemaError & { message: string }> {
    switch (this.state.kind) {
      case "resolved":
      case "complete": {
        return ok(this.state.resolved);
      }
      case "initial":
      case "validated": {
        return ErrorHandler.schema().invalid("Schema not resolved");
      }
    }
  }

  // Totality: State transitions create new instances with proper state
  withResolved(resolved: ResolvedSchema): Schema {
    this.state.logger?.logInfo(
      "schema-resolution",
      "Schema resolved with external references",
      {
        referencedSchemas: resolved.referencedSchemas.size,
      },
    );

    const newState: SchemaState = this.state.kind === "validated"
      ? {
        kind: "complete",
        path: this.state.path,
        definition: this.state.definition,
        validationRules: this.state.validationRules,
        resolved,
        logger: this.state.logger,
      }
      : {
        kind: "resolved",
        path: this.state.path,
        definition: this.state.definition,
        resolved,
        logger: this.state.logger,
      };

    return new Schema(newState);
  }

  withValidationRules(rules: ValidationRules): Schema {
    this.state.logger?.logInfo(
      "schema-validation",
      "Schema updated with validation rules",
    );

    const newState: SchemaState = this.state.kind === "resolved"
      ? {
        kind: "complete",
        path: this.state.path,
        definition: this.state.definition,
        validationRules: rules,
        resolved: this.state.resolved,
        logger: this.state.logger,
      }
      : {
        kind: "validated",
        path: this.state.path,
        definition: this.state.definition,
        validationRules: rules,
        logger: this.state.logger,
      };

    return new Schema(newState);
  }

  getTemplatePath(): Result<string, SchemaError & { message: string }> {
    return this.state.definition.getTemplatePath();
  }

  getTemplateFormat(): Result<
    "json" | "yaml" | "markdown",
    SchemaError & { message: string }
  > {
    return this.state.definition.getTemplateFormat();
  }

  hasFrontmatterPart(): boolean {
    return this.state.definition.hasFrontmatterPart();
  }

  findFrontmatterPartSchema(): Result<
    SchemaDefinition,
    SchemaError & { message: string }
  > {
    this.state.logger?.logDebug(
      "schema-analysis",
      "Searching for frontmatter-part schema",
    );

    const findInProperties = (
      def: SchemaDefinition,
    ): Result<SchemaDefinition, SchemaError & { message: string }> => {
      if (def.hasFrontmatterPart()) {
        this.state.logger?.logExtensionDetection(
          defaultSchemaExtensionRegistry.getFrontmatterPartKey().getValue(),
          true,
          true,
        );
        return ok(def);
      }

      const propertiesResult = def.getProperties();
      if (propertiesResult.ok) {
        for (const [key, prop] of Object.entries(propertiesResult.data)) {
          this.state.logger?.logDebug(
            "schema-traversal",
            `Checking property: ${key}`,
          );
          // Use fromSchemaProperty since prop is already migrated
          const propDef = SchemaDefinition.fromSchemaProperty(prop as any);
          const foundResult = findInProperties(propDef);
          if (foundResult.ok) return foundResult;
        }
      }

      return ErrorHandler.schema().frontmatterPartNotFound();
    };

    const foundResult = findInProperties(this.state.definition);
    if (foundResult.ok) {
      this.state.logger?.logInfo(
        "schema-analysis",
        "Found frontmatter-part schema",
      );
      return foundResult;
    }

    this.state.logger?.logInfo(
      "schema-analysis",
      "No frontmatter-part schema found",
    );
    return foundResult;
  }

  findFrontmatterPartPath(): Result<string, SchemaError & { message: string }> {
    this.state.logger?.logDebug(
      "schema-path-analysis",
      "Searching for frontmatter-part path",
    );

    const findPath = (
      def: SchemaDefinition,
      currentPath: string = "",
    ): Result<string, SchemaError & { message: string }> => {
      if (def.hasFrontmatterPart()) {
        this.state.logger?.logDebug(
          "schema-path-analysis",
          `Found frontmatter-part at path: ${currentPath || "root"}`,
        );
        return ok(currentPath);
      }

      const propertiesResult = def.getProperties();
      if (propertiesResult.ok) {
        for (const [propName, prop] of Object.entries(propertiesResult.data)) {
          // Use fromSchemaProperty since prop is already migrated
          const propDef = SchemaDefinition.fromSchemaProperty(prop as any);
          const newPath = currentPath ? `${currentPath}.${propName}` : propName;
          this.state.logger?.logDebug(
            "schema-path-traversal",
            `Checking path: ${newPath}`,
          );
          const foundResult = findPath(propDef, newPath);
          if (foundResult.ok) return foundResult;
        }
      }

      return ErrorHandler.schema().frontmatterPartNotFound();
    };

    const pathResult = findPath(this.state.definition);
    if (pathResult.ok) {
      this.state.logger?.logInfo(
        "schema-path-analysis",
        `Frontmatter-part path found: ${pathResult.data}`,
      );
      return pathResult;
    }

    this.state.logger?.logInfo(
      "schema-path-analysis",
      "No frontmatter-part path found",
    );
    return pathResult;
  }

  getDerivedRules(): Array<{
    sourcePath: string;
    targetField: string;
    unique: boolean;
  }> {
    this.state.logger?.logDebug(
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
        this.state.logger?.logDerivationRule(
          derivedFromResult.data,
          path,
          true,
          `unique=${def.isDerivedUnique()}`,
        );
      } else {
        this.state.logger?.logExtensionDetection(
          defaultSchemaExtensionRegistry.getDerivedFromKey().getValue(),
          false,
        );
      }

      const propertiesResult = def.getProperties();
      if (propertiesResult.ok) {
        for (const [key, prop] of Object.entries(propertiesResult.data)) {
          const propPath = path ? `${path}.${key}` : key;
          this.state.logger?.logDebug(
            "derivation-rule-traversal",
            `Checking property: ${propPath}`,
          );
          // Use fromSchemaProperty since prop is already migrated
          const propDef = SchemaDefinition.fromSchemaProperty(prop as any);
          extractRules(propDef, propPath);
        }
      }
    };

    extractRules(this.state.definition);

    this.state.logger?.logInfo(
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
