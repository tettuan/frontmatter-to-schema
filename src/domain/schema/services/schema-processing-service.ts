import { ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { Schema } from "../entities/schema.ts";
import { SchemaPath } from "../value-objects/schema-path.ts";
import { SchemaRepository } from "../repositories/schema-repository.ts";
import { ValidationRules } from "../value-objects/validation-rules.ts";
import { BasePropertyPopulator } from "./base-property-populator.ts";

export interface ProcessedSchema {
  readonly schema: Schema;
  readonly validationRules: ValidationRules;
  readonly templatePath: string | null;
}

/**
 * Domain service responsible for Schema processing stage of the 3-stage pipeline.
 * Handles: SchemaDefinition → ValidationRules + BaseProperties extraction
 */
export class SchemaProcessingService {
  constructor(
    private readonly schemaRepository: SchemaRepository,
    private readonly basePropertyPopulator: BasePropertyPopulator,
  ) {}

  /**
   * Load and process schema to extract validation rules and metadata.
   * Follows Totality principle - all paths return Result types.
   */
  processSchema(
    schemaPath: string,
  ): Result<ProcessedSchema, DomainError & { message: string }> {
    // Stage 1: Create and validate schema path
    const schemaPathResult = SchemaPath.create(schemaPath);
    if (!schemaPathResult.ok) {
      return schemaPathResult;
    }

    // Stage 2: Load schema from repository
    const schemaResult = this.schemaRepository.load(schemaPathResult.data);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    // Stage 3: Resolve schema references
    const resolvedSchemaResult = this.schemaRepository.resolve(
      schemaResult.data,
    );
    if (!resolvedSchemaResult.ok) {
      return resolvedSchemaResult;
    }

    const schema = resolvedSchemaResult.data;

    // Stage 4: Extract validation rules
    const validationRules = schema.getValidationRules();

    // Stage 5: Extract template path (convert Result to null for consistency)
    const templatePathResult = schema.getTemplatePath();
    const templatePath = templatePathResult.ok ? templatePathResult.data : null;

    return ok({
      schema,
      validationRules,
      templatePath,
    });
  }

  /**
   * Extract template path and resolve relative paths.
   * Returns Result with resolved path or error if no template specified.
   */
  resolveTemplatePath(
    schema: Schema,
    schemaPath: string,
  ): Result<string, DomainError & { message: string }> {
    const templatePathResult = schema.getTemplatePath();
    if (!templatePathResult.ok) {
      return templatePathResult;
    }
    const templatePath = templatePathResult.data;

    // Resolve relative template paths
    if (templatePath.startsWith("./")) {
      const schemaDir = schemaPath.substring(0, schemaPath.lastIndexOf("/"));
      const resolvedPath = schemaDir
        ? `${schemaDir}/${templatePath.substring(2)}`
        : templatePath.substring(2);
      return ok(resolvedPath);
    }

    return ok(templatePath);
  }
}
