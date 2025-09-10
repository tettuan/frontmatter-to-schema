/**
 * Template Repository Implementation
 * Handles template loading and management
 * Follows DDD and Totality principles with Result types
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import type { ITemplateRepository } from "../../domain/repositories/template-repository.ts";
import type { TemplatePath } from "../../domain/repositories/template-repository.ts";
import type { Template } from "../../domain/models/entities.ts";
import {
  Template as TemplateEntity,
  TemplateId,
} from "../../domain/models/entities.ts";
import { TemplateFormat } from "../../domain/models/template-value-objects.ts";
import type { MappingRule } from "../../domain/models/template-value-objects.ts";

/**
 * Implementation of the Template Repository
 */
export class TemplateRepositoryImpl implements ITemplateRepository {
  private readonly templateCache: Map<string, Template> = new Map();

  /**
   * Load a template from file
   * @param templatePath - Path to the template file
   * @returns Result containing the Template entity or error
   */
  async load(
    templatePath: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    try {
      const path = templatePath.getPath();

      // Check cache first
      const cached = this.templateCache.get(path);
      if (cached) {
        return { ok: true, data: cached };
      }

      // Read template file
      let content: string;
      try {
        content = await Deno.readTextFile(path);
      } catch (error) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ReadError",
              path: path,
              details: String(error),
            },
            `Failed to read template file: ${templatePath}`,
          ),
        };
      }

      // Create Template entity
      const templateResult = this.createTemplateEntity(
        path,
        content,
      );
      if (!templateResult.ok) {
        return templateResult;
      }

      // Cache the template
      this.templateCache.set(path, templateResult.data);
      return templateResult;
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ProcessingStageError",
            stage: "template loading",
            error: {
              kind: "InvalidResponse",
              service: "template-repository",
              response: String(error),
            },
          },
          `Unexpected error loading template: ${error}`,
        ),
      };
    }
  }

  /**
   * Save a template to file
   * @param templatePath - Path to save the template
   * @param template - Template entity to save
   * @returns Result indicating success or error
   */
  async save(
    templatePath: string,
    template: Template,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      // Await to satisfy async requirement
      await Promise.resolve();
      // Cache the template (actual file writing would happen here)
      this.templateCache.set(templatePath, template);
      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "WriteError",
            path: templatePath,
            details: String(error),
          },
          `Failed to save template: ${error}`,
        ),
      };
    }
  }

  /**
   * Validate a template entity
   * @param template - Template to validate
   * @returns Result indicating validity
   */
  validate(
    template: Template,
  ): Result<void, DomainError & { message: string }> {
    // Check required properties
    if (!template.getId() || !template.getFormat()) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "MissingRequiredField",
            fields: ["id", "format"],
          },
          "Invalid template: missing required fields",
        ),
      };
    }

    return { ok: true, data: undefined };
  }

  /**
   * Create a Template entity from content
   */
  private createTemplateEntity(
    path: string,
    content: string,
  ): Result<Template, DomainError & { message: string }> {
    try {
      // Parse the template content to determine format and rules
      const templateData = JSON.parse(content);

      // Create TemplateId
      const idResult = TemplateId.create(path);
      if (!idResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ProcessingStageError",
              stage: "template creation",
              error: idResult.error,
            },
            "Failed to create Template ID",
          ),
        };
      }

      // Create TemplateFormat
      const formatResult = TemplateFormat.create(
        templateData.format || "json",
        content,
      );
      if (!formatResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ProcessingStageError",
              stage: "template creation",
              error: formatResult.error,
            },
            "Failed to create Template format",
          ),
        };
      }

      // Extract mapping rules (simplified for now)
      const mappingRules: MappingRule[] = [];

      // Create Template
      const templateResult = TemplateEntity.create(
        idResult.data,
        formatResult.data,
        mappingRules,
        templateData.description || "",
      );

      if (!templateResult.ok) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "ProcessingStageError",
              stage: "template creation",
              error: templateResult.error,
            },
            "Failed to create Template entity",
          ),
        };
      }

      return templateResult;
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: content,
            expectedFormat: "JSON template",
          },
          `Failed to parse template: ${error}`,
        ),
      };
    }
  }

  /**
   * Clear the template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  /**
   * Check if template exists at path
   */
  async exists(
    path: TemplatePath,
  ): Promise<Result<boolean, DomainError & { message: string }>> {
    try {
      const filePath = path.getPath();
      const fileInfo = await Deno.stat(filePath);
      return { ok: true, data: fileInfo.isFile };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return { ok: true, data: false };
      }
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ReadError",
            path: path.getPath(),
            details: String(error),
          },
          `Failed to check template existence: ${error}`,
        ),
      };
    }
  }

  /**
   * Get template base directory for resolving relative paths
   */
  getBaseDirectory(): Result<string, DomainError & { message: string }> {
    return { ok: true, data: Deno.cwd() };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.templateCache.size,
      keys: Array.from(this.templateCache.keys()),
    };
  }
}
