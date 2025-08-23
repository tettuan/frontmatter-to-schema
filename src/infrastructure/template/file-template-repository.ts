/**
 * File-based implementation of TemplateRepository
 * Loads templates from the file system
 */

import type { Result } from "../../domain/shared/result.ts";
import type { ValidationError } from "../../domain/shared/errors.ts";
import { createValidationError } from "../../domain/shared/errors.ts";
import { Template, TemplateDefinition } from "../../domain/models/template.ts";
import type { TemplateRepository } from "../../domain/template/repository.ts";
import { TemplatePath } from "../../domain/template/repository.ts";

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

      // Determine format from extension
      const ext = filePath.split(".").pop()?.toLowerCase();
      let format: "json" | "yaml" | "handlebars" | "custom";

      switch (ext) {
        case "json":
          format = "json";
          break;
        case "yaml":
        case "yml":
          format = "yaml";
          break;
        case "hbs":
          format = "handlebars";
          break;
        default:
          format = "custom";
      }

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

          // Only include valid template files
          if (ext && ["json", "yaml", "yml", "hbs", "template"].includes(ext)) {
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
}
