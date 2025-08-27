/**
 * File-based implementation of TemplateRepository
 * Loads templates from the file system
 */

import type { DomainError, Result } from "../../domain/core/result.ts";
import { createDomainError } from "../../domain/core/result.ts";
import {
  Template,
  TemplateDefinition,
} from "../../domain/models/domain-models.ts";
import type { TemplateRepository } from "../../domain/template/repository.ts";
import { TemplatePath } from "../../domain/template/repository.ts";
import { TemplateFormat } from "../../domain/template/format-handlers.ts";
import {
  ComponentDomain,
  FactoryConfigurationBuilder,
} from "../../domain/core/component-factory.ts";

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
        return {
          ok: false,
          error: createDomainError({
            kind: "ParseError",
            input: content.substring(0, 50),
            details:
              `Template definition error: ${definitionResult.error.kind}`,
          }),
        };
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
      if (!templateResult.ok) {
        return {
          ok: false,
          error: createDomainError({
            kind: "ParseError",
            input: id,
            details: `Template creation error: ${templateResult.error.kind}`,
          }),
        };
      }

      // Validate template format using format handler from unified factory
      const factory = FactoryConfigurationBuilder.createDefault();
      const templateComponents = factory.createDomainComponents(
        ComponentDomain.Template,
      ) as {
        formatHandlers: Map<
          string,
          import("../../domain/template/format-handlers.ts").TemplateFormatHandler
        >;
      };
      const handler = templateComponents.formatHandlers.get(
        format.toLowerCase(),
      );

      if (handler) {
        // Pre-validate template content
        const parseResult = handler.parse(content);
        if (!parseResult.ok) {
          return {
            ok: false,
            error: createDomainError({
              kind: "ParseError",
              input: content.substring(0, 100),
              details:
                `Invalid ${format} template format: ${parseResult.error.message}`,
            }),
          };
        }
      }

      return { ok: true, data: templateResult.data };
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
      const format = template.getDefinition().getFormat();
      const ext = format === "yaml"
        ? "yml"
        : format === "handlebars"
        ? "hbs"
        : format;
      const filePath = `${this.basePath}/${template.getId()}.${ext}`;

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
        // Template directory doesn't exist yet
        return { ok: true, data: [] };
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
    const result = TemplateFormat.create(formatName);
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
}
