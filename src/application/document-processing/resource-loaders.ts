/**
 * Resource Loaders - Schema and Template Loading Services
 * Following DDD principles and domain boundary separation
 * Part of Application Layer - Document Processing Context
 */

import {
  createProcessingStageError,
  type DomainError,
  type Result,
} from "../../domain/core/result.ts";
import { Schema, SchemaId } from "../../domain/models/entities.ts";
import {
  SchemaDefinition,
  SchemaVersion,
} from "../../domain/models/value-objects.ts";
import {
  Template,
  TemplateDefinition,
} from "../../domain/models/domain-models.ts";
import { VERSION_CONFIG } from "../../config/version.ts";
import type { SchemaFormat, TemplateFormat } from "../configuration.ts";

/**
 * Schema loading service following Schema Context boundaries
 */
export class SchemaLoader {
  /**
   * Load and validate schema from configuration
   * Follows Smart Constructor pattern with Result types
   */
  loadSchema(config: {
    definition: unknown;
    format: SchemaFormat;
  }): Result<Schema, DomainError> {
    const definitionResult = SchemaDefinition.create(
      config.definition,
      config.format.getValue(),
    );
    if (!definitionResult.ok) {
      // Convert ValidationError to DomainError
      return {
        ok: false,
        error: createProcessingStageError(
          "schema definition",
          definitionResult.error,
        ),
      };
    }

    const schemaIdResult = SchemaId.create("main-schema");
    if (!schemaIdResult.ok) {
      return {
        ok: false,
        error: createProcessingStageError(
          "schema ID creation",
          schemaIdResult.error,
        ),
      };
    }

    const schemaVersionResult = SchemaVersion.create(
      VERSION_CONFIG.DEFAULT_SCHEMA_VERSION,
    );
    if (!schemaVersionResult.ok) {
      return {
        ok: false,
        error: createProcessingStageError(
          "schema version creation",
          schemaVersionResult.error,
        ),
      };
    }

    const schemaResult = Schema.create(
      schemaIdResult.data,
      definitionResult.data,
      schemaVersionResult.data,
      "Main processing schema",
    );

    if (!schemaResult.ok) {
      return {
        ok: false,
        error: schemaResult.error,
      };
    }

    return { ok: true, data: schemaResult.data };
  }
}

/**
 * Template loading service following Template Context boundaries
 */
export class TemplateLoader {
  /**
   * Load and validate template from configuration
   * Follows Smart Constructor pattern with Result types
   */
  loadTemplate(config: {
    definition: string;
    format: TemplateFormat;
  }): Result<Template, DomainError> {
    const definitionResult = TemplateDefinition.create(
      config.definition,
      config.format.getValue(),
    );
    if (!definitionResult.ok) {
      return definitionResult;
    }

    const templateResult = Template.create(
      "main-template",
      definitionResult.data,
      "Main processing template",
    );
    if (!templateResult.ok) {
      return templateResult;
    }

    return { ok: true, data: templateResult.data };
  }
}

/**
 * Unified resource loader providing both schema and template loading
 * Facade pattern for convenient access to both loaders
 */
export class ResourceLoaders {
  private readonly schemaLoader: SchemaLoader;
  private readonly templateLoader: TemplateLoader;

  constructor() {
    this.schemaLoader = new SchemaLoader();
    this.templateLoader = new TemplateLoader();
  }

  /**
   * Load schema using Schema Context operations
   */
  loadSchema(config: {
    definition: unknown;
    format: SchemaFormat;
  }): Result<Schema, DomainError> {
    return this.schemaLoader.loadSchema(config);
  }

  /**
   * Load template using Template Context operations
   */
  loadTemplate(config: {
    definition: string;
    format: TemplateFormat;
  }): Result<Template, DomainError> {
    return this.templateLoader.loadTemplate(config);
  }
}
