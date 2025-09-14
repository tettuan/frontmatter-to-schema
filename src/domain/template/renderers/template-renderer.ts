import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { JsonFormatter } from "../services/formatters/json-formatter.ts";
import { YamlFormatter } from "../services/formatters/yaml-formatter.ts";
import { MarkdownFormatter } from "../services/formatters/markdown-formatter.ts";
import { VariableReplacer } from "../services/variable-replacer.ts";

/**
 * TemplateRenderer orchestrates template rendering using specialized formatters.
 * Follows DDD principles with clear separation of concerns and Totality patterns.
 */
export class TemplateRenderer {
  private constructor(
    private readonly variableReplacer: VariableReplacer,
    private readonly jsonFormatter: JsonFormatter,
    private readonly yamlFormatter: YamlFormatter,
    private readonly markdownFormatter: MarkdownFormatter,
  ) {}

  /**
   * Smart Constructor for TemplateRenderer
   * @returns Result containing TemplateRenderer instance or error
   */
  static create(): Result<
    TemplateRenderer,
    TemplateError & { message: string }
  > {
    const variableReplacerResult = VariableReplacer.create();
    if (!variableReplacerResult.ok) return variableReplacerResult;

    const jsonFormatterResult = JsonFormatter.create();
    if (!jsonFormatterResult.ok) return jsonFormatterResult;

    const yamlFormatterResult = YamlFormatter.create();
    if (!yamlFormatterResult.ok) return yamlFormatterResult;

    const markdownFormatterResult = MarkdownFormatter.create();
    if (!markdownFormatterResult.ok) return markdownFormatterResult;

    return ok(
      new TemplateRenderer(
        variableReplacerResult.data,
        jsonFormatterResult.data,
        yamlFormatterResult.data,
        markdownFormatterResult.data,
      ),
    );
  }

  /**
   * Renders template with single data source
   */
  render(
    template: Template,
    data: FrontmatterData,
  ): Result<string, TemplateError & { message: string }> {
    const content = template.getContent();
    const renderedResult = this.variableReplacer.processValue(content, data);
    if (!renderedResult.ok) return renderedResult;

    return this.formatOutput(renderedResult.data, template.getFormat());
  }

  /**
   * Renders template with array of data sources
   */
  renderWithArray(
    template: Template,
    dataArray: FrontmatterData[],
  ): Result<string, TemplateError & { message: string }> {
    const content = template.getContent();
    const results: unknown[] = [];

    for (const data of dataArray) {
      const renderedResult = this.variableReplacer.processValue(content, data);
      if (!renderedResult.ok) return renderedResult;
      results.push(renderedResult.data);
    }

    return this.formatOutput(results, template.getFormat());
  }

  private formatOutput(
    data: unknown,
    format: "json" | "yaml" | "markdown",
  ): Result<string, TemplateError & { message: string }> {
    switch (format) {
      case "json":
        return this.jsonFormatter.format(data);
      case "yaml":
        return this.yamlFormatter.format(data);
      case "markdown":
        return this.markdownFormatter.format(data);
      default:
        return err(createError({
          kind: "InvalidFormat",
          format,
        }));
    }
  }
}
