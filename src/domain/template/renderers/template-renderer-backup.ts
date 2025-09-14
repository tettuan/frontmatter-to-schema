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
   * Renders template with array of data sources using {@items} expansion
   */
  renderWithArray(
    template: Template,
    dataArray: FrontmatterData[],
  ): Result<string, TemplateError & { message: string }> {
    const content = template.getContent();
    const contentStr = typeof content === "string"
      ? content
      : JSON.stringify(content);
    const hasItemsExpansion = contentStr.includes("{@items}");

    if (hasItemsExpansion) {
      // Use array expansion for {@items} patterns
      this.debugLogger?.logInfo(
        "template-render-array",
        "Starting array data template rendering with {@items} expansion",
        {
          templateFormat: template.getFormat(),
          arrayLength: dataArray.length,
        },
      );

      // Convert FrontmatterData array to plain data for array expansion
      const plainDataArray = dataArray.map((data) => data.getData());

      this.debugLogger?.logDebug(
        "array-expansion",
        "Processing template with {@items} expansion",
        {
          templateType: typeof content,
          hasArrayData: Array.isArray(plainDataArray),
          itemCount: plainDataArray.length,
        },
      );

      // Use processArrayExpansion to handle {@items} properly
      const expansionResult = this.variableReplacer.processArrayExpansion(
        content,
        plainDataArray,
      );
      if (!expansionResult.ok) {
        this.debugLogger?.logError(
          "array-expansion",
          expansionResult.error,
          {
            templateFormat: template.getFormat(),
          },
        );
        return expansionResult;
      }

      this.debugLogger?.logInfo(
        "array-expansion",
        "Array expansion completed successfully",
        {
          resultType: typeof expansionResult.data,
        },
      );

      return this.formatOutput(
        expansionResult.data,
        template.getFormat(),
      );
    } else {
      // Use individual item processing for traditional array rendering
      this.debugLogger?.logInfo(
        "template-render-array",
        "Starting individual item template rendering",
        {
          templateFormat: template.getFormat(),
          arrayLength: dataArray.length,
        },
      );

      const results: unknown[] = [];
      for (const item of dataArray) {
        const itemResult = this.variableReplacer.processValue(
          content,
          item,
          dataArray,
        );
        if (!itemResult.ok) {
          this.debugLogger?.logError(
            "item-processing",
            itemResult.error,
            { templateFormat: template.getFormat() },
          );
          return itemResult;
        }
        results.push(itemResult.data);
      }

      this.debugLogger?.logInfo(
        "template-render-array",
        "Individual item processing completed successfully",
        {
          resultCount: results.length,
        },
      );

      return this.formatOutput(results, template.getFormat());
    }
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
