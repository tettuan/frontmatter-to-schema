/**
 * @fileoverview Frontmatter Part Directive Handler
 * @description Handles x-frontmatter-part directive processing following DDD and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../entities/schema.ts";
import { defaultSchemaExtensionRegistry } from "../value-objects/schema-extension-registry.ts";
import {
  BaseDirectiveHandler,
  DirectiveConfig,
  DirectiveHandlerError,
  DirectiveHandlerFactory,
  DirectiveProcessingResult,
  ExtensionExtractionResult,
  LegacySchemaProperty,
} from "../interfaces/directive-handler.ts";

/**
 * Frontmatter Part directive configuration
 */
interface FrontmatterPartConfig {
  readonly isFrontmatterPart: boolean;
}

/**
 * Frontmatter Part directive processing metadata
 */
interface FrontmatterPartMetadata {
  readonly markedAsFrontmatterPart: boolean;
}

/**
 * Frontmatter Part Directive Handler
 *
 * Processes x-frontmatter-part directives that mark schema properties as frontmatter parts.
 * This is a structural directive that influences how data is organized and processed.
 * Following DDD and Totality principles:
 * - Smart Constructor pattern
 * - Result<T,E> for all operations
 * - No exceptions or undefined behavior
 */
export class FrontmatterPartDirectiveHandler
  extends BaseDirectiveHandler<FrontmatterPartConfig, FrontmatterPartMetadata> {
  private constructor() {
    super("frontmatter-part", 1, []); // Priority 1: Data Structure Foundation
  }

  /**
   * Smart Constructor following Totality principles
   */
  static create(): Result<
    FrontmatterPartDirectiveHandler,
    DomainError & { message: string }
  > {
    return ok(new FrontmatterPartDirectiveHandler());
  }

  /**
   * Extract configuration from legacy schema property
   */
  extractConfig(
    schema: LegacySchemaProperty,
  ): Result<DirectiveConfig<FrontmatterPartConfig>, DirectiveHandlerError> {
    let isFrontmatterPart: boolean | undefined;

    // Check extensions object first (legacy format)
    if (schema.extensions && typeof schema.extensions === "object") {
      const extensions = schema.extensions as Record<string, unknown>;
      if (extensions["x-frontmatter-part"] !== undefined) {
        if (typeof extensions["x-frontmatter-part"] === "boolean") {
          isFrontmatterPart = extensions["x-frontmatter-part"];
        } else {
          return err({
            kind: "ValidationError",
            directiveName: this.directiveName,
            message:
              `Invalid frontmatter-part: expected boolean but got ${typeof extensions[
                "x-frontmatter-part"
              ]}`,
            invalidValue: extensions["x-frontmatter-part"],
          });
        }
      }
    }

    // Check direct property (standard JSON Schema extension pattern)
    // Takes precedence over extensions object
    if (schema["x-frontmatter-part"] !== undefined) {
      if (typeof schema["x-frontmatter-part"] === "boolean") {
        isFrontmatterPart = schema["x-frontmatter-part"];
      } else {
        return err({
          kind: "ValidationError",
          directiveName: this.directiveName,
          message:
            `Invalid frontmatter-part: expected boolean but got ${typeof schema[
              "x-frontmatter-part"
            ]}`,
          invalidValue: schema["x-frontmatter-part"],
        });
      }
    }

    if (isFrontmatterPart === undefined) {
      return DirectiveHandlerFactory.createConfig(
        this.directiveName,
        { isFrontmatterPart: false },
        false,
      );
    }

    return DirectiveHandlerFactory.createConfig(
      this.directiveName,
      { isFrontmatterPart },
      true,
    );
  }

  /**
   * Process data according to frontmatter-part directive configuration
   *
   * Note: The frontmatter-part directive is primarily structural and affects
   * how data is organized. The actual processing logic for data structure
   * building is handled by other services (like SchemaPathResolver).
   * This handler mainly marks the presence of the directive.
   */
  processData(
    data: FrontmatterData,
    config: DirectiveConfig<FrontmatterPartConfig>,
    _schema: Schema,
  ): Result<
    DirectiveProcessingResult<FrontmatterPartMetadata>,
    DirectiveHandlerError
  > {
    if (!config.isPresent || !config.configuration.isFrontmatterPart) {
      return ok({
        kind: "DirectiveProcessingResult",
        directiveName: this.directiveName,
        processedData: data,
        metadata: {
          markedAsFrontmatterPart: false,
        },
      });
    }

    // For frontmatter-part directive, the actual data processing is handled
    // by other services that understand the structural implications.
    // This handler's job is to mark the presence and validate the directive.

    return ok({
      kind: "DirectiveProcessingResult",
      directiveName: this.directiveName,
      processedData: data,
      metadata: {
        markedAsFrontmatterPart: true,
      },
    });
  }

  /**
   * Extract extension key-value pair for schema building
   * Following Totality principles with discriminated union result
   */
  extractExtension(
    schema: LegacySchemaProperty,
  ): Result<ExtensionExtractionResult, DirectiveHandlerError> {
    const configResult = this.extractConfig(schema);
    if (!configResult.ok) {
      return configResult;
    }

    const config = configResult.data;
    if (!config.isPresent) {
      return ok({
        kind: "ExtensionNotApplicable",
        reason: "No x-frontmatter-part directive found in schema",
      });
    }

    const registry = defaultSchemaExtensionRegistry;
    const key = registry.getFrontmatterPartKey().getValue();

    return ok({
      kind: "ExtensionFound",
      key,
      value: config.configuration.isFrontmatterPart,
    });
  }
}
