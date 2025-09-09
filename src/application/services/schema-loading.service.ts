/**
 * Schema Loading Service
 * Extracted from process-documents-usecase.ts for better domain separation
 * Handles schema loading and resolution following DDD principles
 */

import type { Result } from "../../domain/core/result.ts";
import { SchemaRefResolver } from "../../domain/config/schema-ref-resolver.ts";
import type { FileSystemRepository } from "../../domain/repositories/file-system-repository.ts";
import type { SchemaTemplateInfo } from "../../domain/models/schema-extensions.ts";
import * as path from "jsr:@std/path@1.0.9";

/**
 * Schema Loading Service - Handles schema loading and $ref resolution
 */
export class SchemaLoadingService {
  constructor(
    private readonly fileSystem: FileSystemRepository,
  ) {}

  /**
   * Load and resolve schema with $ref resolution
   */
  async loadAndResolveSchema(
    schemaPath: string,
  ): Promise<
    Result<{
      schema: unknown;
      templateInfo: SchemaTemplateInfo;
    }, { kind: string; message: string }>
  > {
    try {
      // Read schema file using injected file system
      const readResult = await this.fileSystem.readFile(schemaPath);
      if (!readResult.ok) {
        return {
          ok: false,
          error: {
            kind: "FileNotFound",
            message: `Schema file not found: ${schemaPath}`,
          },
        };
      }
      const rawSchema = JSON.parse(readResult.data);

      // Set base path for $ref resolution
      const basePath = path.dirname(schemaPath);
      const resolver = new SchemaRefResolver(this.fileSystem, basePath);

      // Resolve and extract template info
      const result = await resolver.resolveAndExtractTemplateInfo(rawSchema);
      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        data: {
          schema: result.data.resolved,
          templateInfo: result.data.templateInfo,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "SchemaParseError",
          message: error instanceof Error
            ? `Failed to parse schema: ${error.message}`
            : "Failed to parse schema: Unknown error",
        },
      };
    }
  }
}
