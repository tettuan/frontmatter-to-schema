/**
 * TypeScript-based template processing system
 * Phase 3: Template variable replacement using schema paths
 */

import type { Result } from "../core/result.ts";
import {
  createValidationError,
  type ValidationError,
} from "../shared/errors.ts";
import type {
  MappedSchemaData,
  SchemaMatchResult,
} from "../models/TypeScriptSchemaMatcher.ts";

export interface ProcessedTemplate {
  readonly content: string;
  readonly replacedVariables: string[];
  readonly unresolvedVariables: string[];
  readonly missingRequiredVariables: string[];
}

export interface TemplateProcessingOptions {
  readonly handleMissingRequired: "error" | "warning" | "ignore";
  readonly handleMissingOptional: "empty" | "remove" | "keep";
  readonly arrayFormat: "json" | "csv" | "list";
}

export class TypeScriptTemplateProcessor {
  private readonly defaultOptions: TemplateProcessingOptions = {
    handleMissingRequired: "warning",
    handleMissingOptional: "empty",
    arrayFormat: "json",
  };

  /**
   * Phase 3-1: Replace {SchemaPath} variables in template content
   */
  processTemplate(
    templateContent: string,
    mappedData: MappedSchemaData,
    options: Partial<TemplateProcessingOptions> = {},
  ): Result<ProcessedTemplate, ValidationError> {
    try {
      const processingOptions = { ...this.defaultOptions, ...options };

      // Extract template variables
      const variableExtractionResult = this.extractTemplateVariables(
        templateContent,
      );
      if (!variableExtractionResult.ok) {
        return variableExtractionResult;
      }

      const variables = variableExtractionResult.data;
      let processedContent = templateContent;
      const replacedVariables: string[] = [];
      const unresolvedVariables: string[] = [];
      const missingRequiredVariables: string[] = [];

      // Process each variable
      for (const variable of variables) {
        const replacement = this.resolveVariable(
          variable,
          mappedData,
          processingOptions,
        );

        if (replacement.found) {
          processedContent = processedContent.replace(
            new RegExp(`\\{${this.escapeRegExp(variable)}\\}`, "g"),
            replacement.value,
          );
          replacedVariables.push(variable);
        } else {
          if (replacement.isRequired) {
            missingRequiredVariables.push(variable);

            if (processingOptions.handleMissingRequired === "error") {
              return {
                ok: false,
                error: createValidationError(
                  `Required template variable not found: ${variable}`,
                ),
              };
            }
          } else {
            unresolvedVariables.push(variable);

            // Handle missing optional variables
            if (processingOptions.handleMissingOptional === "remove") {
              processedContent = processedContent.replace(
                new RegExp(`\\{${this.escapeRegExp(variable)}\\}`, "g"),
                "",
              );
            } else if (processingOptions.handleMissingOptional === "empty") {
              processedContent = processedContent.replace(
                new RegExp(`\\{${this.escapeRegExp(variable)}\\}`, "g"),
                "",
              );
            }
            // 'keep' option leaves the variable unchanged
          }
        }
      }

      return {
        ok: true,
        data: {
          content: processedContent,
          replacedVariables,
          unresolvedVariables,
          missingRequiredVariables,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to process template: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  /**
   * Phase 3-2: Handle arrays and objects for template replacement
   */
  private resolveVariable(
    variable: string,
    mappedData: MappedSchemaData,
    options: TemplateProcessingOptions,
  ): { found: boolean; value: string; isRequired: boolean } {
    // Find matching data for the variable path
    const match = mappedData.matches.find((m: SchemaMatchResult) =>
      m.path === variable
    );

    if (!match) {
      const isRequired = mappedData.missingRequiredKeys.includes(variable);
      return { found: false, value: "", isRequired };
    }

    const value = match.value;
    let stringValue: string;

    // Handle different value types
    if (Array.isArray(value)) {
      stringValue = this.formatArray(value, options.arrayFormat);
    } else if (value && typeof value === "object") {
      stringValue = this.formatObject(value, options.arrayFormat);
    } else if (value === null || value === undefined) {
      stringValue = "";
    } else {
      stringValue = String(value);
    }

    return {
      found: true,
      value: stringValue,
      isRequired: match.matchedProperty.required,
    };
  }

  private formatArray(
    value: unknown[],
    format: "json" | "csv" | "list",
  ): string {
    switch (format) {
      case "json":
        return JSON.stringify(value);
      case "csv":
        return value.map((v) => String(v)).join(", ");
      case "list":
        return value.map((v) => `- ${String(v)}`).join("\n");
      default:
        return JSON.stringify(value);
    }
  }

  private formatObject(
    value: unknown,
    format: "json" | "csv" | "list",
  ): string {
    if (format === "json") {
      return JSON.stringify(value, null, 2);
    }

    // For non-JSON formats, convert object to key-value pairs
    if (value && typeof value === "object") {
      const pairs = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${String(v)}`);

      return format === "csv"
        ? pairs.join(", ")
        : pairs.map((p) => `- ${p}`).join("\n");
    }

    return String(value);
  }

  private extractTemplateVariables(
    templateContent: string,
  ): Result<string[], ValidationError> {
    try {
      const variablePattern = /\{([^}]+)\}/g;
      const variables: string[] = [];
      let match;

      while ((match = variablePattern.exec(templateContent)) !== null) {
        const variableName = match[1].trim();
        if (variableName && !variables.includes(variableName)) {
          variables.push(variableName);
        }
      }

      return {
        ok: true,
        data: variables,
      };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to extract template variables: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      };
    }
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Handle complex schema path patterns like tools.commands[].options.input
   */
  resolveComplexSchemaPath(
    schemaPath: string,
    mappedData: MappedSchemaData,
  ): { found: boolean; value: unknown } {
    // Handle array notation in schema paths
    if (schemaPath.includes("[]")) {
      return this.resolveArraySchemaPath(schemaPath, mappedData);
    }

    // Handle indexed array access like tools.availableConfigs[0]
    if (schemaPath.includes("[") && schemaPath.includes("]")) {
      return this.resolveIndexedSchemaPath(schemaPath, mappedData);
    }

    // Simple path resolution
    const match = mappedData.matches.find((m: SchemaMatchResult) =>
      m.path === schemaPath
    );
    return {
      found: !!match,
      value: match?.value,
    };
  }

  private resolveArraySchemaPath(
    schemaPath: string,
    mappedData: MappedSchemaData,
  ): { found: boolean; value: unknown } {
    // For paths like tools.commands[].options.input, collect all matching array elements
    const baseArrayPath = schemaPath.replace("[]", "");
    const matchingPaths = mappedData.matches.filter((m: SchemaMatchResult) =>
      m.path.startsWith(baseArrayPath) && m.path !== baseArrayPath
    );

    if (matchingPaths.length === 0) {
      return { found: false, value: undefined };
    }

    // Group by array index and collect values
    const _arrayValues: unknown[] = [];
    const pathGroups = new Map<string, unknown[]>();

    for (const match of matchingPaths) {
      const remainingPath = match.path.substring(baseArrayPath.length);
      const indexMatch = remainingPath.match(/\[(\d+)\]/);

      if (indexMatch) {
        const index = parseInt(indexMatch[1]);
        const subPath = remainingPath.substring(indexMatch[0].length + 1); // +1 for the dot

        if (!pathGroups.has(subPath)) {
          pathGroups.set(subPath, []);
        }

        const group = pathGroups.get(subPath)!;
        group[index] = match.value;
      }
    }

    // Return the collected array values
    return {
      found: true,
      value: Array.from(pathGroups.values())[0] || [],
    };
  }

  private resolveIndexedSchemaPath(
    schemaPath: string,
    mappedData: MappedSchemaData,
  ): { found: boolean; value: unknown } {
    const match = mappedData.matches.find((m: SchemaMatchResult) =>
      m.path === schemaPath
    );
    return {
      found: !!match,
      value: match?.value,
    };
  }
}
