import { err, ok, Result } from "../../domain/shared/types/result.ts";
import { createError, SchemaError } from "../../domain/shared/types/errors.ts";
import {
  Schema,
  SchemaDefinition,
  SchemaPath,
  SchemaRepository,
} from "../../domain/schema/index.ts";
import { DenoFileReader } from "../file-system/file-reader.ts";

export class FileSystemSchemaRepository implements SchemaRepository {
  private readonly fileReader = new DenoFileReader();
  private readonly schemaCache = new Map<string, Schema>();

  load(path: SchemaPath): Result<Schema, SchemaError & { message: string }> {
    const pathStr = path.toString();

    if (this.schemaCache.has(pathStr)) {
      return ok(this.schemaCache.get(pathStr)!);
    }

    const contentResult = this.fileReader.read(pathStr);
    if (!contentResult.ok) {
      return err(createError({
        kind: "SchemaNotFound",
        path: pathStr,
      }));
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(contentResult.data);
    } catch (error) {
      return err(createError({
        kind: "InvalidSchema",
        message: `Failed to parse JSON: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }

    const definitionResult = SchemaDefinition.create(parsed);
    if (!definitionResult.ok) {
      return err(definitionResult.error);
    }

    const schemaResult = Schema.create(path, definitionResult.data);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    this.schemaCache.set(pathStr, schemaResult.data);
    return schemaResult;
  }

  resolve(schema: Schema): Result<Schema, SchemaError & { message: string }> {
    if (schema.isResolved()) {
      return ok(schema);
    }

    return ok(schema);
  }
}
