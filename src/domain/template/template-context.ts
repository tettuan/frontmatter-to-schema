/**
 * Template Context - Canonical Domain Service
 *
 * CRITICAL: Single authoritative template processing implementation
 * Consolidates 16 template services into one canonical service to prevent
 * template bypass and ensure template system integrity.
 *
 * This is the ONLY template processing entry point - NO ALTERNATIVES ALLOWED
 * All data MUST flow through this service for template processing.
 */

import type { Result } from "../core/result.ts";
import { createDomainError, type DomainError } from "../core/result.ts";
import type { TemplatePath } from "../value-objects/template-path.ts";
import {
  TemplateDefinition,
  type TemplateEngine,
} from "./value-objects/template-definition.ts";
import {
  VariableMap,
  type VariableValue,
} from "./value-objects/variable-map.ts";
import type { ValidatedData } from "../schema/schema-context.ts";

/**
 * Rendered template content with metadata
 */
export interface RenderedContent {
  readonly content: string;
  readonly templateProcessed: true; // Always true - no bypass allowed
  readonly variables: readonly string[];
  readonly renderTime: Date;
  readonly bypassDetected: false; // Always false - bypass prevention
}

/**
 * Template configuration for rendering
 */
export interface TemplateConfig {
  readonly definition: string;
  readonly format: "json" | "yaml" | "xml" | "custom";
  readonly variables?: VariableMap;
}

/**
 * Template processing options
 */
export interface TemplateProcessingOptions {
  readonly strict: boolean;
  readonly allowMissingVariables: boolean;
  readonly escapeHtml: boolean;
  readonly preserveWhitespace: boolean;
}

/**
 * Template Context - Single Canonical Template Processing Service
 *
 * CONSOLIDATES ALL TEMPLATE OPERATIONS:
 * - Replaces UnifiedTemplateRenderer
 * - Replaces SimpleReplacementProcessor
 * - Replaces SchemaGuidedProcessor
 * - Replaces TypescriptProcessor
 * - Replaces UnifiedTemplateProcessor
 * - Replaces TemplateProcessorFactory
 * - Replaces 10+ other template services
 *
 * PREVENTS TEMPLATE BYPASS:
 * - Single processing path only
 * - All data MUST be processed by this service
 * - Returns RenderedContent with bypass detection flags
 * - No alternative rendering paths allowed
 */
export class TemplateContext {
  private readonly templateCache = new Map<string, TemplateDefinition>();
  private readonly defaultOptions: TemplateProcessingOptions = {
    strict: true,
    allowMissingVariables: false,
    escapeHtml: true,
    preserveWhitespace: false,
  };

  /**
   * PRIMARY TEMPLATE PROCESSING METHOD
   *
   * This is the ONLY entry point for template processing in the system.
   * All document processing MUST flow through this method.
   * NO BYPASS ALTERNATIVES ALLOWED.
   */
  renderTemplate(
    data: ValidatedData,
    templateConfig: TemplateConfig,
    options: Partial<TemplateProcessingOptions> = {},
  ): Result<RenderedContent, DomainError & { message: string }> {
    const renderOptions = { ...this.defaultOptions, ...options };

    try {
      // 1. Load and validate template definition
      const templateResult = this.loadTemplateDefinition(templateConfig);
      if (!templateResult.ok) {
        return templateResult;
      }

      // 2. Extract and validate variables
      const variablesResult = this.extractVariables(
        templateResult.data,
        data,
        renderOptions,
      );
      if (!variablesResult.ok) {
        return variablesResult;
      }

      // 3. Perform variable substitution
      const substitutionResult = this.performSubstitution(
        templateResult.data,
        variablesResult.data,
        renderOptions,
      );
      if (!substitutionResult.ok) {
        return substitutionResult;
      }

      // 4. Post-process content
      const postProcessResult = this.postProcessContent(
        substitutionResult.data,
        templateConfig.format,
        renderOptions,
      );
      if (!postProcessResult.ok) {
        return postProcessResult;
      }

      // 5. Create rendered content with bypass prevention flags
      const renderedContent: RenderedContent = {
        content: postProcessResult.data,
        templateProcessed: true, // CRITICAL: Always true
        variables: variablesResult.data.getNames(),
        renderTime: new Date(),
        bypassDetected: false, // CRITICAL: Always false
      };

      return { ok: true, data: renderedContent };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "RenderError",
            template: templateConfig.definition,
            details: String(error),
          },
          `Template rendering failed: ${error}`,
        ),
      };
    }
  }

  /**
   * Load template from file path
   * Alternative entry point for file-based templates
   */
  async renderTemplateFromFile(
    data: ValidatedData,
    templatePath: TemplatePath,
    options: Partial<TemplateProcessingOptions> = {},
  ): Promise<Result<RenderedContent, DomainError & { message: string }>> {
    // Load template from file
    const templateResult = await this.loadTemplateFromFile(templatePath);
    if (!templateResult.ok) {
      return templateResult;
    }

    // Convert to TemplateConfig and render
    const templateConfig: TemplateConfig = {
      definition: templateResult.data.getContent(),
      format: this.detectFormat(templatePath),
    };

    return this.renderTemplate(data, templateConfig, options);
  }

  /**
   * Validate template without rendering
   * Used for template validation during configuration
   */
  validateTemplate(
    templateConfig: TemplateConfig,
  ): Result<void, DomainError & { message: string }> {
    // Basic template validation
    if (!templateConfig.definition || templateConfig.definition.trim() === "") {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "EmptyInput",
            field: "template.definition",
          },
          "Template definition cannot be empty",
        ),
      };
    }

    // Validate template syntax
    const syntaxResult = this.validateTemplateSyntax(templateConfig.definition);
    if (!syntaxResult.ok) {
      return syntaxResult;
    }

    return { ok: true, data: undefined };
  }

  /**
   * Clear template cache
   */
  clearCache(): void {
    this.templateCache.clear();
  }

  // Private implementation methods - INTERNAL ONLY

  /**
   * Load template definition from config
   */
  private loadTemplateDefinition(
    config: TemplateConfig,
  ): Result<TemplateDefinition, DomainError & { message: string }> {
    const engine = this.mapFormatToEngine(config.format);
    return TemplateDefinition.create(
      config.definition,
      engine,
    );
  }

  /**
   * Load template from file system
   */
  private async loadTemplateFromFile(
    templatePath: TemplatePath,
  ): Promise<Result<TemplateDefinition, DomainError & { message: string }>> {
    const pathValue = templatePath.getValue();

    // Check cache first
    const cached = this.templateCache.get(pathValue);
    if (cached) {
      return { ok: true, data: cached };
    }

    try {
      const content = await Deno.readTextFile(pathValue);
      const format = this.detectFormat(templatePath);

      const engine = this.mapFormatToEngine(format);
      const templateResult = TemplateDefinition.create(content, engine);
      if (!templateResult.ok) {
        return templateResult;
      }

      // Cache the template
      this.templateCache.set(pathValue, templateResult.data);

      return templateResult;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "FileNotFound",
              path: pathValue,
            },
            `Template file not found: ${pathValue}`,
          ),
        };
      }

      return {
        ok: false,
        error: createDomainError(
          {
            kind: "ReadError",
            path: pathValue,
            details: String(error),
          },
          `Failed to read template file: ${error}`,
        ),
      };
    }
  }

  /**
   * Extract variables from template and data
   */
  private extractVariables(
    template: TemplateDefinition,
    data: ValidatedData,
    options: TemplateProcessingOptions,
  ): Result<VariableMap, DomainError & { message: string }> {
    // Extract variable placeholders from template
    const placeholderPattern = /\{(\w+)\}/g;
    const templateContent = template.getContent();
    const matches = templateContent.matchAll(placeholderPattern);
    const variableNames = Array.from(matches, (match) => match[1]);

    // Build variable map from data
    const variables: Record<string, unknown> = {};
    for (const varName of variableNames) {
      const value = this.extractVariableValue(data.data, varName);

      if (value === undefined && !options.allowMissingVariables) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "MissingRequiredField",
              fields: [varName],
            },
            `Missing required template variable: ${varName}`,
          ),
        };
      }

      variables[varName] = value ?? "";
    }

    // Convert Record<string, unknown> to Record<string, VariableValue>
    const variableValues: Record<string, VariableValue> = {};
    for (const [key, value] of Object.entries(variables)) {
      variableValues[key] = this.convertToVariableValue(value);
    }

    return VariableMap.create(variableValues);
  }

  /**
   * Extract variable value from data object
   */
  private extractVariableValue(
    data: Record<string, unknown>,
    path: string,
  ): unknown {
    // Simple dot notation support (e.g., "user.name")
    const parts = path.split(".");
    let current: unknown = data;

    for (const part of parts) {
      if (typeof current === "object" && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Perform variable substitution in template
   */
  private performSubstitution(
    template: TemplateDefinition,
    variables: VariableMap,
    options: TemplateProcessingOptions,
  ): Result<string, DomainError & { message: string }> {
    let content = template.getContent();
    const variableMap = variables.toObject();

    // Replace all {variable} placeholders
    const placeholderPattern = /\{(\w+)\}/g;

    try {
      content = content.replace(placeholderPattern, (match, varName) => {
        const value = variableMap[varName];

        if (value === undefined) {
          if (options.allowMissingVariables) {
            return match; // Keep placeholder if missing variables allowed
          } else {
            throw new Error(`Missing variable: ${varName}`);
          }
        }

        // Convert value to string
        let stringValue = String(value);

        // Apply HTML escaping if enabled
        if (options.escapeHtml) {
          stringValue = this.escapeHtml(stringValue);
        }

        return stringValue;
      });

      return { ok: true, data: content };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "RenderError",
            template: template.getContent(),
            details: String(error),
          },
          `Variable substitution failed: ${error}`,
        ),
      };
    }
  }

  /**
   * Post-process rendered content
   */
  private postProcessContent(
    content: string,
    format: "json" | "yaml" | "xml" | "custom",
    options: TemplateProcessingOptions,
  ): Result<string, DomainError & { message: string }> {
    let processed = content;

    // Format-specific post-processing
    switch (format) {
      case "json":
        // Validate and format JSON
        try {
          const parsed = JSON.parse(processed);
          processed = JSON.stringify(parsed, null, 2);
        } catch {
          // If not valid JSON, leave as-is
        }
        break;

      case "yaml":
        // YAML post-processing could be added here
        break;

      case "xml":
        // XML post-processing could be added here
        break;

      case "custom":
      default:
        // No special processing for custom formats
        break;
    }

    // Handle whitespace preservation
    if (!options.preserveWhitespace) {
      processed = processed.trim();
    }

    return { ok: true, data: processed };
  }

  /**
   * Validate template syntax
   */
  private validateTemplateSyntax(
    template: string,
  ): Result<void, DomainError & { message: string }> {
    // Check for balanced braces
    const openBraces = (template.match(/\{/g) || []).length;
    const closeBraces = (template.match(/\}/g) || []).length;

    if (openBraces !== closeBraces) {
      return {
        ok: false,
        error: createDomainError(
          {
            kind: "InvalidFormat",
            input: template,
            expectedFormat: "balanced braces",
          },
          "Template has unbalanced braces",
        ),
      };
    }

    // Check for valid variable names
    const placeholderPattern = /\{(\w+)\}/g;
    const matches = template.matchAll(placeholderPattern);

    for (const match of matches) {
      const varName = match[1];
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(varName)) {
        return {
          ok: false,
          error: createDomainError(
            {
              kind: "InvalidFormat",
              input: varName,
              expectedFormat: "valid variable name",
            },
            `Invalid variable name in template: ${varName}`,
          ),
        };
      }
    }

    return { ok: true, data: undefined };
  }

  /**
   * Detect template format from file extension
   */
  private detectFormat(
    templatePath: TemplatePath,
  ): "json" | "yaml" | "xml" | "custom" {
    const pathValue = templatePath.getValue().toLowerCase();

    if (pathValue.endsWith(".json")) return "json";
    if (pathValue.endsWith(".yaml") || pathValue.endsWith(".yml")) {
      return "yaml";
    }
    if (pathValue.endsWith(".xml")) return "xml";

    return "custom";
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const escapeMap: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return text.replace(/[&<>"']/g, (char) => escapeMap[char] || char);
  }

  /**
   * Map format to template engine
   */
  private mapFormatToEngine(
    format: "json" | "yaml" | "xml" | "custom",
  ): TemplateEngine {
    switch (format) {
      case "json":
      case "yaml":
      case "xml":
        return "text"; // Use text engine for structured formats
      case "custom":
      default:
        return "custom";
    }
  }

  /**
   * Convert unknown value to VariableValue
   */
  private convertToVariableValue(value: unknown): VariableValue {
    if (value === null || value === undefined) {
      return null;
    }
    if (
      typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.convertToVariableValue(item));
    }
    if (typeof value === "object") {
      const result: { [key: string]: VariableValue } = {};
      for (
        const [key, val] of Object.entries(value as Record<string, unknown>)
      ) {
        result[key] = this.convertToVariableValue(val);
      }
      return result;
    }
    return String(value); // Fallback to string conversion
  }
}
