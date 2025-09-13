import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";

export class TemplateRenderer {
  render(
    template: Template,
    data: FrontmatterData,
  ): Result<string, TemplateError & { message: string }> {
    const content = template.getContent();
    const rendered = this.renderValue(content, data);

    return this.formatOutput(rendered, template.getFormat());
  }

  renderWithArray(
    template: Template,
    dataArray: FrontmatterData[],
  ): Result<string, TemplateError & { message: string }> {
    const content = template.getContent();
    const results: unknown[] = [];

    for (const data of dataArray) {
      const rendered = this.renderValue(content, data);
      results.push(rendered);
    }

    return this.formatOutput(results, template.getFormat());
  }

  private renderValue(value: unknown, data: FrontmatterData): unknown {
    if (typeof value === "string") {
      return this.replaceVariables(value, data);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.renderValue(item, data));
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(value)) {
        const renderedKey = this.replaceVariables(key, data);

        if (
          typeof val === "object" && val !== null && "frontmatter_value" in val
        ) {
          const fmValue = val as { frontmatter_value: string };
          result[renderedKey] = data.get(fmValue.frontmatter_value);
        } else if (
          typeof val === "object" && val !== null && "iterate" in val
        ) {
          const iterateValue = val as {
            iterate: string;
            frontmatter_value?: string;
          };
          const iterateData = data.get(iterateValue.iterate);
          if (Array.isArray(iterateData) && iterateValue.frontmatter_value) {
            result[renderedKey] = iterateData.map((item) => {
              const itemData = FrontmatterData.create(item);
              if (itemData.ok) {
                return itemData.data.get(iterateValue.frontmatter_value!);
              }
              return null;
            }).filter((item) => item !== null);
          } else {
            result[renderedKey] = iterateData;
          }
        } else {
          result[renderedKey] = this.renderValue(val, data);
        }
      }

      return result;
    }

    return value;
  }

  private replaceVariables(template: string, data: FrontmatterData): string {
    if (!template.includes("{")) {
      return template;
    }

    return template.replace(/\{([^}]+)\}/g, (match, varName) => {
      if (varName.startsWith("@")) {
        return match;
      }

      const value = data.get(varName);
      if (value === undefined) {
        return match;
      }

      if (
        typeof value === "string" || typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return String(value);
      }

      return JSON.stringify(value);
    });
  }

  private formatOutput(
    data: unknown,
    format: "json" | "yaml" | "markdown",
  ): Result<string, TemplateError & { message: string }> {
    try {
      switch (format) {
        case "json":
          return ok(JSON.stringify(data, null, 2));

        case "yaml":
          return ok(this.toYaml(data));

        case "markdown":
          return ok(this.toMarkdown(data));

        default:
          return err(createError({
            kind: "InvalidFormat",
            format,
          }));
      }
    } catch (error) {
      return err(createError({
        kind: "RenderFailed",
        message: error instanceof Error ? error.message : "Unknown error",
      }));
    }
  }

  private toYaml(data: unknown, indent: number = 0): string {
    const spaces = "  ".repeat(indent);

    if (data === null || data === undefined) {
      return `${spaces}null`;
    }

    if (typeof data === "string") {
      if (data.includes("\n") || data.includes(":") || data.includes("#")) {
        return `${spaces}"${data.replace(/"/g, '\\"')}"`;
      }
      return `${spaces}${data}`;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return `${spaces}${data}`;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return `${spaces}[]`;
      }
      return data.map((item) => {
        if (typeof item === "object" && item !== null) {
          const yaml = this.toYaml(item, indent + 1);
          return `${spaces}- ${yaml.substring(spaces.length + 2)}`;
        }
        return `${spaces}- ${item}`;
      }).join("\n");
    }

    if (typeof data === "object" && data !== null) {
      const entries = Object.entries(data);
      if (entries.length === 0) {
        return `${spaces}{}`;
      }
      return entries.map(([key, value]) => {
        if (typeof value === "object" && value !== null) {
          if (Array.isArray(value) && value.length > 0) {
            const items = value.map((item) => {
              if (typeof item === "object" && item !== null) {
                const yaml = this.toYaml(item, indent + 1);
                return `${spaces}  - ${yaml.substring(spaces.length + 4)}`;
              }
              return `${spaces}  - ${item}`;
            }).join("\n");
            return `${spaces}${key}:\n${items}`;
          }
          const yaml = this.toYaml(value, indent + 1);
          return `${spaces}${key}:\n${yaml}`;
        }
        return `${spaces}${key}: ${value}`;
      }).join("\n");
    }

    return `${spaces}${data}`;
  }

  private toMarkdown(data: unknown): string {
    return `# Generated Output\n\n\`\`\`json\n${
      JSON.stringify(data, null, 2)
    }\n\`\`\`\n`;
  }
}
