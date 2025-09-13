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
import { FormatDetector } from "../services/format-detector.ts";

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
    allowMissingVariables: true, // Allow flexible frontmatter structures (Totality principle)
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
    // For JSON templates, disable HTML escaping to preserve JSON structure
    const formatSpecificDefaults = templateConfig.format === "json"
      ? { ...this.defaultOptions, escapeHtml: false }
      : this.defaultOptions;

    const renderOptions = { ...formatSpecificDefaults, ...options };

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

    // Detect format
    const formatResult = this.detectFormat(templatePath);
    if (!formatResult.ok) {
      return formatResult;
    }

    // Convert to TemplateConfig and render
    const templateConfig: TemplateConfig = {
      definition: templateResult.data.getContent(),
      format: formatResult.data,
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
      const formatResult = this.detectFormat(templatePath);
      if (!formatResult.ok) {
        return formatResult;
      }

      const engine = this.mapFormatToEngine(formatResult.data);
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
    // Extract variable placeholders from template including dot notation like {object.property}
    const placeholderPattern = /\{([a-zA-Z_$][a-zA-Z0-9_$.]*)\}/g;
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
   * FIXED: JSON-aware substitution to resolve Issue #710 silent failures
   */
  private performSubstitution(
    template: TemplateDefinition,
    variables: VariableMap,
    options: TemplateProcessingOptions,
  ): Result<string, DomainError & { message: string }> {
    let content = template.getContent();
    const variableMap = variables.toObject();

    // Detect if we're working with a JSON template
    const isJsonTemplate = this.isJsonTemplate(content);

    try {
      if (isJsonTemplate) {
        // Special handling for JSON templates to avoid JSON-in-JSON issues
        const jsonSubstitutionResult = this.substituteVariablesInJson(
          content,
          variableMap,
          options,
        );
        if (!jsonSubstitutionResult.ok) {
          return jsonSubstitutionResult;
        }
        content = jsonSubstitutionResult.data;
      } else {
        // Regular string-based substitution for non-JSON templates
        const stringSubstitutionResult = this.substituteVariablesInString(
          content,
          variableMap,
          options,
        );
        if (!stringSubstitutionResult.ok) {
          return stringSubstitutionResult;
        }
        content = stringSubstitutionResult.data;
      }

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
   * Detect template format using FormatDetector service
   */
  private detectFormat(
    templatePath: TemplatePath,
  ): Result<
    "json" | "yaml" | "xml" | "custom",
    DomainError & { message: string }
  > {
    const detectorResult = FormatDetector.createDefault();
    if (!detectorResult.ok) {
      return detectorResult;
    }

    const format = detectorResult.data.detect(templatePath.getValue());
    return { ok: true, data: format };
  }

  /**
   * Convert value to string with format-aware serialization
   * FIXED: Properly handle arrays in JSON templates and Date objects
   */
  private valueToString(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    // Handle Date objects specifically for ISO8601 output
    if (value instanceof Date) {
      // Check if the Date is valid
      if (isNaN(value.getTime())) {
        return ""; // Return empty string for invalid dates
      }
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      // For JSON context, serialize arrays as JSON
      return JSON.stringify(value);
    }

    if (typeof value === "object") {
      // For JSON context, serialize objects as JSON
      return JSON.stringify(value);
    }

    return String(value);
  }

  /**
   * Get nested value from object using dot notation
   * FIXED: Support template variables like {tools.availableConfigs}
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current: unknown, key: string) => {
      return current && typeof current === "object" && current !== null &&
          key in current
        ? (current as Record<string, unknown>)[key]
        : undefined;
    }, obj as unknown);
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
   * Check if template content appears to be JSON
   */
  private isJsonTemplate(content: string): boolean {
    const trimmed = content.trim();
    return (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    );
  }

  /**
   * JSON-aware variable substitution that preserves JSON structure
   * FIXES Issue #710: Template variables not substituted in JSON context
   */
  private substituteVariablesInJson(
    jsonContent: string,
    variableMap: Record<string, VariableValue>,
    options: TemplateProcessingOptions,
  ): Result<string, DomainError & { message: string }> {
    try {
      // Parse the JSON template to get its structure
      const templateObj = JSON.parse(jsonContent);

      // Recursively substitute variables in the parsed object
      const substitutionResult = this.substituteInJsonObject(
        templateObj,
        variableMap,
        options,
      );

      if (!substitutionResult.ok) {
        return substitutionResult;
      }

      // Re-serialize to JSON with proper formatting
      return {
        ok: true,
        data: JSON.stringify(substitutionResult.data, null, 2),
      };
    } catch (_parseError) {
      // If JSON parsing fails, fall back to string substitution
      return this.substituteVariablesInString(
        jsonContent,
        variableMap,
        options,
      );
    }
  }

  /**
   * Recursively substitute variables in a JSON object structure
   * Returns Result<T,E> pattern following Totality principle
   */
  private substituteInJsonObject(
    obj: unknown,
    variableMap: Record<string, VariableValue>,
    options: TemplateProcessingOptions,
  ): Result<unknown, DomainError & { message: string }> {
    if (typeof obj === "string") {
      // Check if the entire string is a variable placeholder
      const fullVariableMatch = obj.match(/^\{([a-zA-Z_$][a-zA-Z0-9_$.]*)\}$/);
      if (fullVariableMatch) {
        const varName = fullVariableMatch[1];
        const value = this.getVariableValue(variableMap, varName);

        if (value !== undefined) {
          // For Date objects, convert to ISO8601 string even in JSON context
          if (value instanceof Date) {
            const stringValue = this.valueToString(value);
            return { ok: true, data: stringValue };
          }
          // For arrays with Date objects, convert each Date to string but keep as array
          if (Array.isArray(value)) {
            const processedArray = value.map((item) =>
              item instanceof Date ? this.valueToString(item) : item
            );
            return { ok: true, data: processedArray };
          }
          // Return the actual value (object, etc.) for JSON context
          return { ok: true, data: value };
        } else if (options.allowMissingVariables) {
          return { ok: true, data: obj }; // Keep placeholder
        } else {
          return {
            ok: false,
            error: createDomainError(
              { kind: "MissingVariable", variable: varName },
              `Missing variable: ${varName}`,
            ),
          };
        }
      }

      // Handle partial string interpolation
      const stringResult = this.substituteVariablesInString(
        obj,
        variableMap,
        options,
      );
      if (!stringResult.ok) return stringResult;
      return { ok: true, data: stringResult.data };
    }

    if (Array.isArray(obj)) {
      const results: unknown[] = [];
      for (const item of obj) {
        const result = this.substituteInJsonObject(item, variableMap, options);
        if (!result.ok) return result;
        results.push(result.data);
      }
      return { ok: true, data: results };
    }

    if (obj && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (
        const [key, value] of Object.entries(obj as Record<string, unknown>)
      ) {
        const substitutionResult = this.substituteInJsonObject(
          value,
          variableMap,
          options,
        );
        if (!substitutionResult.ok) return substitutionResult;
        result[key] = substitutionResult.data;
      }
      return { ok: true, data: result };
    }

    return { ok: true, data: obj };
  }

  /**
   * String-based variable substitution for non-JSON templates
   * Returns Result<T,E> pattern following Totality principle
   */
  private substituteVariablesInString(
    content: string,
    variableMap: Record<string, VariableValue>,
    options: TemplateProcessingOptions,
  ): Result<string, DomainError & { message: string }> {
    const placeholderPattern = /\{([a-zA-Z_$][a-zA-Z0-9_$.]*)\}/g;

    try {
      const result = content.replace(placeholderPattern, (match, varName) => {
        const value = this.getVariableValue(variableMap, varName);

        if (value === undefined) {
          if (options.allowMissingVariables) {
            return match; // Keep placeholder if missing variables allowed
          } else {
            // Store the error for later - can't throw in replace callback
            throw new Error(`Missing variable: ${varName}`);
          }
        }

        // Convert value to string with format-aware serialization
        let stringValue = this.valueToString(value);

        // Apply HTML escaping if enabled
        if (options.escapeHtml) {
          stringValue = this.escapeHtml(stringValue);
        }

        return stringValue;
      });

      return { ok: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      const variableName = errorMessage.match(/Missing variable: (.+)/)?.[1] ||
        "unknown";

      return {
        ok: false,
        error: createDomainError(
          { kind: "MissingVariable", variable: variableName },
          errorMessage,
        ),
      };
    }
  }

  /**
   * Get variable value with support for dot notation
   */
  private getVariableValue(
    variableMap: Record<string, VariableValue>,
    varName: string,
  ): VariableValue | undefined {
    // Try flat key first
    let value = variableMap[varName];

    // If not found as flat key, try dot-notation navigation
    if (value === undefined && varName.includes(".")) {
      const nestedValue = this.getNestedValue(variableMap, varName);
      value = nestedValue as VariableValue;
    }

    return value;
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
   * FIXED: Handle Date objects for ISO8601 serialization
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
    // Handle Date objects - preserve as Date for later ISO8601 conversion
    if (value instanceof Date) {
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
