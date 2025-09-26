/**
 * @fileoverview Template Directive Handler
 * @description Handles x-template directive processing following DDD and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { Schema } from "../entities/schema.ts";
import { defaultSchemaExtensionRegistry } from "../value-objects/schema-extension-registry.ts";
import {
  BaseDirectiveHandler,
  DirectiveConfig,
  DirectiveHandlerError,
  DirectiveHandlerFactory,
  DirectiveProcessingResult,
  ExtensionExtractionResult,
  LegacySchemaProperty,
} from "../interfaces/directive-handler.ts";

/**
 * Template directive configuration
 */
interface TemplateConfig {
  readonly templateString: string;
}

/**
 * Template directive processing metadata
 */
interface TemplateMetadata {
  readonly templateApplied: boolean;
  readonly variablesFound: readonly string[];
}

/**
 * Template Directive Handler
 *
 * Processes x-template directives that define template strings for data rendering.
 * Following DDD and Totality principles:
 * - Smart Constructor pattern
 * - Result<T,E> for all operations
 * - No exceptions or undefined behavior
 */
export class TemplateDirectiveHandler
  extends BaseDirectiveHandler<TemplateConfig, TemplateMetadata> {
  private constructor() {
    super("template", 8, []); // Priority 8: Template Processing
  }

  /**
   * Smart Constructor following Totality principles
   */
  static create(): Result<TemplateDirectiveHandler, DirectiveHandlerError> {
    return ok(new TemplateDirectiveHandler());
  }

  /**
   * Extract template configuration from legacy schema
   * Handles both extensions object and direct property
   */
  extractConfig(
    schema: LegacySchemaProperty,
  ): Result<DirectiveConfig<TemplateConfig>, DirectiveHandlerError> {
    let templateString: string | undefined;

    // Check extensions object first (legacy format)
    if (schema.extensions && typeof schema.extensions === "object") {
      const extensions = schema.extensions as Record<string, unknown>;
      if (extensions["x-template"] !== undefined) {
        if (typeof extensions["x-template"] === "string") {
          templateString = extensions["x-template"];
        } else {
          return err({
            kind: "ValidationError",
            directiveName: this.directiveName,
            message:
              `Invalid template: expected string but got ${typeof extensions[
                "x-template"
              ]}`,
            invalidValue: extensions["x-template"],
          });
        }
      }
    }

    // Check direct property (standard JSON Schema extension pattern)
    // Takes precedence over extensions object
    if (schema["x-template"] !== undefined) {
      if (typeof schema["x-template"] === "string") {
        templateString = schema["x-template"];
      } else {
        return err({
          kind: "ValidationError",
          directiveName: this.directiveName,
          message: `Invalid template: expected string but got ${typeof schema[
            "x-template"
          ]}`,
          invalidValue: schema["x-template"],
        });
      }
    }

    if (templateString === undefined) {
      return DirectiveHandlerFactory.createConfig(
        this.directiveName,
        { templateString: "" },
        false,
      );
    }

    // Validate template syntax
    if (!this.isValidTemplate(templateString)) {
      return err({
        kind: "ValidationError",
        directiveName: this.directiveName,
        message: `Invalid template syntax: ${templateString}`,
        invalidValue: templateString,
      });
    }

    return DirectiveHandlerFactory.createConfig(
      this.directiveName,
      { templateString },
      true,
    );
  }

  /**
   * Process data using template configuration
   * Note: Actual template processing implementation depends on template engine
   */
  processData(
    data: FrontmatterData,
    config: DirectiveConfig<TemplateConfig>,
    _schema: Schema,
  ): Result<
    DirectiveProcessingResult<TemplateMetadata>,
    DirectiveHandlerError
  > {
    if (!config.isPresent || !config.configuration.templateString) {
      return DirectiveHandlerFactory.createResult(
        this.directiveName,
        data,
        {
          templateApplied: false,
          variablesFound: [],
        },
      );
    }

    try {
      // Template processing placeholder
      // In actual implementation, this would:
      // 1. Parse template string for variables
      // 2. Apply template engine (handlebars, mustache, etc.)
      // 3. Replace variables with data values
      // 4. Return processed data

      const variablesFound = this.extractTemplateVariables(
        config.configuration.templateString,
      );

      // For now, return original data with metadata
      return DirectiveHandlerFactory.createResult(
        this.directiveName,
        data,
        {
          templateApplied: true,
          variablesFound,
        },
      );
    } catch (error) {
      return err({
        kind: "ProcessingError",
        directiveName: this.directiveName,
        message: `Template processing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        cause: {
          kind: "ConfigurationError",
          message: error instanceof Error ? error.message : String(error),
        } as DomainError,
      });
    }
  }

  /**
   * Extract extension key-value pair for schema building
   * Following Totality principles with discriminated union result
   */
  extractExtension(
    schema: LegacySchemaProperty,
  ): Result<ExtensionExtractionResult, DirectiveHandlerError> {
    const configResult = this.extractConfig(schema);
    if (!configResult.ok) {
      return configResult;
    }

    const config = configResult.data;
    if (!config.isPresent) {
      return ok({
        kind: "ExtensionNotApplicable",
        reason: "No x-template directive found in schema",
      });
    }

    const registry = defaultSchemaExtensionRegistry;
    const key = registry.getTemplateKey().getValue();

    return ok({
      kind: "ExtensionFound",
      key,
      value: config.configuration.templateString,
    });
  }

  /**
   * Extract template variables from template string
   * Supports common template syntaxes: {{variable}}, ${variable}, {variable}
   */
  private extractTemplateVariables(templateString: string): readonly string[] {
    const variables = new Set<string>();

    // Match {{variable}} syntax (Handlebars/Mustache)
    const handlebarsMatches = templateString.match(/\{\{([^}]+)\}\}/g);
    if (handlebarsMatches) {
      for (const match of handlebarsMatches) {
        const variable = match.replace(/\{\{|\}\}/g, "").trim();
        if (variable) {
          variables.add(variable);
        }
      }
    }

    // Match ${variable} syntax (JavaScript template literals)
    const jsTemplateMatches = templateString.match(/\$\{([^}]+)\}/g);
    if (jsTemplateMatches) {
      for (const match of jsTemplateMatches) {
        const variable = match.replace(/\$\{|\}/g, "").trim();
        if (variable) {
          variables.add(variable);
        }
      }
    }

    // Match {variable} syntax (simple templating)
    const simpleMatches = templateString.match(/\{([^}]+)\}/g);
    if (simpleMatches) {
      for (const match of simpleMatches) {
        const variable = match.replace(/\{|\}/g, "").trim();
        if (variable && !variable.includes("{") && !variable.includes("}")) {
          variables.add(variable);
        }
      }
    }

    return Array.from(variables).sort();
  }

  /**
   * Validate template syntax
   * Checks for balanced braces in template variables
   */
  private isValidTemplate(templateString: string): boolean {
    if (!templateString || templateString.trim() === "") {
      return true; // Empty templates are valid
    }

    // Check for balanced braces in simple {variable} syntax
    const openBraces = (templateString.match(/\{/g) || []).length;
    const closeBraces = (templateString.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      return false;
    }

    // Check for nested braces which are invalid in simple templating
    // This regex matches invalid patterns like {{variable}} or {nested{var}}
    if (/\{\{|\}\}/.test(templateString) && !/\$\{/.test(templateString)) {
      return false;
    }

    // Check for malformed variable patterns
    const bracePatterns = templateString.match(/\{[^}]*\}/g) || [];
    for (const pattern of bracePatterns) {
      const content = pattern.slice(1, -1).trim();
      if (content === "" || content.includes("{") || content.includes("}")) {
        return false;
      }
    }

    return true;
  }
}
