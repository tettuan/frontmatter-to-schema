import { err, ok, Result } from "../../../shared/types/result.ts";
import { createError, TemplateError } from "../../../shared/types/errors.ts";

/**
 * YamlFormatter handles formatting data as YAML strings.
 * Follows Totality principles with Result<T,E> pattern and proper error handling.
 */
export class YamlFormatter {
  private constructor() {}

  /**
   * Smart Constructor for YamlFormatter
   * @returns Result containing YamlFormatter instance or error
   */
  static create(): Result<YamlFormatter, TemplateError & { message: string }> {
    return ok(new YamlFormatter());
  }

  /**
   * Formats data as YAML string
   * @param data - Data to format as YAML
   * @returns Result containing formatted YAML string or error
   */
  format(data: unknown): Result<string, TemplateError & { message: string }> {
    try {
      const yamlString = this.formatValue(data, 0);
      return ok(yamlString);
    } catch (error) {
      return err(createError({
        kind: "RenderFailed",
        message: error instanceof Error
          ? error.message
          : "YAML formatting failed",
      }));
    }
  }

  private formatValue(data: unknown, indent: number): string {
    const spaces = "  ".repeat(indent);

    if (data === null || data === undefined) {
      return `${spaces}null`;
    }

    if (typeof data === "string") {
      if (this.needsQuoting(data)) {
        return `${spaces}"${this.escapeString(data)}"`;
      }
      return `${spaces}${data}`;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return `${spaces}${data}`;
    }

    if (Array.isArray(data)) {
      return this.formatArray(data, indent, spaces);
    }

    if (typeof data === "object" && data !== null) {
      return this.formatObject(data as Record<string, unknown>, indent, spaces);
    }

    return `${spaces}${data}`;
  }

  private needsQuoting(str: string): boolean {
    return str.includes("\n") || str.includes(":") || str.includes("#");
  }

  private escapeString(str: string): string {
    return str.replace(/"/g, '\\"');
  }

  private formatArray(data: unknown[], indent: number, spaces: string): string {
    if (data.length === 0) {
      return `${spaces}[]`;
    }

    return data.map((item) => {
      if (typeof item === "object" && item !== null) {
        const yaml = this.formatValue(item, indent + 1);
        return `${spaces}- ${yaml.substring(spaces.length + 2)}`;
      }
      return `${spaces}- ${item}`;
    }).join("\n");
  }

  private formatObject(
    data: Record<string, unknown>,
    indent: number,
    spaces: string,
  ): string {
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return `${spaces}{}`;
    }

    return entries.map(([key, value]) => {
      if (typeof value === "object" && value !== null) {
        if (Array.isArray(value) && value.length > 0) {
          const items = value.map((item) => {
            if (typeof item === "object" && item !== null) {
              const yaml = this.formatValue(item, indent + 1);
              return `${spaces}  - ${yaml.substring(spaces.length + 4)}`;
            }
            return `${spaces}  - ${item}`;
          }).join("\n");
          return `${spaces}${key}:\n${items}`;
        }
        const yaml = this.formatValue(value, indent + 1);
        return `${spaces}${key}:\n${yaml}`;
      }
      return `${spaces}${key}: ${value}`;
    }).join("\n");
  }
}
