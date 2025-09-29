/**
 * Core types for JSON template processing
 */

export interface JsonTemplateProcessor {
  /**
   * Process a JSON template with variable substitution
   * @param jsonData - The source JSON data for variable values
   * @param templateFilePath - Path to the template file
   * @returns Promise resolving to the processed JSON object
   */
  process(jsonData: unknown, templateFilePath: string): Promise<unknown>;

  /**
   * Validate template content without processing
   * @param templateContent - Template content to validate
   * @returns Array of variable paths found in template
   */
  validateTemplate(templateContent: string): string[];

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
  };
}

export interface TemplateProcessingError extends Error {
  readonly code: string;
  readonly templatePath?: string;
  readonly variablePath?: string;
  readonly originalError?: Error;
}

export interface ProcessingResult {
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: TemplateProcessingError;
}

export type VariableValue = string | number | boolean | null | unknown[] | Record<string, unknown>;