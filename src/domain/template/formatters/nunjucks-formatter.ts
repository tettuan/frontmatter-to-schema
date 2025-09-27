import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import {
  ErrorHandling,
  type OperationContext,
} from "../../shared/services/error-handling-service.ts";
import { BaseFormatter, OutputFormat } from "./output-formatter.ts";
import * as nunjucks from "npm:nunjucks@3.2.4";

// Nunjucks error factory for ErrorHandlingService
const nunjucksErrorFactory = (
  message: string,
  context?: OperationContext,
): TemplateError & { message: string } => ({
  kind: "RenderFailed",
  message: context
    ? `${context.operation}.${context.method}: ${message}`
    : message,
});

/**
 * Nunjucks formatter for template output
 * Follows Totality principles with Smart Constructor pattern
 * Renders data using Nunjucks template engine for advanced templating capabilities
 */
export class NunjucksFormatter extends BaseFormatter {
  private readonly nunjucksEnv: nunjucks.Environment;

  private constructor() {
    super();
    // Configure Nunjucks environment with safe settings
    this.nunjucksEnv = new nunjucks.Environment(undefined, {
      autoescape: false, // Allow raw output for flexibility
      throwOnUndefined: false, // Don't throw on undefined variables
      trimBlocks: true, // Clean whitespace handling
      lstripBlocks: true, // Clean whitespace handling
    });
  }

  /**
   * Smart Constructor for NunjucksFormatter
   * @returns Result containing NunjucksFormatter instance or error
   */
  static create(): Result<
    NunjucksFormatter,
    TemplateError & { message: string }
  > {
    return ErrorHandling.wrapOperation(
      () => new NunjucksFormatter(),
      nunjucksErrorFactory,
      { operation: "create", method: "initializeEnvironment" },
    );
  }

  format(data: unknown): Result<string, TemplateError & { message: string }> {
    // Validate that data is serializable for template processing
    if (!this.isSerializable(data)) {
      return ErrorHandler.template({
        operation: "format",
        method: "validateSerializable",
      }).invalid("Data contains non-serializable values");
    }

    // For Nunjucks formatting, we expect data to be a template string or object with template
    // If data is a string, treat it as a Nunjucks template
    // If data is an object, render it as JSON first (fallback behavior)
    return ErrorHandling.wrapOperation(
      () => {
        if (typeof data === "string") {
          // Render string as Nunjucks template with empty context
          return this.nunjucksEnv.renderString(data, {});
        } else if (data && typeof data === "object") {
          // For objects, we need to determine how to render them
          // Check if the object has a 'template' property for Nunjucks processing
          const dataRecord = data as Record<string, unknown>;

          if (
            "template" in dataRecord && typeof dataRecord.template === "string"
          ) {
            // Extract template and use remaining data as context
            const template = dataRecord.template;
            const context = { ...dataRecord };
            delete context.template;

            return this.nunjucksEnv.renderString(template, context);
          } else {
            // Fallback: convert object to JSON representation
            return JSON.stringify(data, null, 2);
          }
        } else {
          // For primitive values, convert to string
          return String(data);
        }
      },
      nunjucksErrorFactory,
      { operation: "format", method: "renderTemplate" },
    );
  }

  getFormat(): OutputFormat {
    return "njk";
  }

  /**
   * Render a specific template string with provided context data
   * Exposed for advanced use cases where template and data are separate
   */
  renderTemplate(
    template: string,
    context: Record<string, unknown>,
  ): Result<string, TemplateError & { message: string }> {
    return ErrorHandling.wrapOperation(
      () => this.nunjucksEnv.renderString(template, context),
      nunjucksErrorFactory,
      { operation: "renderTemplate", method: "renderString" },
    );
  }
}
