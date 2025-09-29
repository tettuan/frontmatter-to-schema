import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";

/**
 * Output format types for rendering
 */
export type OutputFormat = "json" | "yaml" | "xml" | "markdown";

/**
 * Rendering configuration options
 */
export interface RenderingConfig {
  readonly format: OutputFormat;
  readonly indent?: number;
  readonly sortKeys?: boolean;
  readonly prettyPrint?: boolean;
}

/**
 * Rendering context containing data and options
 */
export interface RenderingContext {
  readonly template: Template;
  readonly data: Record<string, unknown>;
  readonly config: RenderingConfig;
}

/**
 * Result of output rendering
 */
export interface RenderingResult {
  readonly content: string;
  readonly format: OutputFormat;
  readonly metadata: {
    readonly templatePath: string;
    readonly dataItemCount: number;
    readonly renderingTime: number;
  };
}

/**
 * Service for rendering templates with data into various output formats.
 * Follows totality principle with comprehensive error handling.
 */
export class OutputRenderingService {
  private constructor() {}

  /**
   * Creates an OutputRenderingService instance.
   */
  static create(): Result<OutputRenderingService, TemplateError> {
    return Result.ok(new OutputRenderingService());
  }

  /**
   * Renders a template with data to the specified output format.
   */
  render(context: RenderingContext): Result<RenderingResult, TemplateError> {
    const startTime = performance.now();

    try {
      // Validate rendering context
      const contextValidation = this.validateContext(context);
      if (contextValidation.isError()) {
        return Result.error(contextValidation.unwrapError());
      }

      // Resolve template variables with provided data
      const resolvedTemplate = context.template.resolveVariables(context.data);
      if (resolvedTemplate.isError()) {
        return Result.error(
          new TemplateError(
            `Template variable resolution failed: ${resolvedTemplate.unwrapError().message}`,
            "TEMPLATE_RESOLUTION_ERROR",
            { context },
          ),
        );
      }

      // Render content based on format
      const renderedContent = this.renderToFormat(
        resolvedTemplate.unwrap().getContent(),
        context.config,
      );
      if (renderedContent.isError()) {
        return Result.error(renderedContent.unwrapError());
      }

      const endTime = performance.now();
      const renderingTime = endTime - startTime;

      return Result.ok({
        content: renderedContent.unwrap(),
        format: context.config.format,
        metadata: {
          templatePath: context.template.getPath().toString(),
          dataItemCount: this.countDataItems(context.data),
          renderingTime,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new TemplateError(
          `Rendering failed: ${errorMessage}`,
          "RENDERING_ERROR",
          { context, error },
        ),
      );
    }
  }

  /**
   * Creates default rendering configuration for the specified format.
   */
  createDefaultConfig(format: OutputFormat): RenderingConfig {
    return {
      format,
      indent: 2,
      sortKeys: false,
      prettyPrint: true,
    };
  }

  /**
   * Renders content with provided data using a simplified interface.
   */
  renderSimple(
    template: Template,
    data: Record<string, unknown>,
    format: OutputFormat = "json",
  ): Result<string, TemplateError> {
    const config = this.createDefaultConfig(format);
    const context: RenderingContext = { template, data, config };

    const result = this.render(context);
    if (result.isError()) {
      return Result.error(result.unwrapError());
    }

    return Result.ok(result.unwrap().content);
  }

  /**
   * Validates the rendering context for completeness.
   */
  private validateContext(
    context: RenderingContext,
  ): Result<void, TemplateError> {
    if (!context.template) {
      return Result.error(
        new TemplateError(
          "Template is required for rendering",
          "INVALID_CONTEXT",
          { context },
        ),
      );
    }

    if (!context.data || typeof context.data !== "object") {
      return Result.error(
        new TemplateError(
          "Data must be a valid object for rendering",
          "INVALID_CONTEXT",
          { context },
        ),
      );
    }

    if (!context.config || !context.config.format) {
      return Result.error(
        new TemplateError(
          "Rendering configuration with format is required",
          "INVALID_CONTEXT",
          { context },
        ),
      );
    }

    return Result.ok(undefined);
  }

  /**
   * Renders content to the specified format.
   */
  private renderToFormat(
    content: Record<string, unknown>,
    config: RenderingConfig,
  ): Result<string, TemplateError> {
    try {
      switch (config.format) {
        case "json":
          return this.renderToJson(content, config);
        case "yaml":
          return this.renderToYaml(content, config);
        case "xml":
          return this.renderToXml(content, config);
        case "markdown":
          return this.renderToMarkdown(content, config);
        default: {
          const exhaustiveCheck: never = config.format;
          return Result.error(
            new TemplateError(
              `Unsupported output format: ${exhaustiveCheck}`,
              "UNSUPPORTED_FORMAT",
              { format: config.format },
            ),
          );
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new TemplateError(
          `Format rendering failed: ${errorMessage}`,
          "FORMAT_ERROR",
          { format: config.format, error },
        ),
      );
    }
  }

  /**
   * Renders content to JSON format.
   */
  private renderToJson(
    content: Record<string, unknown>,
    config: RenderingConfig,
  ): Result<string, TemplateError> {
    try {
      if (config.prettyPrint) {
        const indent = config.indent || 2;
        return Result.ok(JSON.stringify(content, null, indent));
      } else {
        return Result.ok(JSON.stringify(content));
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new TemplateError(
          `JSON rendering failed: ${errorMessage}`,
          "JSON_ERROR",
          { content, error },
        ),
      );
    }
  }

  /**
   * Renders content to YAML format.
   */
  private renderToYaml(
    content: Record<string, unknown>,
    config: RenderingConfig,
  ): Result<string, TemplateError> {
    try {
      // Use YAML.stringify from @std/yaml for proper YAML formatting
      const yamlResult = this.stringifyYaml(content, {
        indent: config.indent || 2,
        sortKeys: config.sortKeys || false,
      });
      return Result.ok(yamlResult);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new TemplateError(
          `YAML rendering failed: ${errorMessage}`,
          "YAML_ERROR",
          { content, error },
        ),
      );
    }
  }

  /**
   * YAML stringify implementation (simplified).
   * In production, would use @std/yaml library.
   */
  private stringifyYaml(
    obj: Record<string, unknown>,
    options: { indent: number; sortKeys: boolean },
  ): string {
    // Simplified YAML implementation for basic structures
    // In production, use proper YAML library
    const indent = " ".repeat(options.indent);

    const processValue = (value: unknown, depth = 0): string => {
      const currentIndent = indent.repeat(depth);

      if (value === null || value === undefined) {
        return "null";
      }

      if (typeof value === "string") {
        // Handle multi-line strings and special characters
        if (
          value.includes("\n") || value.includes(":") || value.includes("-")
        ) {
          return `"${value.replace(/"/g, '\\"')}"`;
        }
        return value;
      }

      if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }

      if (Array.isArray(value)) {
        if (value.length === 0) return "[]";
        const arrayLines = value.map((item) =>
          `${currentIndent}- ${processValue(item, depth + 1)}`
        );
        return "\n" + arrayLines.join("\n");
      }

      if (this.isObject(value)) {
        const keys = options.sortKeys
          ? Object.keys(value).sort()
          : Object.keys(value);

        if (keys.length === 0) return "{}";

        const objectLines = keys.map((key) => {
          const val = value[key];
          const processedValue = processValue(val, depth + 1);

          if (typeof val === "object" && val !== null && !Array.isArray(val)) {
            return `${currentIndent}${key}:${processedValue}`;
          } else if (Array.isArray(val) && val.length > 0) {
            return `${currentIndent}${key}:${processedValue}`;
          } else {
            return `${currentIndent}${key}: ${processedValue}`;
          }
        });

        return depth === 0
          ? objectLines.join("\n")
          : "\n" + objectLines.join("\n");
      }

      return String(value);
    };

    return processValue(obj);
  }

  /**
   * Counts the number of data items for metadata.
   */
  private countDataItems(data: Record<string, unknown>): number {
    let count = 0;

    const countRecursive = (obj: unknown): void => {
      if (Array.isArray(obj)) {
        count += obj.length;
        obj.forEach(countRecursive);
      } else if (this.isObject(obj)) {
        count += Object.keys(obj).length;
        Object.values(obj).forEach(countRecursive);
      }
    };

    countRecursive(data);
    return count;
  }

  /**
   * Renders content to XML format.
   */
  private renderToXml(
    content: Record<string, unknown>,
    config: RenderingConfig,
  ): Result<string, TemplateError> {
    try {
      const indent = config.indent || 2;
      const indentStr = " ".repeat(indent);

      const processValue = (value: unknown, depth = 0): string => {
        const currentIndent = indentStr.repeat(depth);

        if (value === null || value === undefined) {
          return "";
        }

        if (typeof value === "string") {
          return this.escapeXml(value);
        }

        if (typeof value === "number" || typeof value === "boolean") {
          return String(value);
        }

        if (Array.isArray(value)) {
          return value.map((item, index) =>
            `${currentIndent}<item index="${index}">${
              processValue(item, depth + 1)
            }</item>`
          ).join("\n");
        }

        if (this.isObject(value)) {
          const keys = config.sortKeys
            ? Object.keys(value).sort()
            : Object.keys(value);

          return keys.map((key) => {
            const val = value[key];
            const processedValue = processValue(val, depth + 1);

            if (this.isObject(val) || Array.isArray(val)) {
              return `${currentIndent}<${key}>\n${processedValue}\n${currentIndent}</${key}>`;
            } else {
              return `${currentIndent}<${key}>${processedValue}</${key}>`;
            }
          }).join("\n");
        }

        return String(value);
      };

      const xmlContent = processValue(content);
      const xmlOutput = config.prettyPrint
        ? `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n${xmlContent}\n</root>`
        : `<?xml version="1.0" encoding="UTF-8"?><root>${xmlContent}</root>`;

      return Result.ok(xmlOutput);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new TemplateError(
          `XML rendering failed: ${errorMessage}`,
          "XML_ERROR",
          { content, error },
        ),
      );
    }
  }

  /**
   * Renders content to Markdown format.
   */
  private renderToMarkdown(
    content: Record<string, unknown>,
    config: RenderingConfig,
  ): Result<string, TemplateError> {
    try {
      const processValue = (value: unknown, depth = 0): string => {
        const headerLevel = Math.min(depth + 1, 6);
        const headerPrefix = "#".repeat(headerLevel);

        if (value === null || value === undefined) {
          return "*null*";
        }

        if (typeof value === "string") {
          return value;
        }

        if (typeof value === "number" || typeof value === "boolean") {
          return String(value);
        }

        if (Array.isArray(value)) {
          return value.map((item) => {
            if (this.isObject(item) || Array.isArray(item)) {
              return `- ${processValue(item, depth + 1)}`;
            } else {
              return `- ${processValue(item, depth)}`;
            }
          }).join("\n");
        }

        if (this.isObject(value)) {
          const keys = config.sortKeys
            ? Object.keys(value).sort()
            : Object.keys(value);

          return keys.map((key) => {
            const val = value[key];
            const processedValue = processValue(val, depth + 1);

            if (this.isObject(val) || Array.isArray(val)) {
              return `${headerPrefix} ${key}\n\n${processedValue}`;
            } else {
              return `**${key}**: ${processedValue}`;
            }
          }).join("\n\n");
        }

        return String(value);
      };

      const markdownContent = processValue(content);
      return Result.ok(markdownContent);
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new TemplateError(
          `Markdown rendering failed: ${errorMessage}`,
          "MARKDOWN_ERROR",
          { content, error },
        ),
      );
    }
  }

  /**
   * Escapes XML special characters.
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Type guard to check if a value is a plain object.
   */
  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" &&
      value !== null &&
      !Array.isArray(value);
  }
}
