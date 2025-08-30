/**
 * File-based implementation of TemplateRepository
 * Loads templates from the file system
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import { Template, TemplateId } from "../../domain/models/entities.ts";
import type { TemplateRepository } from "../../domain/services/interfaces.ts";
import {
  type MappingRule,
  TemplateFormat,
  TemplatePath,
} from "../../domain/models/value-objects.ts";

export class FileTemplateRepository implements TemplateRepository {
  private templateCache = new Map<string, Template>();

  constructor(private readonly basePath: string = "./templates") {}

  async load(
    templateId: string,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    // Check cache first
    const cached = this.templateCache.get(templateId);
    if (cached) {
      return { ok: true, data: cached };
    }

    // Try to load from common locations
    const possiblePaths = [
      `${this.basePath}/${templateId}.json`,
      `${this.basePath}/${templateId}.yaml`,
      `${this.basePath}/${templateId}.yml`,
      `${this.basePath}/${templateId}.hbs`,
      `${this.basePath}/${templateId}.template`,
    ];

    for (const path of possiblePaths) {
      const pathResult = TemplatePath.create(path);
      if (pathResult.ok) {
        const result = await this.loadFromPath(pathResult.data);
        if (result.ok) {
          this.templateCache.set(templateId, result.data);
          return result;
        }
      }
    }

    return {
      ok: false,
      error: createDomainError({
        kind: "FileNotFound",
        path: `${templateId} in [${possiblePaths.join(", ")}]`,
      }),
    };
  }

  async loadFromPath(
    path: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    try {
      const filePath = path.getValue();
      const content = await Deno.readTextFile(filePath);

      // Determine format from extension using shared infrastructure
      const ext = filePath.split(".").pop()?.toLowerCase() || "custom";
      const formatResult = this.determineTemplateFormat(ext, content);
      if (!formatResult.ok) {
        return formatResult;
      }

      // Extract ID from filename
      const filename = filePath.split("/").pop() || "";
      const id = filename.split(".")[0];

      // Create template ID
      const templateIdResult = TemplateId.create(id);
      if (!templateIdResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ParseError",
            input: id,
            details:
              `Template ID creation error: ${templateIdResult.error.kind}`,
          }),
        };
      }

      // For now, create empty mapping rules - this should be improved to parse template content
      const mappingRules: MappingRule[] = [];

      // Create template using the format we already determined
      const templateResult = Template.create(
        templateIdResult.data,
        formatResult.data,
        mappingRules,
        `Template loaded from ${filePath}`,
      );

      if (!templateResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "NotConfigured",
            component: "Template",
          }, `Template creation failed: ${templateResult.error.message}`),
        };
      }

      const template = templateResult.data;

      // Validate template format using analysis components
      // Note: Template validation moved to application layer following DDD boundaries
      // Template format validation simplified following DDD boundaries
      // Infrastructure layer focuses only on file system operations
      // Domain validation delegated to application and domain layers

      // Template format validation simplified following DDD boundaries
      // Infrastructure layer focuses only on file system operations
      // Domain validation delegated to application and domain layers

      // Basic format check completed - template is loadable

      return { ok: true, data: template };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileNotFound",
            path: path.getValue(),
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async save(
    template: Template,
  ): Promise<Result<void, DomainError & { message: string }>> {
    try {
      const format = template.getFormat().getFormat();
      const ext = format === "yaml"
        ? "yml"
        : format === "handlebars"
        ? "hbs"
        : format;
      const filePath = `${this.basePath}/${template.getId().getValue()}.${ext}`;

      await Deno.writeTextFile(
        filePath,
        template.getFormat().getTemplate(),
      );

      // Update cache
      this.templateCache.set(template.getId().getValue(), template);

      return { ok: true, data: undefined };
    } catch (error) {
      const format = template.getFormat().getFormat();
      const ext = format === "yaml"
        ? "yml"
        : format === "handlebars"
        ? "hbs"
        : format;
      const filePath = `${this.basePath}/${template.getId().getValue()}.${ext}`;

      return {
        ok: false,
        error: createDomainError({
          kind: "WriteError",
          path: filePath,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  async exists(templateId: string): Promise<boolean> {
    if (this.templateCache.has(templateId)) {
      return true;
    }

    const result = await this.load(templateId);
    return result.ok;
  }

  async list(): Promise<Result<string[], DomainError & { message: string }>> {
    try {
      const templates: string[] = [];

      // Read all files in template directory
      for await (const entry of Deno.readDir(this.basePath)) {
        if (entry.isFile) {
          const name = entry.name;
          const ext = name.split(".").pop()?.toLowerCase();

          // Only include valid template files using shared logic
          if (ext && FileTemplateRepository.isSupportedExtension(ext)) {
            const id = name.split(".")[0];
            if (!templates.includes(id)) {
              templates.push(id);
            }
          }
        }
      }

      return { ok: true, data: templates };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        // Template directory doesn't exist - this is an error condition
        return {
          ok: false,
          error: createDomainError({
            kind: "ReadError",
            path: this.basePath,
            details: "Directory does not exist",
          }),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: this.basePath,
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      };
    }
  }

  /**
   * Determine template format from file extension
   * Uses shared TemplateFormat validation
   */
  private determineTemplateFormat(
    extension: string,
    content: string,
  ): Result<TemplateFormat, DomainError & { message: string }> {
    // Map file extensions to template formats
    const extensionMap: Record<string, string> = {
      "json": "json",
      "yaml": "yaml",
      "yml": "yaml",
      "hbs": "handlebars",
      "handlebars": "handlebars",
      "template": "custom",
    };

    const formatName = extensionMap[extension] || "custom";
    const result = TemplateFormat.create(formatName, content);
    if (!result.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: formatName,
          expectedFormat: "json|yaml|handlebars|custom",
        }),
      };
    }
    return result;
  }

  /**
   * Get supported template file extensions
   */
  static getSupportedExtensions(): string[] {
    return ["json", "yaml", "yml", "hbs", "handlebars", "template"];
  }

  /**
   * Check if file extension is supported
   */
  static isSupportedExtension(extension: string): boolean {
    return this.getSupportedExtensions().includes(extension.toLowerCase());
  }

  /**
   * Validate a template
   */
  validate(
    template: Template,
  ): Result<void, DomainError & { message: string }> {
    // Basic template validation
    try {
      const templateId = template.getId();
      const format = template.getFormat();

      // Validate template ID exists
      if (!templateId) {
        return {
          ok: false,
          error: createDomainError({
            kind: "EmptyInput",
            field: "templateId",
          }),
        };
      }

      // Validate format exists
      if (!format) {
        return {
          ok: false,
          error: createDomainError({
            kind: "InvalidFormat",
            input: "undefined",
            expectedFormat: "valid template format",
          }),
        };
      }

      return { ok: true, data: undefined };
    } catch (_error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: "template",
          expectedFormat: "valid Template object",
        }),
      };
    }
  }
}
