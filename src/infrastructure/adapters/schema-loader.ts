import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, SchemaError } from "../../domain/shared/types/errors.ts";
import {
  Schema,
  SchemaDefinition,
  SchemaPath,
  SchemaRepository,
} from "../../domain/schema/index.ts";
import { DenoFileReader } from "../file-system/file-reader.ts";
import { DebugLogger } from "./debug-logger.ts";
import { dirname, isAbsolute, join } from "@std/path";
import { RefResolver } from "../../domain/schema/services/ref-resolver.ts";

export interface FileReader {
  read(path: string): Result<string, { message: string }>;
}

export class FileSystemSchemaRepository implements SchemaRepository {
  private readonly schemaCache = new Map<string, Schema>();

  constructor(
    private readonly fileReader: FileReader = new DenoFileReader(),
    private readonly debugLogger?: DebugLogger,
  ) {}

  load(path: SchemaPath): Result<Schema, SchemaError & { message: string }> {
    const pathStr = path.toString();
    this.debugLogger?.logInfo(
      "schema-loading",
      `Loading schema from: ${pathStr}`,
    );

    if (this.schemaCache.has(pathStr)) {
      this.debugLogger?.logDebug(
        "schema-cache",
        `Schema cache hit for: ${pathStr}`,
      );
      const cachedSchema = this.schemaCache.get(pathStr);
      if (cachedSchema) {
        return ok(cachedSchema);
      }
      // Handle theoretical race condition where cache entry was removed between has() and get()
      this.debugLogger?.logDebug(
        "schema-cache",
        `Schema cache entry unexpectedly missing for: ${pathStr}`,
      );
    }

    this.debugLogger?.logDebug(
      "schema-cache",
      `Schema cache miss for: ${pathStr}`,
    );

    const contentResult = this.fileReader.read(pathStr);
    if (!contentResult.ok) {
      this.debugLogger?.logError(
        "schema-loading",
        createError({
          kind: "SchemaNotFound",
          path: pathStr,
        }),
        { path: pathStr },
      );
      return err(createError({
        kind: "SchemaNotFound",
        path: pathStr,
      }));
    }

    this.debugLogger?.logDebug(
      "schema-parsing",
      `Parsing JSON content for: ${pathStr}`,
    );
    const parseResult = this.safeJsonParse(contentResult.data);
    if (!parseResult.ok) {
      const parseError = createError({
        kind: "InvalidSchema",
        message: `Failed to parse JSON: ${parseResult.error.message}`,
      });
      this.debugLogger?.logError("schema-parsing", parseError, {
        path: pathStr,
      });
      return err(parseError);
    }

    const parsed = parseResult.data;

    this.debugLogger?.logDebug(
      "schema-definition",
      `Creating schema definition for: ${pathStr}`,
    );
    const definitionResult = SchemaDefinition.create(parsed);
    if (!definitionResult.ok) {
      this.debugLogger?.logError("schema-definition", definitionResult.error, {
        path: pathStr,
      });
      return err(definitionResult.error);
    }

    const schemaResult = Schema.create(
      path,
      definitionResult.data,
      this.debugLogger,
    );
    if (!schemaResult.ok) {
      return schemaResult;
    }

    // Resolve references in the loaded schema
    const resolvedResult = this.resolve(schemaResult.data);
    if (!resolvedResult.ok) {
      return resolvedResult;
    }

    this.schemaCache.set(pathStr, resolvedResult.data);
    this.debugLogger?.logInfo(
      "schema-loading",
      `Successfully loaded, resolved, and cached schema: ${pathStr}`,
    );
    return resolvedResult;
  }

  /**
   * Load schema with path resolution support for relative references
   * @param path Schema path (can be relative or absolute)
   * @param basePath Optional base path for resolving relative paths
   */
  loadWithContext(
    path: SchemaPath | string,
    basePath?: string,
  ): Result<Schema, SchemaError & { message: string }> {
    const pathStr = path.toString();

    // Resolve relative paths against base path
    let resolvedPath: string;
    if (basePath && !isAbsolute(pathStr)) {
      resolvedPath = join(dirname(basePath), pathStr);
      this.debugLogger?.logDebug(
        "schema-path-resolution",
        `Resolving relative path "${pathStr}" against base "${basePath}" → "${resolvedPath}"`,
      );
    } else {
      resolvedPath = pathStr;
      this.debugLogger?.logDebug(
        "schema-path-resolution",
        `Using absolute path: "${resolvedPath}"`,
      );
    }

    // Create SchemaPath from resolved path and use existing load method
    const schemaPathResult = SchemaPath.create(resolvedPath);
    if (!schemaPathResult.ok) {
      return err(createError({
        kind: "InvalidSchema",
        message: `Invalid resolved path: ${resolvedPath}`,
      }));
    }
    return this.load(schemaPathResult.data);
  }

  private safeJsonParse(content: string): Result<unknown, { message: string }> {
    try {
      return ok(JSON.parse(content));
    } catch (error) {
      return err({
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  resolve(schema: Schema): Result<Schema, SchemaError & { message: string }> {
    if (schema.isResolved()) {
      return ok(schema);
    }

    // Use RefResolver for schema reference resolution

    // Create a SchemaLoader adapter for this repository
    const schemaLoader = {
      load: (ref: string) => this.loadSchemaAsProperty(ref),
      loadWithContext: (ref: string, basePath?: string) =>
        this.loadSchemaAsPropertyWithContext(ref, basePath),
    };

    const refResolverResult = RefResolver.create(schemaLoader);
    if (!refResolverResult.ok) {
      return refResolverResult;
    }

    const definition = schema.getDefinition();
    const schemaPath = schema.getPath().toString();
    const resolvedResult = refResolverResult.data.resolve(
      definition,
      schemaPath,
    );
    if (!resolvedResult.ok) {
      return resolvedResult;
    }

    return ok(schema.withResolved(resolvedResult.data));
  }

  /**
   * Load schema and convert to SchemaProperty format for RefResolver
   */
  private loadSchemaAsProperty(
    ref: string,
  ): Result<any, SchemaError & { message: string }> {
    const schemaPathResult = SchemaPath.create(ref);
    if (!schemaPathResult.ok) {
      return err(createError({
        kind: "InvalidSchema",
        message: `Invalid schema reference path: ${ref}`,
      }));
    }

    const schemaResult = this.load(schemaPathResult.data);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    const definition = schemaResult.data.getDefinition();
    return ok(definition.getRawSchema());
  }

  /**
   * Load schema with context and convert to SchemaProperty format for RefResolver
   */
  private loadSchemaAsPropertyWithContext(
    ref: string,
    basePath?: string,
  ): Result<any, SchemaError & { message: string }> {
    const schemaResult = this.loadWithContext(ref, basePath);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    const definition = schemaResult.data.getDefinition();
    return ok(definition.getRawSchema());
  }
}
