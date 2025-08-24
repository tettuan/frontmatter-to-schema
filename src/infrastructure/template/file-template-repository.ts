/**
 * File-based implementation of TemplateRepository
 * Loads templates from the file system
 */

import type { Result } from "../../domain/core/result.ts";
import type { ValidationError } from "../../domain/shared/errors.ts";
import { createValidationError } from "../../domain/shared/errors.ts";
import { Template, TemplateDefinition } from "../../domain/models/template.ts";
import type { TemplateRepository } from "../../domain/template/repository.ts";
import { TemplatePath } from "../../domain/template/repository.ts";
import {
  TemplateFormat,
  TemplateFormatHandlerFactory,
} from "../../domain/template/format-handlers.ts";

export class FileTemplateRepository implements TemplateRepository {
  private templateCache = new Map<string, Template>();

  constructor(private readonly basePath: string = "./templates") {}

  async load(templateId: string): Promise<Result<Template, ValidationError>> {
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
      error: createValidationError(
        `Template not found: ${templateId}. Searched in: ${
          possiblePaths.join(", ")
        }`,
      ),
    };
  }

  async loadFromPath(
    path: TemplatePath,
  ): Promise<Result<Template, ValidationError>> {
    try {
      const filePath = path.getValue();
      const content = await Deno.readTextFile(filePath);

      // Determine format from extension using shared infrastructure
      const ext = filePath.split(".").pop()?.toLowerCase() || "custom";
      const formatResult = this.determineTemplateFormat(ext);
      if (!formatResult.ok) {
        return formatResult;
      }
      const templateFormatObj = formatResult.data;
      const format = templateFormatObj.getValue() as
        | "json"
        | "yaml"
        | "handlebars"
        | "custom";

      // Create template definition
      const definitionResult = TemplateDefinition.create(content, format);
      if (!definitionResult.ok) {
        return definitionResult;
      }

      // Extract ID from filename
      const filename = filePath.split("/").pop() || "";
      const id = filename.split(".")[0];

      // Create template
      const templateResult = Template.create(
        id,
        definitionResult.data,
        `Template loaded from ${filePath}`,
      );

      // Validate template format using format handler
      const handlerResult = TemplateFormatHandlerFactory.getHandler(format);
      if (handlerResult.ok) {
        // Pre-validate template content
        const parseResult = handlerResult.data.parse(content);
        if (!parseResult.ok) {
          return {
            ok: false,
            error: createValidationError(
              `Invalid ${format} template format: ${parseResult.error.message}`,
            ),
          };
        }
      }

      return templateResult;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createValidationError(
            `Template file not found: ${path.getValue()}`,
          ),
        };
      }
      return {
        ok: false,
        error: createValidationError(
          `Failed to load template from ${path.getValue()}: ${error}`,
        ),
      };
    }
  }

  async save(template: Template): Promise<Result<void, ValidationError>> {
    try {
      const format = template.getDefinition().getFormat();
      const ext = format === "yaml"
        ? "yml"
        : format === "handlebars"
        ? "hbs"
        : format;
      const filePath = `${this.basePath}/${template.getId()}.${ext}`;

      await Deno.writeTextFile(
        filePath,
        template.getDefinition().getDefinition(),
      );

      // Update cache
      this.templateCache.set(template.getId(), template);

      return { ok: true, data: undefined };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(`Failed to save template: ${error}`),
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

  async list(): Promise<Result<string[], ValidationError>> {
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
        // Template directory doesn't exist yet
        return { ok: true, data: [] };
      }
      return {
        ok: false,
        error: createValidationError(`Failed to list templates: ${error}`),
      };
    }
  }

  /**
   * Determine template format from file extension
   * Uses shared TemplateFormat validation
   */
  private determineTemplateFormat(
    extension: string,
  ): Result<TemplateFormat, ValidationError> {
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
    return TemplateFormat.create(formatName);
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
}
