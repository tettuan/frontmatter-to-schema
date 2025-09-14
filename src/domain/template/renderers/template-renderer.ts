import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { JsonFormatter } from "../services/formatters/json-formatter.ts";
import { YamlFormatter } from "../services/formatters/yaml-formatter.ts";
import { MarkdownFormatter } from "../services/formatters/markdown-formatter.ts";
import { VariableReplacer } from "../services/variable-replacer.ts";
import { DebugLogger } from "../../../infrastructure/adapters/debug-logger.ts";

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
    private readonly debugLogger?: DebugLogger,
  ) {}

  /**
   * Smart Constructor for TemplateRenderer
   * @returns Result containing TemplateRenderer instance or error
   */
  static create(debugLogger?: DebugLogger): Result<
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
        debugLogger,
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
    this.debugLogger?.logInfo(
      "template-render",
      "Starting single data template rendering",
      {
        templateFormat: template.getFormat(),
        dataKeys: Object.keys(data.getData()),
      },
    );

    const content = template.getContent();
    this.debugLogger?.logDebug(
      "variable-processing",
      "Processing template variables with data",
      {
        templateLength: typeof content === "string"
          ? content.length
          : "unknown",
      },
    );

    const renderedResult = this.variableReplacer.processValue(content, data);
    if (!renderedResult.ok) {
      this.debugLogger?.logError("variable-processing", renderedResult.error, {
        templateFormat: template.getFormat(),
      });
      return renderedResult;
    }

    this.debugLogger?.logDebug(
      "variable-processing",
      "Variable processing successful",
    );

    const formatResult = this.formatOutput(
      renderedResult.data,
      template.getFormat(),
    );
    if (formatResult.ok) {
      this.debugLogger?.logInfo(
        "template-render",
        "Single data template rendering completed successfully",
        {
          outputLength: formatResult.data.length,
        },
      );
    }

    return formatResult;
  }

  /**
   * Renders template with array of data sources
   */
  renderWithArray(
    template: Template,
    dataArray: FrontmatterData[],
  ): Result<string, TemplateError & { message: string }> {
    this.debugLogger?.logInfo(
      "template-render-array",
      "Starting array data template rendering",
      {
        templateFormat: template.getFormat(),
        arrayLength: dataArray.length,
      },
    );

    const content = template.getContent();
    const results: unknown[] = [];

    for (let i = 0; i < dataArray.length; i++) {
      const data = dataArray[i];
      this.debugLogger?.logDebug(
        "array-item-processing",
        `Processing array item ${i + 1}/${dataArray.length}`,
        {
          itemIndex: i,
          dataKeys: Object.keys(data.getData()),
        },
      );

      const renderedResult = this.variableReplacer.processValue(content, data);
      if (!renderedResult.ok) {
        this.debugLogger?.logError(
          "array-item-processing",
          renderedResult.error,
          {
            itemIndex: i,
            templateFormat: template.getFormat(),
          },
        );
        return renderedResult;
      }

      results.push(renderedResult.data);
      this.debugLogger?.logDebug(
        "array-item-processing",
        `Successfully processed array item ${i + 1}`,
      );
    }

    this.debugLogger?.logInfo(
      "array-processing",
      `Successfully processed all ${dataArray.length} array items`,
    );

    const formatResult = this.formatOutput(results, template.getFormat());
    if (formatResult.ok) {
      this.debugLogger?.logInfo(
        "template-render-array",
        "Array data template rendering completed successfully",
        {
          outputLength: formatResult.data.length,
          processedItems: results.length,
        },
      );
    }

    return formatResult;
  }

  private formatOutput(
    data: unknown,
    format: "json" | "yaml" | "markdown",
  ): Result<string, TemplateError & { message: string }> {
    this.debugLogger?.logDebug(
      "output-formatting",
      `Formatting output as ${format}`,
      {
        format,
        dataType: typeof data,
        isArray: Array.isArray(data),
      },
    );

    let result: Result<string, TemplateError & { message: string }>;

    switch (format) {
      case "json": {
        result = this.jsonFormatter.format(data);
        break;
      }
      case "yaml": {
        result = this.yamlFormatter.format(data);
        break;
      }
      case "markdown": {
        result = this.markdownFormatter.format(data);
        break;
      }
      default: {
        const error = createError({
          kind: "InvalidFormat",
          format,
        });
        this.debugLogger?.logError("output-formatting", error, { format });
        return err(error);
      }
    }

    if (result.ok) {
      this.debugLogger?.logDebug(
        "output-formatting",
        `Successfully formatted output as ${format}`,
        {
          outputLength: result.data.length,
        },
      );
    } else {
      this.debugLogger?.logError("output-formatting", result.error, { format });
    }

    return result;
  }
}
