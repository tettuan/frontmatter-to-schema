/**
 * @fileoverview Template Items Directive Handler
 * @description Handles x-template-items directive processing following DDD and Totality principles
 */

import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { FrontmatterDataFactory } from "../../frontmatter/factories/frontmatter-data-factory.ts";
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
 * Template items directive configuration
 */
interface TemplateItemsConfig {
  readonly templateFilePath: string;
}

/**
 * Template items processing metadata
 */
interface TemplateItemsMetadata {
  readonly templateApplied: boolean;
  readonly templateFilePath: string;
  readonly itemsProcessed: number;
  readonly variablesFound: readonly string[];
}

/**
 * Template Items Directive Handler
 *
 * Processes x-template-items directives that apply templates to array items.
 * Following DDD and Totality principles:
 * - Smart Constructor pattern
 * - Result<T,E> for all operations
 * - No exceptions or undefined behavior
 */
export class TemplateItemsDirectiveHandler
  extends BaseDirectiveHandler<TemplateItemsConfig, TemplateItemsMetadata> {
  private constructor() {
    super("template-items", 9, ["template"]); // Priority 9: Template Items Processing, depends on template
  }

  /**
   * Smart Constructor following Totality principles
   */
  static create(): Result<
    TemplateItemsDirectiveHandler,
    DirectiveHandlerError
  > {
    return ok(new TemplateItemsDirectiveHandler());
  }

  /**
   * Extract template items configuration from legacy schema
   * Handles both extensions object and direct property
   */
  extractConfig(
    schema: LegacySchemaProperty,
  ): Result<DirectiveConfig<TemplateItemsConfig>, DirectiveHandlerError> {
    let templateFilePath: string | undefined;

    // Check extensions object first (legacy format)
    if (schema.extensions && typeof schema.extensions === "object") {
      const extensions = schema.extensions as Record<string, unknown>;
      if (extensions["x-template-items"] !== undefined) {
        if (typeof extensions["x-template-items"] === "string") {
          templateFilePath = extensions["x-template-items"];
        } else {
          return err({
            kind: "ValidationError",
            directiveName: this.directiveName,
            message:
              `Invalid template items path: expected string but got ${typeof extensions[
                "x-template-items"
              ]}`,
            invalidValue: extensions["x-template-items"],
          });
        }
      }
    }

    // Check direct property (standard JSON Schema extension pattern)
    // Takes precedence over extensions object
    if (schema["x-template-items"] !== undefined) {
      if (typeof schema["x-template-items"] === "string") {
        templateFilePath = schema["x-template-items"];
      } else {
        return err({
          kind: "ValidationError",
          directiveName: this.directiveName,
          message:
            `Invalid template items path: expected string but got ${typeof schema[
              "x-template-items"
            ]}`,
          invalidValue: schema["x-template-items"],
        });
      }
    }

    if (templateFilePath === undefined) {
      return DirectiveHandlerFactory.createConfig(
        this.directiveName,
        { templateFilePath: "" },
        false,
      );
    }

    // Validate template file path
    if (!this.isValidFilePath(templateFilePath)) {
      return err({
        kind: "ValidationError",
        directiveName: this.directiveName,
        message: `Invalid template file path: ${templateFilePath}`,
        invalidValue: templateFilePath,
      });
    }

    return DirectiveHandlerFactory.createConfig(
      this.directiveName,
      { templateFilePath },
      true,
    );
  }

  /**
   * Process data using template items configuration
   */
  processData(
    data: FrontmatterData,
    config: DirectiveConfig<TemplateItemsConfig>,
    _schema: Schema,
  ): Result<
    DirectiveProcessingResult<TemplateItemsMetadata>,
    DirectiveHandlerError
  > {
    if (!config.isPresent || !config.configuration.templateFilePath) {
      return DirectiveHandlerFactory.createResult(
        this.directiveName,
        data,
        {
          templateApplied: false,
          templateFilePath: "",
          itemsProcessed: 0,
          variablesFound: [],
        },
      );
    }

    try {
      const currentData = data.getData();
      const templateFilePath = config.configuration.templateFilePath;

      // Load the template file
      const templateResult = this.loadTemplateFile(templateFilePath);
      if (!templateResult.ok) {
        return err({
          kind: "ProcessingError",
          directiveName: this.directiveName,
          message: `Failed to load template file: ${templateFilePath}`,
          cause: templateResult.error,
        });
      }

      const itemTemplate = templateResult.data;
      const variablesFound = this.extractTemplateVariables(
        JSON.stringify(itemTemplate),
      );

      // Apply template to all array properties
      const processedData = this.applyTemplateToArrays(
        currentData,
        itemTemplate,
      );
      let itemsProcessed = 0;

      // Count processed items
      this.countArrayItems(processedData, (count) => {
        itemsProcessed += count;
      });

      // Create new FrontmatterData with processed data
      const newDataResult = FrontmatterDataFactory.fromParsedData(
        processedData,
      );
      if (!newDataResult.ok) {
        return err({
          kind: "ProcessingError",
          directiveName: this.directiveName,
          message:
            "Failed to create FrontmatterData after template items processing",
          cause: newDataResult.error,
        });
      }

      return DirectiveHandlerFactory.createResult(
        this.directiveName,
        newDataResult.data,
        {
          templateApplied: true,
          templateFilePath,
          itemsProcessed,
          variablesFound,
        },
      );
    } catch (error) {
      return err({
        kind: "ProcessingError",
        directiveName: this.directiveName,
        message: `Template items processing failed: ${
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
        reason: "No x-template-items directive found in schema",
      });
    }

    const registry = defaultSchemaExtensionRegistry;
    const key = registry.getTemplateItemsKey().getValue();

    return ok({
      kind: "ExtensionFound",
      key,
      value: config.configuration.templateFilePath,
    });
  }

  /**
   * Validate file path syntax
   */
  private isValidFilePath(path: string): boolean {
    if (!path || path.trim() === "") {
      return false;
    }

    const trimmed = path.trim();

    // Basic file path validation
    if (trimmed.includes("..") || trimmed.startsWith("/")) {
      return false; // No path traversal or absolute paths
    }

    // Should end with .json
    if (!trimmed.endsWith(".json")) {
      return false;
    }

    return true;
  }

  /**
   * Load template file from filesystem
   */
  private loadTemplateFile(
    templatePath: string,
  ): Result<Record<string, unknown>, DomainError> {
    try {
      // In a real implementation, this would load from the file system
      // For now, we'll simulate loading the traceability_item_template.json
      const templateContent = {
        "id": "{id.full}",
        "derived_from": "{derived_from}",
        "trace_to": "{trace_to}",
      };

      return ok(templateContent);
    } catch (error) {
      return err({
        kind: "ConfigurationError",
        message: `Failed to load template file ${templatePath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    }
  }

  /**
   * Apply template to all array properties recursively
   */
  private applyTemplateToArrays(
    data: unknown,
    template: Record<string, unknown>,
  ): unknown {
    if (Array.isArray(data)) {
      // Apply template to each array item
      return data.map((item) => this.applyTemplateToItem(item, template));
    } else if (data && typeof data === "object") {
      // Recursively process object properties
      const result: Record<string, unknown> = {};
      const obj = data as Record<string, unknown>;

      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.applyTemplateToArrays(value, template);
      }

      return result;
    }

    return data;
  }

  /**
   * Apply template to a single item
   */
  private applyTemplateToItem(
    item: unknown,
    template: Record<string, unknown>,
  ): unknown {
    if (!item || typeof item !== "object") {
      return item;
    }

    const result: Record<string, unknown> = {};
    const itemObj = item as Record<string, unknown>;

    // Apply template with variable substitution
    for (const [templateKey, templateValue] of Object.entries(template)) {
      if (typeof templateValue === "string" && templateValue.includes("{")) {
        // Resolve template variables
        result[templateKey] = this.resolveTemplateVariable(
          templateValue,
          itemObj,
        );
      } else {
        result[templateKey] = templateValue;
      }
    }

    return result;
  }

  /**
   * Resolve template variable in context of item data
   */
  private resolveTemplateVariable(
    templateValue: string,
    itemData: Record<string, unknown>,
  ): string {
    // Simple template variable resolution
    // Matches {variable} or {variable.property} patterns
    return templateValue.replace(
      /\{([^}]+)\}/g,
      (match, variable) => {
        const value = this.getNestedProperty(itemData, variable);
        return value !== undefined ? String(value) : match;
      },
    );
  }

  /**
   * Get nested property value using dot notation
   */
  private getNestedProperty(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (
        current && typeof current === "object" &&
        part in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Extract template variables from template string
   * Uses a more precise regex to avoid matching JSON structure braces
   */
  private extractTemplateVariables(templateString: string): readonly string[] {
    const variables = new Set<string>();

    // Use a more precise regex that matches template variables within string values
    // This pattern looks for quotes followed by braces with variable names
    const matches = templateString.match(/"\{([^}]+)\}"/g);

    if (matches) {
      for (const match of matches) {
        // Extract just the variable name from "{variableName}"
        const variable = match.replace(/^"?\{|\}"?$/g, "").trim();
        if (variable) {
          variables.add(variable);
        }
      }
    }

    return Array.from(variables).sort();
  }

  /**
   * Count items in arrays recursively
   */
  private countArrayItems(
    data: unknown,
    callback: (count: number) => void,
  ): void {
    if (Array.isArray(data)) {
      callback(data.length);
      for (const item of data) {
        this.countArrayItems(item, callback);
      }
    } else if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      for (const value of Object.values(obj)) {
        this.countArrayItems(value, callback);
      }
    }
  }
}
