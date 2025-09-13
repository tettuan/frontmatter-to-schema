/**
 * Template Builder Facade Implementation
 * Concrete implementation using TemplateOnlyProcessor
 */

import type { Result } from "../core/result.ts";
import { TemplateOnlyProcessor } from "../../core/template-only-processor.ts";
import type {
  BuildError,
  CompiledTemplate,
  CompositionError,
  TemplateBuilderFacade,
  TemplateSource,
  ValidationError,
} from "./template-builder-facade.ts";
// Use built-in crypto API for hashing

/**
 * Concrete implementation of CompiledTemplate
 */
class CompiledTemplateImpl implements CompiledTemplate {
  constructor(
    public readonly templatePath: import("./template-builder-facade.ts").TemplateFilePath,
    public readonly appliedValues: import("./template-builder-facade.ts").TemplateValueSet,
    public readonly compiledContent: string,
    public readonly compiledAt: Date,
    public readonly checksum: string,
    public readonly format: "json" | "yaml" | "text",
  ) {}

  validate(): Result<void, ValidationError> {
    // Validate compiled content
    if (!this.compiledContent || this.compiledContent.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "ValidationError",
          message: "Compiled content is empty",
        },
      };
    }

    // Validate format-specific requirements
    if (this.format === "json") {
      try {
        JSON.parse(this.compiledContent);
      } catch (e) {
        return {
          ok: false,
          error: {
            kind: "ValidationError",
            message: `Invalid JSON format: ${e}`,
            field: "compiledContent",
          },
        };
      }
    }

    return { ok: true, data: undefined };
  }
}

/**
 * Template Builder Facade Implementation
 * Uses TemplateOnlyProcessor for strict template processing
 */
export class TemplateBuilderFacadeImpl implements TemplateBuilderFacade {
  private processor: TemplateOnlyProcessor;

  constructor() {
    this.processor = new TemplateOnlyProcessor();
  }

  async buildTemplate(
    source: TemplateSource,
  ): Promise<Result<CompiledTemplate, BuildError>> {
    try {
      // Load template content from file
      // templatePath is already a string path, not an object with resolve()
      const templatePath = typeof source.templatePath === 'string'
        ? source.templatePath
        : (source.templatePath as any).path || String(source.templatePath);
      let templateContent: string;

      try {
        templateContent = await Deno.readTextFile(templatePath);
      } catch (e) {
        return {
          ok: false,
          error: {
            kind: "BuildError",
            message: `Failed to read template file: ${templatePath}`,
            details: e,
          },
        };
      }

      // Process template with values using TemplateOnlyProcessor
      const result = this.processor.processTemplate(
        templateContent,
        source.valueSet.values,
      );

      if (!result.ok) {
        return {
          ok: false,
          error: {
            kind: "BuildError",
            message: result.error.message,
            details: result.error,
          },
        };
      }

      // Calculate checksum using Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(result.data);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Detect format
      const format = this.detectFormat(result.data);

      // Create compiled template
      const compiled = new CompiledTemplateImpl(
        source.templatePath,
        source.valueSet,
        result.data,
        new Date(),
        checksum,
        format,
      );

      // Validate before returning
      const validationResult = compiled.validate();
      if (!validationResult.ok) {
        return {
          ok: false,
          error: {
            kind: "BuildError",
            message: `Template validation failed: ${validationResult.error.message}`,
            details: validationResult.error,
          },
        };
      }

      return { ok: true, data: compiled };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "BuildError",
          message: `Unexpected error during template building: ${error}`,
          details: error,
        },
      };
    }
  }

  async composeTemplates(
    templates: CompiledTemplate[],
  ): Promise<Result<CompiledTemplate, CompositionError>> {
    if (templates.length === 0) {
      return {
        ok: false,
        error: {
          kind: "CompositionError",
          message: "No templates provided for composition",
        },
      };
    }

    if (templates.length === 1) {
      // Single template, return as-is
      return {
        ok: true,
        data: templates[0],
      };
    }

    try {
      // Compose multiple templates
      const composedContent = templates
        .map((t) => t.compiledContent)
        .join("\n---\n");

      // Merge value sets
      const mergedValues: Record<string, unknown> = {};
      for (const template of templates) {
        Object.assign(mergedValues, template.appliedValues.values);
      }

      // Calculate checksum using Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(composedContent);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Create composed template
      const composed = new CompiledTemplateImpl(
        templates[0].templatePath, // Use first template's path
        {
          values: mergedValues,
          metadata: {
            source: "composed",
            timestamp: new Date(),
          },
        },
        composedContent,
        new Date(),
        checksum,
        "text", // Composed templates are text format
      );

      return { ok: true, data: composed };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "CompositionError",
          message: `Failed to compose templates: ${error}`,
          details: error,
        },
      };
    }
  }

  validateTemplate(
    template: CompiledTemplate,
  ): Result<void, ValidationError> {
    return template.validate();
  }

  private detectFormat(content: string): "json" | "yaml" | "text" {
    // Try to detect format from content
    const trimmed = content.trim();

    // Check for JSON
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        JSON.parse(trimmed);
        return "json";
      } catch {
        // Not valid JSON
      }
    }

    // Check for YAML
    if (trimmed.includes(":") && (trimmed.includes("\n") || trimmed.includes("-"))) {
      return "yaml";
    }

    // Default to text
    return "text";
  }
}