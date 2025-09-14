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

export class FileSystemSchemaRepository implements SchemaRepository {
  private readonly fileReader = new DenoFileReader();
  private readonly schemaCache = new Map<string, Schema>();

  constructor(private readonly debugLogger?: DebugLogger) {}

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
      return ok(this.schemaCache.get(pathStr)!);
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

    this.schemaCache.set(pathStr, schemaResult.data);
    this.debugLogger?.logInfo(
      "schema-loading",
      `Successfully loaded and cached schema: ${pathStr}`,
    );
    return schemaResult;
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

    return ok(schema);
  }
}
