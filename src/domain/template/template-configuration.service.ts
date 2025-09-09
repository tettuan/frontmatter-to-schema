/**
 * Template Configuration Service
 *
 * Handles template-specific configuration processing and template loading
 * Part of the Template Management Context (Domain Layer)
 * Follows Totality principles with Result types
 */

import type { DomainError, Result } from "../core/result.ts";
import { createDomainError } from "../core/result.ts";
import {
  type ConfigPath,
  MappingRule,
  TemplateFormat,
  TemplatePath,
} from "../models/value-objects.ts";
import { Template, TemplateId } from "../models/entities.ts";

/**
 * Type guard helper following Totality principle
 */
function _isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for string extraction
 */
function _getStringProperty(
  obj: Record<string, unknown>,
  key: string,
  defaultValue = "",
): string {
  const value = obj[key];
  return typeof value === "string" ? value : defaultValue;
}

/**
 * Service for template configuration processing
 * Encapsulates template loading, validation, and format handling
 */
export class TemplateConfigurationService {
  /**
   * Load template from configuration path
   */
  async loadTemplate(
    path: ConfigPath,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    try {
      const templatePath = path.getValue();

      // Read template file content
      const contentResult = await this.readTemplateFile(templatePath);
      if (!contentResult.ok) {
        return contentResult;
      }

      // Determine template format from file extension
      const formatResult = this.determineTemplateFormat(templatePath);
      if (!formatResult.ok) {
        return formatResult;
      }

      // Create template entity
      return this.createTemplateEntity(
        contentResult.data,
        formatResult.data,
        templatePath,
      );
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }, `Failed to load template: ${path.getValue()}`),
      };
    }
  }

  /**
   * Load template from specific template path
   */
  async loadFromPath(
    path: TemplatePath,
  ): Promise<Result<Template, DomainError & { message: string }>> {
    try {
      const templatePath = path.getValue();

      // Read template file content
      const contentResult = await this.readTemplateFile(templatePath);
      if (!contentResult.ok) {
        return contentResult;
      }

      // Determine template format from path
      const formatResult = this.determineTemplateFormat(path.getValue());
      if (!formatResult.ok) {
        return formatResult;
      }

      // Create template entity
      return this.createTemplateEntity(
        contentResult.data,
        formatResult.data,
        templatePath,
      );
    } catch (error) {
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: path.getValue(),
          details: error instanceof Error ? error.message : "Unknown error",
        }, `Failed to load template: ${path.getValue()}`),
      };
    }
  }

  /**
   * Read template file from filesystem
   */
  private async readTemplateFile(
    templatePath: string,
  ): Promise<Result<string, DomainError & { message: string }>> {
    try {
      const content = await Deno.readTextFile(templatePath);
      return { ok: true, data: content };
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        return {
          ok: false,
          error: createDomainError({
            kind: "FileNotFound",
            path: templatePath,
          }, `Template file not found: ${templatePath}`),
        };
      }
      return {
        ok: false,
        error: createDomainError({
          kind: "ReadError",
          path: templatePath,
          details: error instanceof Error ? error.message : "Unknown error",
        }, `Failed to read template file: ${templatePath}`),
      };
    }
  }

  /**
   * Determine template format from file extension
   */
  private determineTemplateFormat(
    templatePath: string,
  ): Result<TemplateFormat, DomainError & { message: string }> {
    const extension = templatePath.split(".").pop()?.toLowerCase() || "";

    let formatString: string;
    switch (extension) {
      case "hbs":
      case "handlebars":
        formatString = "handlebars";
        break;
      case "ejs":
        formatString = "ejs";
        break;
      case "mustache":
        formatString = "mustache";
        break;
      case "json":
        formatString = "json";
        break;
      case "yaml":
      case "yml":
        formatString = "yaml";
        break;
      default:
        formatString = "handlebars"; // Default format
        break;
    }

    const formatResult = TemplateFormat.create(formatString, "");
    if (!formatResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: formatString,
          expectedFormat: "valid template format",
        }, `Unsupported template format: ${extension}`),
      };
    }

    return formatResult;
  }

  /**
   * Create Template entity from content and format
   */
  private createTemplateEntity(
    content: string,
    format: TemplateFormat,
    templatePath: string,
  ): Result<Template, DomainError & { message: string }> {
    // Generate template ID from file path
    const templateName =
      templatePath.split("/").pop()?.replace(/\.[^/.]+$/, "") || "default";
    const idResult = TemplateId.create(templateName);
    if (!idResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: templateName,
          expectedFormat: "valid template ID",
        }, "Failed to create TemplateId"),
      };
    }

    // Create template path value object
    const pathResult = TemplatePath.create(templatePath);
    if (!pathResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "InvalidFormat",
          input: templatePath,
          expectedFormat: "valid template path",
        }, "Failed to create TemplatePath"),
      };
    }

    // Extract variables from template content (basic implementation)
    const variables = this.extractTemplateVariables(content);

    // Create mapping rules (basic implementation for now)
    const mappingRules = this.createBasicMappingRules(variables);

    // Create Template entity
    const description = `Template for ${templatePath}`;
    const templateResult = Template.create(
      idResult.data,
      format,
      mappingRules,
      description,
    );

    if (!templateResult.ok) {
      return {
        ok: false,
        error: createDomainError({
          kind: "NotConfigured",
          component: "template entity creation",
        }, "Template entity creation failed"),
      };
    }

    return templateResult;
  }

  /**
   * Extract template variables (basic implementation)
   * TODO: Enhance with proper template parsing for different formats
   */
  private extractTemplateVariables(content: string): string[] {
    const variables: Set<string> = new Set();

    // Basic regex for handlebars-style variables {{variable}}
    const handlebarsRegex = /\{\{\s*([^}\s]+)\s*\}\}/g;
    let match;
    while ((match = handlebarsRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    // Basic regex for EJS-style variables <%- variable %>
    const ejsRegex = /<%[-=]\s*([^%\s]+)\s*%>/g;
    while ((match = ejsRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Create basic mapping rules from variables
   * TODO: Enhance with proper rule configuration
   */
  private createBasicMappingRules(variables: string[]): MappingRule[] {
    return variables.map((variable) => {
      const ruleResult = MappingRule.create(
        variable,
        variable,
        (value) => value, // identity transform
      );
      return ruleResult.ok ? ruleResult.data : null;
    }).filter((rule): rule is MappingRule => rule !== null);
  }
}
