import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import {
  ErrorHandling,
  type OperationContext,
} from "../../shared/services/error-handling-service.ts";
import { BaseFormatter, OutputFormat } from "./output-formatter.ts";
import { stringify as stringifyYaml } from "jsr:@std/yaml@1.0.5";

// YAML error factory for ErrorHandlingService
const yamlErrorFactory = (
  message: string,
  context?: OperationContext,
): TemplateError & { message: string } => ({
  kind: "RenderFailed",
  message: context
    ? `${context.operation}.${context.method}: ${message}`
    : message,
});

/**
 * YAML formatter for template output
 * Follows Totality principles with Smart Constructor pattern
 */
export class YamlFormatter extends BaseFormatter {
  private constructor() {
    super();
  }

  /**
   * Smart Constructor for YamlFormatter
   * @returns Result containing YamlFormatter instance or error
   */
  static create(): Result<YamlFormatter, TemplateError & { message: string }> {
    return ok(new YamlFormatter());
  }
  format(data: unknown): Result<string, TemplateError & { message: string }> {
    if (!this.isSerializable(data)) {
      return ErrorHandler.template({
        operation: "format",
        method: "validateSerializable",
      }).invalid("Data contains non-serializable values");
    }

    return ErrorHandling.wrapOperation(
      () => {
        const formatted = stringifyYaml(data, {
          indent: 2,
          lineWidth: -1, // Disable line wrapping
        });
        return formatted;
      },
      yamlErrorFactory,
      { operation: "format", method: "stringifyYAML" },
    );
  }

  getFormat(): OutputFormat {
    return "yaml";
  }
}
