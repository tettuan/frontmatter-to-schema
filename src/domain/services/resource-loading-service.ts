/**
 * Resource Loading Service
 *
 * Consolidates resource loading responsibilities from massive use case methods.
 * Following AI Complexity Control Framework - eliminates resource loading entropy.
 * Implements Single Responsibility Principle for resource management.
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import { ResultHandlerService } from "./result-handler-service.ts";
import type { Document, Schema, Template } from "../models/entities.ts";
import type {
  ConfigPath,
  DocumentPath,
  TemplatePath,
} from "../models/value-objects.ts";
import type {
  DocumentRepository,
  SchemaRepository,
  TemplateRepository,
} from "./interfaces.ts";

/**
 * Resource Loading Result with detailed context
 */
export interface ResourceLoadingResult {
  schema: Schema;
  template: Template;
  documents: Document[];
}

/**
 * Resource Loading Configuration
 */
export interface ResourceLoadingConfig {
  schemaPath: ConfigPath;
  templatePath: TemplatePath;
  documentsPath: DocumentPath;
}

/**
 * Resource Loading Service
 *
 * Extracts resource loading logic from ProcessDocumentsUseCase.execute()
 * Reduces method complexity and improves error handling consistency.
 */
export class ResourceLoadingService {
  constructor(
    private readonly documentRepo: DocumentRepository,
    private readonly schemaRepo: SchemaRepository,
    private readonly templateRepo: TemplateRepository,
  ) {}

  /**
   * Load all required resources with enhanced error context
   */
  async loadResources(
    config: ResourceLoadingConfig,
  ): Promise<Result<ResourceLoadingResult, DomainError & { message: string }>> {
    // Load schema with specific error context
    const schemaResult = await this.loadSchemaWithContext(config.schemaPath);
    if (!schemaResult.ok) {
      return schemaResult;
    }

    // Load template with specific error context
    const templateResult = await this.loadTemplateWithContext(
      config.templatePath,
    );
    if (!templateResult.ok) {
      return templateResult;
    }

    // Load documents with specific error context
    const documentsResult = await this.loadDocumentsWithContext(
      config.documentsPath,
    );
    if (!documentsResult.ok) {
      return documentsResult;
    }

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
   * Load schema with enhanced error messaging
   */
  private async loadSchemaWithContext(
    schemaPath: ConfigPath,
  ): Promise<Result<Schema, DomainError & { message: string }>> {
    const schemaResult = await this.schemaRepo.load(schemaPath);

    if (!schemaResult.ok) {
      // Enhance error message based on error type
      const enhancedError = this.enhanceSchemaError(
        schemaResult.error,
        schemaPath,
      );
      return {
        ok: false,
        error: enhancedError,
      };
    }

    return ResultHandlerService.map(
      schemaResult,
      (schema) => schema,
      {
        operation: "loadSchema",
        component: "ResourceLoadingService",
      },
    );
  }

  /**
   * Load template with enhanced error messaging
   */
  private async loadTemplateWithContext(
    templatePath: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    const templateResult = await this.templateRepo.loadFromPath(templatePath);

    if (!templateResult.ok) {
      // Enhance error message based on error type
      const enhancedError = this.enhanceTemplateError(
        templateResult.error,
        templatePath,
      );
      return {
        ok: false,
        error: enhancedError,
      };
    }

    return ResultHandlerService.map(
      templateResult,
      (template) => template,
      {
        operation: "loadTemplate",
        component: "ResourceLoadingService",
      },
    );
  }

  /**
   * Load documents with enhanced error messaging
   */
  private async loadDocumentsWithContext(
    documentsPath: DocumentPath,
  ): Promise<Result<Document[], DomainError & { message: string }>> {
    const documentsResult = await this.documentRepo.findAll(documentsPath);

    return ResultHandlerService.map(
      documentsResult,
      (documents) => documents,
      {
        operation: "loadDocuments",
        component: "ResourceLoadingService",
      },
    );
  }

  /**
   * Enhance schema loading error with specific context
   */
  private enhanceSchemaError(
    error: DomainError,
    schemaPath: ConfigPath,
  ): DomainError & { message: string } {
    let reason = "Failed to load schema";

    if (error.kind === "FileNotFound") {
      reason = "Schema file not found";
    } else if (
      error.kind === "ReadError" && "details" in error && error.details
    ) {
      reason = `Schema load error: ${error.details}`;
    } else if ("message" in error && error.message) {
      reason = error.message as string;
    }

    return createDomainError({
      kind: "ReadError",
      path: schemaPath.getValue(),
      details: reason,
      message: reason,
    }) as DomainError & { message: string };
  }

  /**
   * Enhance template loading error with specific context
   */
  private enhanceTemplateError(
    error: DomainError,
    templatePath: TemplatePath,
  ): DomainError & { message: string } {
    let reason = "Failed to load template";

    if (error.kind === "FileNotFound") {
      reason = "Template file not found";
    } else if (
      error.kind === "ReadError" && "details" in error && error.details
    ) {
      reason = `Template load error: ${error.details}`;
    } else if ("message" in error && error.message) {
      reason = error.message as string;
    }

    return createDomainError({
      kind: "ReadError",
      path: templatePath.getValue(),
      details: reason,
      message: reason,
    }) as DomainError & { message: string };
  }
}
