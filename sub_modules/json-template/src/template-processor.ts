/**
 * Main JSON template processor implementation
 */

import { VariableResolver } from "./variable-resolver.ts";
import {
  InvalidJsonError,
  TemplateNotFoundError,
  TemplateReadError,
  VariableNotFoundError,
} from "./errors.ts";
import type { JsonTemplateProcessor } from "./types.ts";

export class JsonTemplateProcessorImpl implements JsonTemplateProcessor {
  /**
   * Process a JSON template with variable substitution
   * @param jsonData - The source JSON data for variable values
   * @param templateFilePath - Path to the template file
   * @returns Promise resolving to the processed JSON object
   */
  async process(jsonData: unknown, templateFilePath: string): Promise<unknown> {
    // Read template file
    const templateContent = await this.readTemplateFile(templateFilePath);

    // Create variable resolver
    const resolver = new VariableResolver(jsonData);

    // Process template with variable substitution
    const processedContent = this.substituteVariables(
      templateContent,
      resolver,
      templateFilePath,
    );

    // Parse the result as JSON
    return this.parseProcessedJson(processedContent, templateFilePath);
  }

  private async readTemplateFile(templateFilePath: string): Promise<string> {
    try {
      const content = await Deno.readTextFile(templateFilePath);
      return content;
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        throw new TemplateNotFoundError(templateFilePath);
      }
      throw new TemplateReadError(templateFilePath, error as Error);
    }
  }

  private substituteVariables(
    template: string,
    resolver: VariableResolver,
    templatePath?: string,
  ): string {
    // Match variable patterns allowing various formats but excluding quotes
    const variableRegex = /"\{\s*([^"}]*?)\s*\}"/g;

    return template.replace(variableRegex, (match, variablePath: string) => {
      const trimmedPath = variablePath.trim();

      // Skip variables containing quotes (malformed)
      if (trimmedPath.includes('"')) {
        return match; // Return original text unchanged
      }

      try {
        const value = resolver.resolve(trimmedPath);
        return this.formatValue(value);
      } catch (error) {
        if (error instanceof VariableNotFoundError) {
          // Log warning only if VERBOSE=true/1 or LOG_LEVEL=debug
          const verbose = Deno.env.get("VERBOSE") === "true" ||
            Deno.env.get("VERBOSE") === "1";
          const logLevel = Deno.env.get("LOG_LEVEL");
          const shouldLog = verbose || logLevel === "debug";

          if (shouldLog) {
            console.error(
              `[json-template WARNING] Variable not found: ${trimmedPath}`,
            );
            if (templatePath) {
              console.error(`  Template: ${templatePath}`);
            }
          }

          // Return empty string (will be quoted as "")
          return '""';
        }
        throw error;
      }
    });
  }

  private formatValue(value: unknown): string {
    // DEBUG: Log value type and content
    const debugEnabled = Deno.env.get("DEBUG_TEMPLATE") === "true";
    if (debugEnabled) {
      console.error(`[DEBUG formatValue] Input value:`, value);
      console.error(
        `[DEBUG formatValue] Type: ${typeof value}, IsArray: ${
          Array.isArray(value)
        }`,
      );
    }

    if (value === null) {
      if (debugEnabled) console.error(`[DEBUG formatValue] Returning: "null"`);
      return "null";
    }

    if (value === undefined) {
      if (debugEnabled) {
        console.error(`[DEBUG formatValue] Returning: "null" (from undefined)`);
      }
      return "null";
    }

    if (typeof value === "string") {
      if (debugEnabled) {
        console.error(
          `[DEBUG formatValue] Returning: JSON.stringify(string) = ${
            JSON.stringify(value)
          }`,
        );
      }
      return JSON.stringify(value);
    }

    if (typeof value === "number" || typeof value === "boolean") {
      if (debugEnabled) {
        console.error(
          `[DEBUG formatValue] Returning: String(number/boolean) = ${
            String(value)
          }`,
        );
      }
      return String(value);
    }

    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
      if (debugEnabled) {
        console.error(
          `[DEBUG formatValue] Returning: JSON.stringify(array/object) = ${
            JSON.stringify(value)
          }`,
        );
      }
      return JSON.stringify(value);
    }

    return JSON.stringify(value);
  }

  private parseProcessedJson(content: string, templatePath?: string): unknown {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new InvalidJsonError(templatePath || "unknown", error as Error);
    }
  }

  /**
   * Validate template content without processing
   * @param templateContent - Template content to validate
   * @returns Array of variable paths found in template
   */
  validateTemplate(templateContent: string): string[] {
    return VariableResolver.extractVariables(templateContent);
  }

  /**
   * Check if all variables in template can be resolved with given data
   * @param templateContent - Template content to check
   * @param jsonData - Data to resolve variables against
   * @returns Object with validation results
   */
  validateVariables(templateContent: string, jsonData: unknown): {
    valid: boolean;
    missingVariables: string[];
    availableVariables: string[];
  } {
    const resolver = new VariableResolver(jsonData);
    const variables = this.validateTemplate(templateContent);

    const missingVariables: string[] = [];
    const availableVariables: string[] = [];

    for (const variable of variables) {
      if (resolver.exists(variable)) {
        availableVariables.push(variable);
      } else {
        missingVariables.push(variable);
      }
    }

    return {
      valid: missingVariables.length === 0,
      missingVariables,
      availableVariables,
    };
  }
}
