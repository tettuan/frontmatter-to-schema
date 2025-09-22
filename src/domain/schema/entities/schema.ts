import { err, ok, Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { SchemaPath } from "../value-objects/schema-path.ts";
import { SchemaDefinition } from "../value-objects/schema-definition.ts";
import { ValidationRules } from "../value-objects/validation-rules.ts";
import { DebugLogger } from "../../../infrastructure/adapters/debug-logger.ts";
import { defaultSchemaExtensionRegistry } from "../value-objects/schema-extension-registry.ts";
import { isRefSchema } from "../value-objects/schema-property-types.ts";
import { ExtractFromDirective } from "../value-objects/extract-from-directive.ts";

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

  getExtractFromDirectives(): Result<
    ExtractFromDirective[],
    SchemaError & { message: string }
  > {
    const traversalContext = this.getExtractFromTraversalContext();
    const directives: ExtractFromDirective[] = [];

    const result = this.collectExtractFromDirectives(
      traversalContext.rootDefinition,
      "",
      {
        ...traversalContext,
        stopOnFirstMatch: false,
        collect: (targetPath, sourcePath, mergeArrays, targetIsArray) => {
          const directiveResult = ExtractFromDirective.create({
            targetPath,
            sourcePath,
            mergeArrays,
            targetIsArray,
          });

          if (!directiveResult.ok) {
            return ErrorHandler.schema().invalid(
              `Invalid x-extract-from directive at path '${targetPath}': ${directiveResult.error.message}`,
            );
          }

          directives.push(directiveResult.data);
          return ok(undefined);
        },
      },
    );

    if (!result.ok) {
      this.state.logger?.logError(
        "extract-from-collection",
        result.error,
        {
          schemaPath: this.state.path.toString(),
        },
      );
      return err(result.error);
    }

    return ok(directives);
  }

  hasExtractFromDirectives(): boolean {
    const traversalContext = this.getExtractFromTraversalContext();

    const result = this.collectExtractFromDirectives(
      traversalContext.rootDefinition,
      "",
      {
        ...traversalContext,
        stopOnFirstMatch: true,
      },
    );

    if (!result.ok) {
      this.state.logger?.logError(
        "extract-from-detection",
        result.error,
        {
          schemaPath: this.state.path.toString(),
        },
      );
      return false;
    }

    return result.data;
  }

  private getExtractFromTraversalContext(): {
    rootDefinition: SchemaDefinition;
    referencedSchemas: Map<string, SchemaDefinition>;
    visitedRefs: Set<string>;
  } {
    if (this.state.kind === "resolved" || this.state.kind === "complete") {
      return {
        rootDefinition: this.state.resolved.definition,
        referencedSchemas: this.state.resolved.referencedSchemas,
        visitedRefs: new Set<string>(),
      };
    }

    return {
      rootDefinition: this.state.definition,
      referencedSchemas: new Map<string, SchemaDefinition>(),
      visitedRefs: new Set<string>(),
    };
  }

  private collectExtractFromDirectives(
    definition: SchemaDefinition,
    currentPath: string,
    context: {
      referencedSchemas: Map<string, SchemaDefinition>;
      visitedRefs: Set<string>;
      collect?: (
        targetPath: string,
        sourcePath: string,
        mergeArrays: boolean | undefined,
        targetIsArray: boolean,
      ) => Result<void, SchemaError & { message: string }>;
      stopOnFirstMatch: boolean;
    },
  ): Result<boolean, SchemaError & { message: string }> {
    const { referencedSchemas, visitedRefs, collect, stopOnFirstMatch } =
      context;
    let found = false;

    if (definition.hasExtractFrom()) {
      if (!currentPath) {
        return ErrorHandler.schema().invalid(
          "x-extract-from directive cannot target the schema root",
        );
      }

      const extractResult = definition.getExtractFrom();
      if (!extractResult.ok) {
        return err(extractResult.error);
      }

      this.state.logger?.logExtensionDetection(
        defaultSchemaExtensionRegistry.getExtractFromKey().getValue(),
        true,
        {
          targetPath: currentPath,
          sourcePath: extractResult.data,
        },
      );

      let mergeArraysValue: boolean | undefined;
      if (definition.hasMergeArrays()) {
        const mergeArraysResult = definition.getMergeArrays();
        if (!mergeArraysResult.ok) {
          return err(mergeArraysResult.error);
        }
        mergeArraysValue = mergeArraysResult.data;
      }

      if (collect) {
        const storeResult = collect(
          currentPath,
          extractResult.data,
          mergeArraysValue,
          definition.isKind("array"),
        );
        if (!storeResult.ok) {
          return storeResult;
        }
      }

      found = true;
      if (stopOnFirstMatch) {
        return ok(true);
      }
    }

    if (definition.getKind() === "object") {
      const propertiesResult = definition.getProperties();
      if (!propertiesResult.ok) {
        return err(propertiesResult.error);
      }

      for (const [key, property] of Object.entries(propertiesResult.data)) {
        if (typeof property === "object" && property !== null) {
          const nextPath = currentPath ? `${currentPath}.${key}` : key;
          const propertyDefinition = SchemaDefinition.fromSchemaProperty(
            property as any,
          );
          const childResult = this.collectExtractFromDirectives(
            propertyDefinition,
            nextPath,
            context,
          );

          if (!childResult.ok) {
            return childResult;
          }

          if (childResult.data) {
            found = true;
            if (stopOnFirstMatch) {
              return ok(true);
            }
          }
        }
      }
    }

    if (definition.getKind() === "array") {
      const itemsResult = definition.getItems();
      if (!itemsResult.ok) {
        return err(itemsResult.error);
      }

      const itemsPath = currentPath ? `${currentPath}.[]` : "[]";
      const items = itemsResult.data;

      if (isRefSchema(items)) {
        const visitKey = `${items.$ref}::${itemsPath}`;
        if (!visitedRefs.has(visitKey)) {
          const referencedDefinition = referencedSchemas.get(items.$ref);
          if (!referencedDefinition) {
            return ErrorHandler.schema().invalid(
              `Referenced schema '${items.$ref}' not found for array items at path '${itemsPath}'`,
            );
          }

          visitedRefs.add(visitKey);
          const refResult = this.collectExtractFromDirectives(
            referencedDefinition,
            itemsPath,
            context,
          );
          visitedRefs.delete(visitKey);

          if (!refResult.ok) {
            return refResult;
          }

          if (refResult.data) {
            found = true;
            if (stopOnFirstMatch) {
              return ok(true);
            }
          }
        }
      } else {
        const itemsDefinition = SchemaDefinition.fromSchemaProperty(
          items as any,
        );
        const childResult = this.collectExtractFromDirectives(
          itemsDefinition,
          itemsPath,
          context,
        );

        if (!childResult.ok) {
          return childResult;
        }

        if (childResult.data) {
          found = true;
          if (stopOnFirstMatch) {
            return ok(true);
          }
        }
      }
    }

    if (definition.hasRef()) {
      const refResult = definition.getRef();
      if (!refResult.ok) {
        return err(refResult.error);
      }

      const ref = refResult.data;
      const visitKey = `${ref}::${currentPath}`;
      if (visitedRefs.has(visitKey)) {
        return ok(found);
      }

      const referencedDefinition = referencedSchemas.get(ref);
      if (!referencedDefinition) {
        return ErrorHandler.schema().invalid(
          `Referenced schema '${ref}' not found for path '${
            currentPath || "<root>"
          }'`,
        );
      }

      visitedRefs.add(visitKey);
      const refTraversalResult = this.collectExtractFromDirectives(
        referencedDefinition,
        currentPath,
        context,
      );
      visitedRefs.delete(visitKey);

      if (!refTraversalResult.ok) {
        return refTraversalResult;
      }

      if (refTraversalResult.data) {
        found = true;
        if (stopOnFirstMatch) {
          return ok(true);
        }
      }
    }

    return ok(found);
  }
}
