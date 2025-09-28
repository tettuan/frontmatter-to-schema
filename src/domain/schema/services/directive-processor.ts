import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { SchemaData } from "../entities/schema.ts";

/**
 * Supported x-directive types in the schema.
 */
export type DirectiveType =
  | "x-frontmatter-part"
  | "x-flatten-arrays"
  | "x-derived-from"
  | "x-template-format"
  | "x-template-items"
  | "x-template";

/**
 * Directive processing context for maintaining state during processing.
 */
export interface DirectiveContext {
  readonly currentPath: string[];
  readonly parentSchema: SchemaData;
  readonly rootSchema: SchemaData;
}

/**
 * Directive information extracted from schema properties.
 */
export interface ExtractedDirective {
  readonly type: DirectiveType;
  readonly value: unknown;
  readonly path: string[];
  readonly context: DirectiveContext;
}

/**
 * Result of directive processing containing modified schema and extracted directives.
 */
export interface ProcessingResult {
  readonly processedSchema: SchemaData;
  readonly extractedDirectives: ExtractedDirective[];
  readonly hasDirectives: boolean;
}

/**
 * Directive validation errors following totality principle.
 */
export type DirectiveValidationError =
  | {
    kind: "InvalidDirectiveValue";
    directive: string;
    value: unknown;
    expected: string;
  }
  | {
    kind: "ConflictingDirectives";
    directive1: string;
    directive2: string;
    path: string[];
  }
  | { kind: "UnsupportedDirective"; directive: string; path: string[] }
  | {
    kind: "InvalidDirectiveCombination";
    directives: string[];
    reason: string;
  };

/**
 * Directive processing strategy for different directive types.
 */
export interface DirectiveHandler {
  readonly directiveType: DirectiveType;
  validate(
    value: unknown,
    context: DirectiveContext,
  ): Result<void, DirectiveValidationError>;
  process(
    value: unknown,
    schema: SchemaData,
    context: DirectiveContext,
  ): Result<SchemaData, DirectiveValidationError>;
}

/**
 * Service for processing x-directives in JSON schemas.
 * Implements totality principle with comprehensive error handling.
 */
export class DirectiveProcessor {
  private readonly handlers: Map<DirectiveType, DirectiveHandler> = new Map();

  private constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Creates a DirectiveProcessor with default handlers.
   */
  static create(): DirectiveProcessor {
    return new DirectiveProcessor();
  }

  /**
   * Processes all x-directives in a schema recursively.
   * Returns processed schema with directives extracted and validated.
   */
  processDirectives(
    schema: SchemaData,
    rootPath: string[] = [],
  ): Result<ProcessingResult, SchemaError> {
    try {
      const context: DirectiveContext = {
        currentPath: rootPath,
        parentSchema: schema,
        rootSchema: schema,
      };

      const result = this.processSchemaDirectives(schema, context);
      if (result.isError()) {
        return Result.error(
          this.convertDirectiveErrorToSchemaError(result.unwrapError()),
        );
      }

      return Result.ok(result.unwrap());
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new SchemaError(
          `Directive processing failed: ${errorMessage}`,
          "DIRECTIVE_PROCESSING_ERROR",
          { schema, rootPath, error },
        ),
      );
    }
  }

  /**
   * Extracts all directives from a schema without processing them.
   * Useful for analysis and validation.
   */
  extractDirectives(
    schema: SchemaData,
    rootPath: string[] = [],
  ): Result<ExtractedDirective[], SchemaError> {
    try {
      const context: DirectiveContext = {
        currentPath: rootPath,
        parentSchema: schema,
        rootSchema: schema,
      };

      const directives = this.extractDirectivesRecursive(schema, context);
      return Result.ok(directives);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new SchemaError(
          `Directive extraction failed: ${errorMessage}`,
          "DIRECTIVE_EXTRACTION_ERROR",
          { schema, rootPath, error },
        ),
      );
    }
  }

  /**
   * Validates directives in a schema without processing them.
   */
  validateDirectives(
    schema: SchemaData,
    rootPath: string[] = [],
  ): Result<void, SchemaError> {
    const extractResult = this.extractDirectives(schema, rootPath);
    if (extractResult.isError()) {
      return Result.error(extractResult.unwrapError());
    }

    const directives = extractResult.unwrap();

    for (const directive of directives) {
      const handler = this.handlers.get(directive.type);
      if (!handler) {
        return Result.error(
          new SchemaError(
            `Unsupported directive: ${directive.type}`,
            "UNSUPPORTED_DIRECTIVE",
            { directive: directive.type, path: directive.path },
          ),
        );
      }

      const validationResult = handler.validate(
        directive.value,
        directive.context,
      );
      if (validationResult.isError()) {
        return Result.error(
          this.convertDirectiveErrorToSchemaError(
            validationResult.unwrapError(),
          ),
        );
      }
    }

    // Check for conflicting directives
    const conflictResult = this.checkDirectiveConflicts(directives);
    if (conflictResult.isError()) {
      return Result.error(
        this.convertDirectiveErrorToSchemaError(conflictResult.unwrapError()),
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Registers a custom directive handler.
   */
  registerHandler(handler: DirectiveHandler): Result<void, SchemaError> {
    if (this.handlers.has(handler.directiveType)) {
      return Result.error(
        new SchemaError(
          `Handler for directive ${handler.directiveType} already registered`,
          "HANDLER_ALREADY_REGISTERED",
          { directiveType: handler.directiveType },
        ),
      );
    }

    this.handlers.set(handler.directiveType, handler);
    return Result.ok(undefined);
  }

  /**
   * Recursively processes directives in a schema.
   */
  private processSchemaDirectives(
    schema: SchemaData,
    context: DirectiveContext,
  ): Result<ProcessingResult, DirectiveValidationError> {
    const extractedDirectives: ExtractedDirective[] = [];
    let processedSchema = { ...schema };
    let hasDirectives = false;

    // Extract directives from current level
    const currentDirectives = this.extractDirectivesFromLevel(schema, context);
    extractedDirectives.push(...currentDirectives);

    if (currentDirectives.length > 0) {
      hasDirectives = true;

      // Process each directive
      for (const directive of currentDirectives) {
        const handler = this.handlers.get(directive.type);
        if (!handler) {
          return Result.error({
            kind: "UnsupportedDirective",
            directive: directive.type,
            path: directive.path,
          });
        }

        // Validate directive
        const validationResult = handler.validate(
          directive.value,
          directive.context,
        );
        if (validationResult.isError()) {
          return Result.error(validationResult.unwrapError());
        }

        // Process directive
        const processingResult = handler.process(
          directive.value,
          processedSchema,
          directive.context,
        );
        if (processingResult.isError()) {
          return Result.error(processingResult.unwrapError());
        }

        processedSchema = processingResult.unwrap();
      }

      // Remove directive properties from processed schema
      processedSchema = this.removeDirectiveProperties(processedSchema);
    }

    // Recursively process nested schemas
    if (processedSchema.properties) {
      const nestedProperties: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(processedSchema.properties)) {
        if (this.isSchemaObject(value)) {
          const nestedContext: DirectiveContext = {
            currentPath: [...context.currentPath, key],
            parentSchema: processedSchema,
            rootSchema: context.rootSchema,
          };

          const nestedResult = this.processSchemaDirectives(
            value,
            nestedContext,
          );

          if (nestedResult.isError()) {
            return nestedResult;
          }

          const nested = nestedResult.unwrap();
          nestedProperties[key] = nested.processedSchema;
          extractedDirectives.push(...nested.extractedDirectives);
          hasDirectives = hasDirectives || nested.hasDirectives;
        } else {
          nestedProperties[key] = value;
        }
      }

      processedSchema = {
        ...processedSchema,
        properties: nestedProperties,
      };
    }

    return Result.ok({
      processedSchema,
      extractedDirectives,
      hasDirectives,
    });
  }

  /**
   * Extracts directives from the current schema level only.
   */
  private extractDirectivesFromLevel(
    schema: SchemaData,
    context: DirectiveContext,
  ): ExtractedDirective[] {
    const directives: ExtractedDirective[] = [];

    for (const [key, value] of Object.entries(schema)) {
      if (this.isDirectiveProperty(key)) {
        directives.push({
          type: key,
          value,
          path: context.currentPath,
          context,
        });
      }
    }

    return directives;
  }

  /**
   * Recursively extracts all directives from a schema.
   */
  private extractDirectivesRecursive(
    schema: SchemaData,
    context: DirectiveContext,
  ): ExtractedDirective[] {
    const directives: ExtractedDirective[] = [];

    // Extract from current level
    directives.push(...this.extractDirectivesFromLevel(schema, context));

    // Recursively extract from nested schemas
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        if (this.isSchemaObject(value)) {
          const nestedContext: DirectiveContext = {
            currentPath: [...context.currentPath, key],
            parentSchema: schema,
            rootSchema: context.rootSchema,
          };

          directives.push(
            ...this.extractDirectivesRecursive(
              value,
              nestedContext,
            ),
          );
        }
      }
    }

    return directives;
  }

  /**
   * Checks for conflicting directives.
   */
  private checkDirectiveConflicts(
    directives: ExtractedDirective[],
  ): Result<void, DirectiveValidationError> {
    // Group directives by path
    const directivesByPath = new Map<string, ExtractedDirective[]>();

    for (const directive of directives) {
      const pathKey = directive.path.join(".");
      if (!directivesByPath.has(pathKey)) {
        directivesByPath.set(pathKey, []);
      }
      directivesByPath.get(pathKey)!.push(directive);
    }

    // Check for conflicts within each path
    for (const [path, pathDirectives] of directivesByPath) {
      const types = pathDirectives.map((d) => d.type);

      // Check for mutually exclusive directives
      if (
        types.includes("x-frontmatter-part") && types.includes("x-derived-from")
      ) {
        return Result.error({
          kind: "ConflictingDirectives",
          directive1: "x-frontmatter-part",
          directive2: "x-derived-from",
          path: path.split("."),
        });
      }

      // Check for template directives conflicts
      const templateDirectives = types.filter((t) =>
        t.startsWith("x-template")
      );
      if (
        templateDirectives.length > 1 &&
        templateDirectives.includes("x-template") &&
        templateDirectives.includes("x-template-format")
      ) {
        return Result.error({
          kind: "ConflictingDirectives",
          directive1: "x-template",
          directive2: "x-template-format",
          path: path.split("."),
        });
      }
    }

    return Result.ok(undefined);
  }

  /**
   * Removes directive properties from a schema object.
   */
  private removeDirectiveProperties(schema: SchemaData): SchemaData {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(schema)) {
      if (!this.isDirectiveProperty(key)) {
        cleaned[key] = value;
      }
    }

    return cleaned as SchemaData;
  }

  /**
   * Checks if a property key is a directive.
   */
  private isDirectiveProperty(key: string): key is DirectiveType {
    return key.startsWith("x-") &&
      this.getSupportedDirectives().includes(key as DirectiveType);
  }

  /**
   * Checks if a value is a schema object.
   */
  private isSchemaObject(value: unknown): value is SchemaData {
    return typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof (value as Record<string, unknown>).type === "string";
  }

  /**
   * Returns list of supported directive types.
   */
  private getSupportedDirectives(): DirectiveType[] {
    return [
      "x-frontmatter-part",
      "x-flatten-arrays",
      "x-derived-from",
      "x-template-format",
      "x-template-items",
      "x-template",
    ];
  }

  /**
   * Registers default directive handlers.
   */
  private registerDefaultHandlers(): void {
    // Default handlers will be simple validation-only handlers
    // More sophisticated handlers can be registered later

    this.handlers.set("x-frontmatter-part", {
      directiveType: "x-frontmatter-part",
      validate: (value: unknown) => {
        if (typeof value !== "boolean") {
          return Result.error({
            kind: "InvalidDirectiveValue",
            directive: "x-frontmatter-part",
            value,
            expected: "boolean",
          });
        }
        return Result.ok(undefined);
      },
      process: (_value: unknown, schema: SchemaData) => Result.ok(schema),
    });

    this.handlers.set("x-flatten-arrays", {
      directiveType: "x-flatten-arrays",
      validate: (value: unknown) => {
        if (typeof value !== "string" || value.trim().length === 0) {
          return Result.error({
            kind: "InvalidDirectiveValue",
            directive: "x-flatten-arrays",
            value,
            expected: "non-empty string (property name to flatten)",
          });
        }
        return Result.ok(undefined);
      },
      process: (value: unknown, schema: SchemaData) => {
        // Store the property name for later flattening during frontmatter processing
        return Result.ok({
          ...schema,
          "x-flatten-arrays": value,
        });
      },
    });

    this.handlers.set("x-derived-from", {
      directiveType: "x-derived-from",
      validate: (value: unknown) => {
        if (typeof value !== "string" && !Array.isArray(value)) {
          return Result.error({
            kind: "InvalidDirectiveValue",
            directive: "x-derived-from",
            value,
            expected: "string or array of strings",
          });
        }
        if (
          Array.isArray(value) && !value.every((v) => typeof v === "string")
        ) {
          return Result.error({
            kind: "InvalidDirectiveValue",
            directive: "x-derived-from",
            value,
            expected: "array of strings",
          });
        }
        return Result.ok(undefined);
      },
      process: (_value: unknown, schema: SchemaData) => Result.ok(schema),
    });

    this.handlers.set("x-template-format", {
      directiveType: "x-template-format",
      validate: (value: unknown) => {
        if (typeof value !== "string") {
          return Result.error({
            kind: "InvalidDirectiveValue",
            directive: "x-template-format",
            value,
            expected: "string",
          });
        }
        const validFormats = ["json", "yaml"];
        if (!validFormats.includes(value)) {
          return Result.error({
            kind: "InvalidDirectiveValue",
            directive: "x-template-format",
            value,
            expected: `one of: ${validFormats.join(", ")}`,
          });
        }
        return Result.ok(undefined);
      },
      process: (_value: unknown, schema: SchemaData) => Result.ok(schema),
    });

    this.handlers.set("x-template-items", {
      directiveType: "x-template-items",
      validate: (value: unknown) => {
        if (typeof value !== "string") {
          return Result.error({
            kind: "InvalidDirectiveValue",
            directive: "x-template-items",
            value,
            expected: "string",
          });
        }
        return Result.ok(undefined);
      },
      process: (_value: unknown, schema: SchemaData) => Result.ok(schema),
    });

    this.handlers.set("x-template", {
      directiveType: "x-template",
      validate: (value: unknown) => {
        if (typeof value !== "string") {
          return Result.error({
            kind: "InvalidDirectiveValue",
            directive: "x-template",
            value,
            expected: "string",
          });
        }
        return Result.ok(undefined);
      },
      process: (_value: unknown, schema: SchemaData) => Result.ok(schema),
    });
  }

  /**
   * Converts DirectiveValidationError to SchemaError.
   */
  private convertDirectiveErrorToSchemaError(
    error: DirectiveValidationError,
  ): SchemaError {
    switch (error.kind) {
      case "InvalidDirectiveValue":
        return new SchemaError(
          `Invalid value for directive ${error.directive}: expected ${error.expected}, got ${typeof error
            .value}`,
          "INVALID_DIRECTIVE_VALUE",
          {
            directive: error.directive,
            value: error.value,
            expected: error.expected,
          },
        );
      case "ConflictingDirectives":
        return new SchemaError(
          `Conflicting directives: ${error.directive1} and ${error.directive2} at path ${
            error.path.join(".")
          }`,
          "CONFLICTING_DIRECTIVES",
          {
            directive1: error.directive1,
            directive2: error.directive2,
            path: error.path,
          },
        );
      case "UnsupportedDirective":
        return new SchemaError(
          `Unsupported directive: ${error.directive} at path ${
            error.path.join(".")
          }`,
          "UNSUPPORTED_DIRECTIVE",
          { directive: error.directive, path: error.path },
        );
      case "InvalidDirectiveCombination":
        return new SchemaError(
          `Invalid directive combination: ${
            error.directives.join(", ")
          } - ${error.reason}`,
          "INVALID_DIRECTIVE_COMBINATION",
          { directives: error.directives, reason: error.reason },
        );
    }
  }
}
