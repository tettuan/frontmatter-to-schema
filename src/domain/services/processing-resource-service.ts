/**
 * Process Document Resource Service
 *
 * Handles document, schema, and template resource loading coordination following SRP.
 * Extracted from ProcessDocumentsUseCase to reduce AI complexity.
 * Applies Totality principle with Result types and discriminated unions.
 */

import {
  createDomainError,
  type DomainError,
  isError,
  type Result,
} from "../core/result.ts";
import type { Document, Schema, Template } from "../models/entities.ts";
import type { ProcessingConfiguration } from "./interfaces.ts";
import type {
  DocumentRepository,
  SchemaRepository,
  TemplateRepository,
} from "./interfaces.ts";
import { StructuredLogger } from "../shared/logger.ts";

/**
 * Loaded resources result type following totality principle
 */
export interface LoadedResources {
  documents: Document[];
  schema: Schema;
  template: Template;
}

/**
 * Service responsible for coordinating resource loading operations
 * Following AI Complexity Control Framework - single focused responsibility
 */
export class ProcessDocumentResourceService {
  private static readonly SERVICE_NAME = "processing-resource-service";

  constructor(
    private readonly documentRepo: DocumentRepository,
    private readonly schemaRepo: SchemaRepository,
    private readonly templateRepo: TemplateRepository,
  ) {}

  /**
   * Load all required resources for document processing
   * Extracted from ProcessDocumentsUseCase.execute() lines 75-200
   */
  async loadResources(
    config: ProcessingConfiguration,
  ): Promise<Result<LoadedResources, DomainError & { message: string }>> {
    const logger = StructuredLogger.getServiceLogger(
      ProcessDocumentResourceService.SERVICE_NAME,
    );
    logger.info("Loading processing resources", {
      schema: config.schemaPath.getValue(),
      template: config.templatePath.getValue(),
      documents: config.documentsPath.getValue(),
    });

    // Load schema with enhanced error handling
    const schemaResult = await this.loadSchema(config);
    if (isError(schemaResult)) {
      return schemaResult;
    }

    // Load template with enhanced error handling
    const templateResult = await this.loadTemplate(config);
    if (isError(templateResult)) {
      return templateResult;
    }

    // Load documents with enhanced error handling
    const documentsResult = await this.loadDocuments(config);
    if (isError(documentsResult)) {
      return documentsResult;
    }

    logger.info("Successfully loaded all processing resources", {
      schemaLoaded: true,
      templateLoaded: true,
      documentsCount: documentsResult.data.length,
    });

    return {
      ok: true,
      data: {
        schema: schemaResult.data,
        template: templateResult.data,
        documents: documentsResult.data,
      },
    };
  }

  /**
   * Load schema with detailed error reporting
   */
  private async loadSchema(
    config: ProcessingConfiguration,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    const schemaResult = await this.schemaRepo.load(config.schemaPath);
    if (isError(schemaResult)) {
      // Enhanced error message based on error type
      let reason = "Failed to load schema";
      if (schemaResult.error.kind === "FileNotFound") {
        reason = "Schema file not found";
      } else if (
        schemaResult.error.kind === "ReadError" && schemaResult.error.details
      ) {
        reason = `Schema load error: ${schemaResult.error.details}`;
      } else if (schemaResult.error.message) {
        reason = schemaResult.error.message;
      }

      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: config.schemaPath.getValue(),
          details: reason,
        }),
      };
    }
    return schemaResult;
  }

  /**
   * Load template with detailed error reporting
   */
  private async loadTemplate(
    config: ProcessingConfiguration,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    const templateResult = await this.templateRepo.load(
      config.templatePath.getValue(),
    );
    if (isError(templateResult)) {
      // Enhanced error message based on error type
      let reason = "Failed to load template";
      if (templateResult.error.kind === "FileNotFound") {
        reason = "Template file not found";
      } else if (
        templateResult.error.kind === "ReadError" &&
        templateResult.error.details
      ) {
        reason = `Template load error: ${templateResult.error.details}`;
      } else if (templateResult.error.message) {
        reason = templateResult.error.message;
      }

      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: config.templatePath.getValue(),
          details: reason,
        }),
      };
    }
    return templateResult;
  }

  /**
   * Load documents with detailed error reporting
   */
  private async loadDocuments(
    config: ProcessingConfiguration,
  ): Promise<Result<Document[], DomainError & { message: string }>> {
    const documentsResult = await this.documentRepo.findAll(
      config.documentsPath,
    );
    if (isError(documentsResult)) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: config.documentsPath.getValue(),
          details: documentsResult.error.message ||
            "Failed to load documents",
        }),
      };
    }
    return documentsResult;
  }
}
