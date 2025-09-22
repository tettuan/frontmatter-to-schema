import { ok, Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { BaseFormatter, OutputFormat } from "./output-formatter.ts";
import { stringify as stringifyYaml } from "jsr:@std/yaml@1.0.5";

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

    try {
      const formatted = stringifyYaml(data, {
        indent: 2,
        lineWidth: -1, // Disable line wrapping
      });
      return ok(formatted);
    } catch (error) {
      return ErrorHandler.template({
        operation: "format",
        method: "stringifyYAML",
      }).invalid(
        `Failed to format as YAML: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }
  }

  getFormat(): OutputFormat {
    return "yaml";
  }
}
