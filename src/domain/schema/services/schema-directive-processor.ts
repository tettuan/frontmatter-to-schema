import { Result } from "../../shared/types/result.ts";
import { ProcessingError } from "../../shared/types/errors.ts";
import { FileSystemPort } from "../../../infrastructure/ports/file-system-port.ts";
import { createFileError } from "../../shared/types/file-errors.ts";

/**
 * Domain service for processing schema directives and transformations.
 * Handles x-derived-from, x-derived-unique, and other schema extensions.
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
        if (schema["x-derived-from"]) {
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
    try {
      const derivedFrom = schema["x-derived-from"] as string;
      const derivedValues = this.extractValuesFromPath(data, derivedFrom);

      // Apply x-derived-unique if specified
      const finalValues = schema["x-derived-unique"]
        ? Array.from(new Set(derivedValues))
        : derivedValues;

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
   * Applies schema default values.
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

      // Apply version default
      const versionProp = properties.version as
        | Record<string, unknown>
        | undefined;
      if (!result.version && versionProp?.default) {
        result.version = versionProp.default;
      }

      // Apply description default
      const descriptionProp = properties.description as
        | Record<string, unknown>
        | undefined;
      if (!result.description && descriptionProp?.default) {
        result.description = descriptionProp.default;
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
   * Extracts values from a path expression like "commands[].c1" or "tools.commands[].c1".
   */
  private extractValuesFromPath(
    data: Record<string, unknown>,
    path: string,
  ): string[] {
    const values: string[] = [];

    // Handle nested array notation like "tools.commands[].c1"
    const nestedMatch = path.match(/^(.+?)\[\]\.(.+)$/);
    if (nestedMatch) {
      const [, basePath, propertyPath] = nestedMatch;

      // Navigate to the array
      let array: unknown;
      if (basePath.includes(".")) {
        // Handle nested path like "tools.commands"
        array = this.getNestedValue(data, basePath);
      } else {
        // Simple field name
        array = data[basePath];
      }

      // If array not found at specified path, try looking in items
      if (!array && data.items) {
        array = data.items;
      }

      if (Array.isArray(array)) {
        for (const item of array) {
          if (item && typeof item === "object") {
            const value = this.getNestedValue(
              item as Record<string, unknown>,
              propertyPath,
            );
            if (value !== undefined && value !== null) {
              values.push(String(value));
            }
          }
        }
      }
    }

    return values;
  }

  /**
   * Gets a nested value from an object using dot notation.
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const segments = path.split(".");
    let current: unknown = obj;

    for (const segment of segments) {
      if (current && typeof current === "object") {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }

    return current;
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
