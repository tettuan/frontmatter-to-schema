/**
 * Load Schema Use Case
 *
 * Responsible for loading and resolving schema with $ref resolution
 * Part of the Schema Management Context in DDD
 * Follows Totality principles with Result types
 */

import type { UseCase } from "../base.usecase.ts";
import type { DomainError, Result } from "../../../domain/core/result.ts";
import { createDomainError } from "../../../domain/core/result.ts";
import { SchemaRefResolver } from "../../../domain/config/schema-ref-resolver.ts";
import type { FileSystemRepository } from "../../../domain/repositories/file-system-repository.ts";
import type { SchemaTemplateInfo } from "../../../domain/models/schema-extensions.ts";
import * as path from "jsr:@std/path@1.0.9";

/**
 * Input parameters for loading schema
 */
export interface LoadSchemaInput {
  schemaPath: string;
  basePath?: string;
}

/**
 * Output from schema loading
 */
export interface LoadSchemaOutput {
  schema: unknown;
  templateInfo: SchemaTemplateInfo;
  resolved: boolean;
}

/**
 * Load Schema Use Case Implementation
 * Handles schema loading with $ref resolution
 */
export class LoadSchemaUseCase
  implements UseCase<LoadSchemaInput, LoadSchemaOutput> {
  private readonly resolver: SchemaRefResolver;

  constructor(
    private readonly fileSystem: FileSystemRepository,
  ) {
    this.resolver = new SchemaRefResolver(fileSystem, ".");
  }

  async execute(
    input: LoadSchemaInput,
  ): Promise<Result<LoadSchemaOutput, DomainError & { message: string }>> {
    try {
      // Read schema file
      const readResult = await this.fileSystem.readFile(input.schemaPath);
      if (!readResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            { kind: "FileNotFound", path: input.schemaPath },
            `Schema file not found: ${input.schemaPath}`,
          ),
        };
      }

      // Parse JSON
      let rawSchema: unknown;
      try {
        rawSchema = JSON.parse(readResult.data);
      } catch (error) {
        return {
          ok: false,
          error: createDomainError(
            { kind: "ParseError", input: readResult.data },
            `Invalid JSON in schema file: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        };
      }

      // Set base path and resolve
      const basePath = input.basePath || path.dirname(input.schemaPath);
      const resolver = new SchemaRefResolver(this.fileSystem, basePath);

      const result = await resolver.resolveAndExtractTemplateInfo(rawSchema);
      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        data: {
          schema: result.data.resolved,
          templateInfo: result.data.templateInfo,
          resolved: true,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "LoadSchema",
            error: {
              kind: "InvalidResponse",
              service: "schema-loader",
              response: error instanceof Error ? error.message : String(error),
            },
          },
          `Failed to load schema: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }
}
