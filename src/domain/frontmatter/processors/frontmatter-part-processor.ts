import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../value-objects/frontmatter-data.ts";
import { Schema } from "../../schema/entities/schema.ts";
import { FrontmatterDataCreationService } from "../services/frontmatter-data-creation-service.ts";
import { DebugLogger } from "../../shared/services/debug-logger.ts";

/**
 * Frontmatter Part Processor (Legacy Compatibility)
 *
 * This maintains compatibility while transitioning to 3-domain architecture.
 */
export interface FrontmatterPartProcessorConfig {
  readonly frontmatterDataCreationService: FrontmatterDataCreationService;
  readonly debugLogger?: DebugLogger;
}

export class FrontmatterPartProcessor {
  constructor(
    private readonly config: FrontmatterPartProcessorConfig,
  ) {}

  static create(
    config: FrontmatterPartProcessorConfig,
  ): Result<FrontmatterPartProcessor, DomainError & { message: string }> {
    if (!config.frontmatterDataCreationService) {
      return err(createError({
        kind: "ConfigurationError",
        message: "FrontmatterDataCreationService is required",
      }));
    }

    return ok(new FrontmatterPartProcessor(config));
  }

  /**
   * Process frontmatter parts according to x-frontmatter-part directive
   */
  processFrontmatterParts(
    data: FrontmatterData[],
    schema: Schema,
  ): Result<FrontmatterData[], DomainError & { message: string }> {
    try {
      // Check if schema has x-frontmatter-part
      const frontmatterPartSchemaResult = schema.findFrontmatterPartSchema();

      if (!frontmatterPartSchemaResult.ok) {
        // No x-frontmatter-part found, return data as-is
        return ok(data);
      }

      // For now, return data as-is (basic implementation)
      // In the new 3-domain architecture, this is handled by DataProcessingInstructionDomainService
      return ok(data);
    } catch (error) {
      return err(createError(
        {
          kind: "EXCEPTION_CAUGHT",
          originalError: error,
        },
        `Frontmatter part processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ));
    }
  }
}
