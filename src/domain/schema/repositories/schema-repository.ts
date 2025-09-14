import { Result } from "../../shared/types/result.ts";
import { SchemaError } from "../../shared/types/errors.ts";
import { SchemaPath } from "../value-objects/schema-path.ts";
import { Schema } from "../entities/schema.ts";

export interface SchemaRepository {
  load(path: SchemaPath): Result<Schema, SchemaError & { message: string }>;
  resolve(schema: Schema): Result<Schema, SchemaError & { message: string }>;
}
