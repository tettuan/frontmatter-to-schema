import { Result } from "../../shared/types/result.ts";
import { ProcessingError } from "../../shared/types/errors.ts";
import { FileSystemPort } from "../../../infrastructure/ports/file-system-port.ts";
import { createFileError } from "../../shared/types/file-errors.ts";
import { DIRECTIVE_NAMES } from "../constants/directive-names.ts";
import { FlattenArraysDirective } from "../value-objects/flatten-arrays-directive.ts";
import { DataPathResolver } from "../../../../sub_modules/data-path-resolver/src/data-path-resolver.ts";

/**
 * Domain service for processing schema directives and transformations.
 * Phase 2: Handles x-derived-from, x-derived-unique, x-flatten-arrays (Phase 2 only).
 * Note: x-jmespath-filter moved to Phase1DirectiveProcessor (per requirements).
 * Follows totality principles with comprehensive Result-based error handling.
 */
export class SchemaDirectiveProcessor {
  private constructor(private readonly fileSystem: FileSystemPort) {}

  /**
   * Creates a SchemaDirectiveProcessor instance.
   */
  static create(
    fileSystem: FileSystemPort,
  ): Result<SchemaDirectiveProcessor, ProcessingError> {
    if (!fileSystem) {
      return Result.error(
        new ProcessingError(
          "FileSystemPort is required for schema directive processing",
          "INVALID_DEPENDENCY",
          { dependency: "FileSystemPort" },
        ),
      );
    }

    return Result.ok(new SchemaDirectiveProcessor(fileSystem));
  }

  /**
   * Loads raw schema data from file path.
   * Returns the parsed schema object for directive processing.
   */
  async loadSchemaData(
    schemaPath: string,
  ): Promise<Result<Record<string, unknown>, ProcessingError>> {
    if (!schemaPath || typeof schemaPath !== "string") {
      return Result.error(
        new ProcessingError(
          "Schema path must be a non-empty string",
          "INVALID_SCHEMA_PATH",
          { schemaPath },
        ),
      );
    }

    try {
      const contentResult = await this.fileSystem.readTextFile(schemaPath);
      if (contentResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Failed to read schema file: ${
              createFileError(contentResult.unwrapError()).message
            }`,
            "SCHEMA_READ_ERROR",
            { schemaPath, error: contentResult.unwrapError() },
          ),
        );
      }

      const schemaData = JSON.parse(contentResult.unwrap());
      return Result.ok(schemaData);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to parse schema: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "SCHEMA_PARSE_ERROR",
          { schemaPath, error },
        ),
      );
    }
  }

  /**
   * Applies schema directives to process and transform data.
   * Specifically handles x-derived-from and x-derived-unique directives.
   */
  applySchemaDirectives(
    data: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): Result<Record<string, unknown>, ProcessingError> {
    if (!data || typeof data !== "object") {
      return Result.error(
        new ProcessingError(
          "Data must be a valid object for directive processing",
          "INVALID_DATA_TYPE",
          { dataType: typeof data },
        ),
      );
    }

    if (!schema || typeof schema !== "object") {
      return Result.error(
        new ProcessingError(
          "Schema must be a valid object for directive processing",
          "INVALID_SCHEMA_TYPE",
          { schemaType: typeof schema },
        ),
      );
    }

    try {
      let result = { ...data };

      // Process schema properties to find directives
      if (schema.properties) {
        const processResult = this.processSchemaProperties(
          result,
          schema.properties as Record<string, unknown>,
          [],
        );
        if (processResult.isError()) {
          return Result.error(processResult.unwrapError());
        }
        result = processResult.unwrap();
      }

      // Apply schema defaults (temporary until schema default processing is implemented)
      const defaultsResult = this.applySchemaDefaults(result, schema);
      if (defaultsResult.isError()) {
        return Result.error(defaultsResult.unwrapError());
      }

      return Result.ok(defaultsResult.unwrap());
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to apply schema directives: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "DIRECTIVE_APPLICATION_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Recursively processes schema properties to find and apply directives.
   */
  private processSchemaProperties(
    data: Record<string, unknown>,
    properties: Record<string, unknown>,
    currentPath: string[],
  ): Result<Record<string, unknown>, ProcessingError> {
    try {
      let result = { ...data };

      for (const [key, propSchema] of Object.entries(properties)) {
        if (!propSchema || typeof propSchema !== "object") {
          continue;
        }

        const schema = propSchema as Record<string, unknown>;
        const path = [...currentPath, key];

        // Check for x-derived-from directive
        if (schema[DIRECTIVE_NAMES.DERIVED_FROM]) {
          const derivationResult = this.applyDerivedFromDirective(
            result,
            schema,
            path,
          );
          if (derivationResult.isError()) {
            return Result.error(derivationResult.unwrapError());
          }
          result = derivationResult.unwrap();
        }

        // Check for x-flatten-arrays directive
        if (schema[DIRECTIVE_NAMES.FLATTEN_ARRAYS]) {
          const flattenResult = this.applyFlattenArraysDirective(
            result,
            schema,
            path,
          );
          if (flattenResult.isError()) {
            return Result.error(flattenResult.unwrapError());
          }
          result = flattenResult.unwrap();
        }

        // Note: x-jmespath-filter moved to Phase1DirectiveProcessor (per requirements.ja.md line 376)

        // Recursively process nested properties
        if (schema.properties) {
          const nestedResult = this.processSchemaProperties(
            result,
            schema.properties as Record<string, unknown>,
            path,
          );
          if (nestedResult.isError()) {
            return Result.error(nestedResult.unwrapError());
          }
          result = nestedResult.unwrap();
        }
      }

      return Result.ok(result);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to process schema properties: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "PROPERTY_PROCESSING_ERROR",
          { currentPath, error },
        ),
      );
    }
  }

  /**
   * Applies x-derived-from directive with optional x-derived-unique.
   */
  private applyDerivedFromDirective(
    data: Record<string, unknown>,
    schema: Record<string, unknown>,
    path: string[],
  ): Result<Record<string, unknown>, ProcessingError> {
    const derivedFrom = schema[DIRECTIVE_NAMES.DERIVED_FROM] as string;

    // Use DataPathResolver for path resolution with array expansion support
    const resolver = new DataPathResolver(data);
    const resolveResult = resolver.resolveAsArray<unknown>(derivedFrom);

    if (resolveResult.isError()) {
      const pathError = resolveResult.unwrapError();
      return Result.error(
        new ProcessingError(
          `Failed to resolve x-derived-from path "${derivedFrom}": ${pathError.message}`,
          "DERIVED_FROM_RESOLUTION_ERROR",
          { derivedFrom, error: pathError },
        ),
      );
    }

    // Filter out null/undefined and convert resolved values to strings
    const derivedValues = resolveResult.unwrap()
      .filter((v) => v !== null && v !== undefined)
      .map((v) => String(v));

    // Apply x-derived-unique if specified
    const finalValues = schema[DIRECTIVE_NAMES.DERIVED_UNIQUE]
      ? Array.from(new Set(derivedValues))
      : derivedValues;

    try {
      // Set the derived values
      const result = { ...data };
      this.setNestedValue(result, path, finalValues.sort());

      return Result.ok(result);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to apply derived-from directive: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "DERIVED_FROM_ERROR",
          { path, schema, error },
        ),
      );
    }
  }

  /**
   * Applies x-flatten-arrays directive.
   */
  private applyFlattenArraysDirective(
    data: Record<string, unknown>,
    schema: Record<string, unknown>,
    path: string[],
  ): Result<Record<string, unknown>, ProcessingError> {
    try {
      const directiveValue = schema[DIRECTIVE_NAMES.FLATTEN_ARRAYS];
      const directiveResult = FlattenArraysDirective.create(directiveValue);

      if (directiveResult.isError()) {
        return Result.error(
          new ProcessingError(
            `Failed to create flatten-arrays directive: ${directiveResult.unwrapError().message}`,
            "FLATTEN_ARRAYS_ERROR",
            { path, schema, error: directiveResult.unwrapError() },
          ),
        );
      }

      const directive = directiveResult.unwrap();

      // Apply the directive to the entire data object
      const transformedData = directive.apply(data);

      return Result.ok(transformedData);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to apply flatten-arrays directive: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "FLATTEN_ARRAYS_ERROR",
          { path, schema, error },
        ),
      );
    }
  }

  /**
   * Applies schema default values.
   * Processes ALL properties with default values, eliminating hardcoding violations.
   */
  private applySchemaDefaults(
    data: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): Result<Record<string, unknown>, ProcessingError> {
    try {
      const result = { ...data };
      const properties = schema.properties as Record<string, unknown>;

      if (!properties) {
        return Result.ok(result);
      }

      // Process ALL schema properties with default values generically
      for (const [propertyName, propertySchema] of Object.entries(properties)) {
        const propDef = propertySchema as Record<string, unknown>;

        // Apply default value if property doesn't exist and default is defined
        if (!result[propertyName] && propDef?.default !== undefined) {
          result[propertyName] = propDef.default;
        }
      }

      return Result.ok(result);
    } catch (error) {
      return Result.error(
        new ProcessingError(
          `Failed to apply schema defaults: ${
            error instanceof Error ? error.message : String(error)
          }`,
          "SCHEMA_DEFAULTS_ERROR",
          { error },
        ),
      );
    }
  }

  /**
   * Sets a nested value in an object using an array of path segments.
   */
  private setNestedValue(
    obj: Record<string, unknown>,
    path: string[],
    value: unknown,
  ): void {
    let current = obj;

    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i];
      if (!(segment in current) || typeof current[segment] !== "object") {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }

    current[path[path.length - 1]] = value;
  }
}
