import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { BaseFormatter, OutputFormat } from "./output-formatter.ts";
import { stringify as stringifyYaml } from "jsr:@std/yaml@1.0.5";

/**
 * YAML formatter for template output
 */
export class YamlFormatter extends BaseFormatter {
  format(data: unknown): Result<string, DomainError & { message: string }> {
    if (!this.isSerializable(data)) {
      return err(createError({
        kind: "InvalidTemplate",
        message: "Data contains non-serializable values",
      }));
    }

    try {
      const formatted = stringifyYaml(data, {
        indent: 2,
        lineWidth: -1, // Disable line wrapping
      });
      return ok(formatted);
    } catch (error) {
      return err(createError({
        kind: "InvalidTemplate",
        message: `Failed to format as YAML: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      }));
    }
  }

  getFormat(): OutputFormat {
    return "yaml";
  }
}
