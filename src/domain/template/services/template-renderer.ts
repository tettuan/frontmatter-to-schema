/**
 * TemplateRenderer Domain Service
 *
 * Handles template rendering with validated data following DDD and Totality principles
 * Consolidates template rendering business logic into a single domain service
 * Uses value objects and returns Result<T,E> for all operations
 */

import type { Result } from "../../core/result.ts";
import { createDomainError, type DomainError } from "../../core/result.ts";
import type {
  TemplateDefinition,
  TemplateEngine,
} from "../../value-objects/template-definition.ts";
import type { FrontmatterData } from "../../value-objects/frontmatter-data.ts";

/**
 * Rendering context for template processing
 */
export interface RenderingContext {
  readonly data: Record<string, unknown>;
  readonly variables?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Template rendering result
 */
export interface RenderingResult {
  readonly content: string;
  readonly variables: string[];
  readonly metadata: {
    readonly engine: TemplateEngine;
    readonly renderTime: number;
    readonly variableCount: number;
  };
}

/**
 * Rendering options
 */
export interface RenderingOptions {
  readonly allowPartialRender?: boolean;
  readonly strictMode?: boolean;
  readonly preserveWhitespace?: boolean;
  readonly escapeHtml?: boolean;
}

/**
 * TemplateRenderer domain service for rendering templates with data
 * Follows Totality principles - all functions are total and return Result<T,E>
 */
export class TemplateRenderer {
  private constructor() {}

  /**
   * Smart Constructor for TemplateRenderer
   * @returns Result containing TemplateRenderer
   */
  static create(): Result<
    TemplateRenderer,
    DomainError & { message: string }
  > {
    return {
      ok: true,
      data: new TemplateRenderer(),
    };
  }

  /**
   * Render template with frontmatter data
   * @param template - TemplateDefinition to render
   * @param data - FrontmatterData to use for rendering
   * @param options - Optional rendering options
   * @returns Result containing rendered content
   */
  renderWithFrontmatter(
    template: TemplateDefinition,
    data: FrontmatterData,
    options: RenderingOptions = {},
  ): Result<RenderingResult, DomainError & { message: string }> {
    if (data.isEmpty()) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Cannot render template with empty frontmatter data",
        ),
      };
    }

    const context: RenderingContext = {
      data: data.getData(),
      metadata: {
        format: data.getFormat(),
        fieldCount: data.getFieldCount(),
      },
    };

    return this.renderWithContext(template, context, options);
  }

  /**
   * Render template with raw data context
   * @param template - TemplateDefinition to render
   * @param context - RenderingContext with data and metadata
   * @param options - Optional rendering options
   * @returns Result containing rendered content
   */
  renderWithContext(
    template: TemplateDefinition,
    context: RenderingContext,
    options: RenderingOptions = {},
  ): Result<RenderingResult, DomainError & { message: string }> {
    if (template.isEmpty()) {
      return {
        ok: false,
        error: createDomainError(
          { kind: "EmptyInput" },
          "Cannot render empty template",
        ),
      };
    }

    const startTime = performance.now();
    const engine = template.getEngine();

    // Extract variables from template
    const templateVariables = template.extractVariables();

    // Validate required variables are present if in strict mode
    if (options.strictMode) {
      const missingVariables = this.findMissingVariables(
        templateVariables,
        context.data,
      );
      if (missingVariables.length > 0) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "MissingRequiredField",
              fields: missingVariables,
            },
            `Missing required variables: ${missingVariables.join(", ")}`,
          ),
        };
      }
    }

    // Render based on engine type
    const renderResult = this.renderByEngine(
      template.getContent(),
      engine,
      context,
      options,
    );

    if (!renderResult.ok) {
      return renderResult;
    }

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    return {
      ok: true,
      data: {
        content: renderResult.data,
        variables: templateVariables,
        metadata: {
          engine,
          renderTime,
          variableCount: templateVariables.length,
        },
      },
    };
  }

  /**
   * Preview template rendering with sample data
   * @param template - TemplateDefinition to preview
   * @param sampleData - Sample data for preview
   * @returns Result containing preview result
   */
  previewRender(
    template: TemplateDefinition,
    sampleData?: Record<string, unknown>,
  ): Result<RenderingResult, DomainError & { message: string }> {
    const variables = template.extractVariables();
    const defaultSampleData = this.generateSampleData(variables);
    const data = sampleData || defaultSampleData;

    const context: RenderingContext = {
      data,
      metadata: { preview: true },
    };

    return this.renderWithContext(template, context, {
      allowPartialRender: true,
      strictMode: false,
    });
  }

  /**
   * Validate template can be rendered with given data
   * @param template - TemplateDefinition to validate
   * @param data - Data to validate against
   * @returns Result indicating validation success
   */
  validateRenderability(
    template: TemplateDefinition,
    data: Record<string, unknown>,
  ): Result<{
    canRender: boolean;
    missingVariables: string[];
    extraVariables: string[];
  }, DomainError & { message: string }> {
    const templateVariables = template.extractVariables();
    const dataKeys = Object.keys(data);

    const missingVariables = templateVariables.filter(
      (variable) => !(variable in data),
    );
    const extraVariables = dataKeys.filter(
      (key) => !templateVariables.includes(key),
    );

    const canRender = missingVariables.length === 0;

    return {
      ok: true,
      data: {
        canRender,
        missingVariables,
        extraVariables,
      },
    };
  }

  /**
   * Render template by engine type
   * @param content - Template content
   * @param engine - Template engine
   * @param context - Rendering context
   * @param options - Rendering options
   * @returns Result containing rendered content
   */
  private renderByEngine(
    content: string,
    engine: TemplateEngine,
    context: RenderingContext,
    options: RenderingOptions,
  ): Result<string, DomainError & { message: string }> {
    switch (engine) {
      case "handlebars":
      case "mustache":
        return this.renderHandlebarsLike(content, context, options);

      case "liquid":
        return this.renderLiquid(content, context, options);

      case "ejs":
        return this.renderEjs(content, context, options);

      case "html":
      case "text":
        return this.renderSimple(content, context, options);

      case "pug":
      case "custom":
        return this.renderCustom(content, context, options);

      default: {
        // Exhaustive check
        const _exhaustiveCheck: never = engine;
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: String(_exhaustiveCheck),
              expectedFormat: "supported template engine",
            },
            `Unsupported template engine: ${String(_exhaustiveCheck)}`,
          ),
        };
      }
    }
  }

  /**
   * Render Handlebars/Mustache style templates
   */
  private renderHandlebarsLike(
    content: string,
    context: RenderingContext,
    options: RenderingOptions,
  ): Result<string, DomainError & { message: string }> {
    try {
      // Replace {{variable}} patterns
      const rendered = content.replace(
        /\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g,
        (match, variablePath) => {
          const value = this.getValueByPath(context.data, variablePath);
          if (value === undefined) {
            if (options.allowPartialRender) {
              return match; // Keep placeholder
            }
            throw new Error(`Variable not found: ${variablePath}`);
          }
          return this.formatValue(value, options);
        },
      );

      return { ok: true, data: rendered };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "RenderError",
            template: content.substring(0, 100),
            details: error instanceof Error ? error.message : String(error),
          },
          "Failed to render Handlebars/Mustache template",
        ),
      };
    }
  }

  /**
   * Render Liquid style templates
   */
  private renderLiquid(
    content: string,
    context: RenderingContext,
    options: RenderingOptions,
  ): Result<string, DomainError & { message: string }> {
    try {
      // Basic Liquid rendering - handle {{variable}} outputs
      const rendered = content.replace(
        /\{\{\s*([a-zA-Z_][\w.]*)\s*\}\}/g,
        (match, variablePath) => {
          const value = this.getValueByPath(context.data, variablePath);
          if (value === undefined) {
            if (options.allowPartialRender) {
              return match;
            }
            throw new Error(`Variable not found: ${variablePath}`);
          }
          return this.formatValue(value, options);
        },
      );

      return { ok: true, data: rendered };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "RenderError",
            template: content.substring(0, 100),
            details: error instanceof Error ? error.message : String(error),
          },
          "Failed to render Liquid template",
        ),
      };
    }
  }

  /**
   * Render EJS style templates
   */
  private renderEjs(
    content: string,
    context: RenderingContext,
    options: RenderingOptions,
  ): Result<string, DomainError & { message: string }> {
    try {
      // Replace <%=variable%> patterns
      const rendered = content.replace(
        /<%=\s*([a-zA-Z_][\w.]*)\s*%>/g,
        (match, variablePath) => {
          const value = this.getValueByPath(context.data, variablePath);
          if (value === undefined) {
            if (options.allowPartialRender) {
              return match;
            }
            throw new Error(`Variable not found: ${variablePath}`);
          }
          return this.formatValue(value, options);
        },
      );

      return { ok: true, data: rendered };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "RenderError",
            template: content.substring(0, 100),
            details: error instanceof Error ? error.message : String(error),
          },
          "Failed to render EJS template",
        ),
      };
    }
  }

  /**
   * Render simple text/HTML templates
   */
  private renderSimple(
    content: string,
    context: RenderingContext,
    options: RenderingOptions,
  ): Result<string, DomainError & { message: string }> {
    try {
      // Simple variable substitution with {variable} pattern
      const rendered = content.replace(
        /\{([a-zA-Z_][\w.]*)\}/g,
        (match, variablePath) => {
          const value = this.getValueByPath(context.data, variablePath);
          if (value === undefined) {
            if (options.allowPartialRender) {
              return match;
            }
            throw new Error(`Variable not found: ${variablePath}`);
          }
          return this.formatValue(value, options);
        },
      );

      return { ok: true, data: rendered };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "RenderError",
            template: content.substring(0, 100),
            details: error instanceof Error ? error.message : String(error),
          },
          "Failed to render simple template",
        ),
      };
    }
  }

  /**
   * Render custom engine templates
   */
  private renderCustom(
    content: string,
    context: RenderingContext,
    _options: RenderingOptions,
  ): Result<string, DomainError & { message: string }> {
    // For custom engines, return content with context data as comment
    const contextInfo = `<!-- Context: ${JSON.stringify(context.data)} -->`;
    return { ok: true, data: `${contextInfo}\n${content}` };
  }

  /**
   * Get value from object by dot notation path
   */
  private getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    const keys = path.split(".");
    let current: unknown = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (
        typeof current === "object" &&
        key in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Format value for output
   */
  private formatValue(value: unknown, options: RenderingOptions): string {
    if (value === null || value === undefined) {
      return "";
    }

    let stringValue = String(value);

    // HTML escaping if required
    if (options.escapeHtml) {
      stringValue = stringValue
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    return stringValue;
  }

  /**
   * Find missing variables in data
   */
  private findMissingVariables(
    templateVariables: string[],
    data: Record<string, unknown>,
  ): string[] {
    return templateVariables.filter((variable) => {
      return this.getValueByPath(data, variable) === undefined;
    });
  }

  /**
   * Generate sample data for template variables
   */
  private generateSampleData(variables: string[]): Record<string, unknown> {
    const sampleData: Record<string, unknown> = {};

    for (const variable of variables) {
      // Generate sample values based on variable name
      if (variable.toLowerCase().includes("title")) {
        sampleData[variable] = "Sample Title";
      } else if (variable.toLowerCase().includes("description")) {
        sampleData[variable] = "Sample description text";
      } else if (variable.toLowerCase().includes("date")) {
        sampleData[variable] = new Date().toISOString().split("T")[0];
      } else if (variable.toLowerCase().includes("author")) {
        sampleData[variable] = "Sample Author";
      } else if (
        variable.toLowerCase().includes("count") ||
        variable.toLowerCase().includes("number")
      ) {
        sampleData[variable] = 42;
      } else if (
        variable.toLowerCase().includes("active") ||
        variable.toLowerCase().includes("enabled")
      ) {
        sampleData[variable] = true;
      } else {
        sampleData[variable] = `Sample ${variable}`;
      }
    }

    return sampleData;
  }
}
