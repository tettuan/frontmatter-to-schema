import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import {
  ErrorHandling,
  type OperationContext,
} from "../../shared/services/error-handling-service.ts";
import { BaseFormatter, OutputFormat } from "./output-formatter.ts";

// JSON error factory for ErrorHandlingService
const jsonErrorFactory = (
  message: string,
  context?: OperationContext,
): TemplateError & { message: string } => ({
  kind: "RenderFailed",
  message: context
    ? `${context.operation}.${context.method}: ${message}`
    : message,
});

/**
 * JSON formatter for template output
 * Follows Totality principles with Smart Constructor pattern
 */
export class JsonFormatter extends BaseFormatter {
  private constructor() {
    super();
  }

  /**
   * Smart Constructor for JsonFormatter
   * @returns Result containing JsonFormatter instance or error
   */
  static create(): Result<JsonFormatter, TemplateError & { message: string }> {
    return ok(new JsonFormatter());
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
        const formatted = JSON.stringify(data, null, 2);
        return formatted;
      },
      jsonErrorFactory,
      { operation: "format", method: "stringifyJSON" },
    );
  }

  getFormat(): OutputFormat {
    return "json";
  }
}
