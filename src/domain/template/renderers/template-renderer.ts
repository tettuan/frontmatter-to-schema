import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { JsonFormatter } from "../services/formatters/json-formatter.ts";
import { YamlFormatter } from "../services/formatters/yaml-formatter.ts";
import { MarkdownFormatter } from "../services/formatters/markdown-formatter.ts";
import {
  UnifiedVariableReplacementStrategy,
  VariableReplacementStrategy,
} from "../services/variable-replacement-strategy.ts";
import { ProcessingContext } from "../value-objects/processing-context.ts";
import { DebugLogger } from "../../../infrastructure/adapters/debug-logger.ts";

/**
 * TemplateRenderer eliminates dual-path processing architecture.
 * Follows DDD principles with unified processing strategy and Totality patterns.
 *
 * REFACTORED: Resolves Issue #810 with unified processing approach:
 * - Single processing path for all template types
 * - Consistent variable replacement across contexts
 * - Full Result<T,E> compliance
 * - Strategy pattern for extensible variable replacement
 */
export class TemplateRenderer {
  private constructor(
    private readonly variableStrategy: VariableReplacementStrategy,
    private readonly jsonFormatter: JsonFormatter,
    private readonly yamlFormatter: YamlFormatter,
    private readonly markdownFormatter: MarkdownFormatter,
    private readonly debugLogger?: DebugLogger,
    private readonly verbose: boolean = false,
  ) {}

  /**
   * Smart Constructor for TemplateRenderer
   * @param debugLogger - Optional debug logger for detailed logging
   * @param verbose - Whether to run in verbose mode (affects null/undefined handling)
   * @returns Result containing TemplateRenderer instance or error
   */
  static create(debugLogger?: DebugLogger, verbose: boolean = false): Result<
    TemplateRenderer,
    TemplateError & { message: string }
  > {
    const strategyResult = UnifiedVariableReplacementStrategy.create();
    if (!strategyResult.ok) return strategyResult;

    const jsonFormatterResult = JsonFormatter.create();
    if (!jsonFormatterResult.ok) return jsonFormatterResult;

    const yamlFormatterResult = YamlFormatter.create();
    if (!yamlFormatterResult.ok) return yamlFormatterResult;

    const markdownFormatterResult = MarkdownFormatter.create();
    if (!markdownFormatterResult.ok) return markdownFormatterResult;

    return ok(
      new TemplateRenderer(
        strategyResult.data,
        jsonFormatterResult.data,
        yamlFormatterResult.data,
        markdownFormatterResult.data,
        debugLogger,
        verbose,
      ),
    );
  }

  /**
   * Unified render method that handles both single and array data processing.
   * Eliminates the dual-path architecture by using strategy pattern with context.
   *
   * @param template - Template to render
   * @param data - Single data source or array of data sources
   * @returns Result containing rendered string or error
   */
  render(
    template: Template,
    data: FrontmatterData | FrontmatterData[],
  ): Result<string, TemplateError & { message: string }> {
    this.debugLogger?.logInfo(
      "template-render",
      "Starting unified template rendering",
      {
        templateFormat: template.getFormat(),
        isArrayData: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 1,
      },
    );

    // Determine processing context based on data type and template content
    const contextResult = this.determineProcessingContext(template, data);
    if (!contextResult.ok) {
      return contextResult;
    }

    const context = contextResult.data;
    const effectiveData = Array.isArray(data) ? data[0] : data; // Use first item for template processing context

    this.debugLogger?.logDebug(
      "template-render",
      "Processing context determined",
      {
        contextType: context.processingType,
        hasArrayData: context.hasArrayData,
      },
    );

    // Perform unified variable replacement
    const content = template.getContent();
    const replacementResult = this.variableStrategy.replaceVariables(
      content,
      effectiveData,
      context,
    );

    if (!replacementResult.ok) {
      this.debugLogger?.logError(
        "template-render",
        replacementResult.error,
        {
          templateFormat: template.getFormat(),
        },
      );
      return replacementResult;
    }

    this.debugLogger?.logDebug(
      "template-render",
      "Variable replacement completed successfully",
      {
        resultType: typeof replacementResult.data,
      },
    );

    // Format the output
    const formatResult = this.formatOutput(
      replacementResult.data,
      template.getFormat(),
    );

    if (formatResult.ok) {
      this.debugLogger?.logInfo(
        "template-render",
        "Unified template rendering completed successfully",
        {
          outputLength: formatResult.data.length,
        },
      );
    } else {
      this.debugLogger?.logError(
        "template-render",
        formatResult.error,
        {
          templateFormat: template.getFormat(),
        },
      );
    }

    return formatResult;
  }

  /**
   * Determine the appropriate processing context based on template content and data type.
   * This centralizes the logic that was previously scattered across dual paths.
   */
  private determineProcessingContext(
    template: Template,
    data: FrontmatterData | FrontmatterData[],
  ): Result<ProcessingContext, TemplateError & { message: string }> {
    const content = template.getContent();
    const contentStr = typeof content === "string"
      ? content
      : JSON.stringify(content);

    // Check for array data first
    if (Array.isArray(data)) {
      // Convert FrontmatterData array to plain data for processing
      const plainDataArray = data.map((item) => item.getData());

      // Check if template has {@items} expansion markers
      if (contentStr.includes("{@items}")) {
        this.debugLogger?.logDebug(
          "context-determination",
          "Determined array expansion context",
          { arrayLength: plainDataArray.length },
        );
        return ProcessingContext.forArrayExpansion(plainDataArray);
      } else {
        this.debugLogger?.logDebug(
          "context-determination",
          "Determined array processing context",
          { arrayLength: plainDataArray.length },
        );
        return ProcessingContext.forArrayProcessing(plainDataArray);
      }
    }

    // Single item processing
    this.debugLogger?.logDebug(
      "context-determination",
      "Determined single item context",
    );
    return ProcessingContext.forSingleItem();
  }

  /**
   * Format the processed data according to template format.
   * Handles all supported output formats consistently.
   */
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

  /**
   * Backward compatibility method for single data rendering
   * @deprecated Use render() method instead for unified processing
   */
  renderSingle(
    template: Template,
    data: FrontmatterData,
  ): Result<string, TemplateError & { message: string }> {
    return this.render(template, data);
  }

  /**
   * Backward compatibility method for array data rendering
   * @deprecated Use render() method instead for unified processing
   */
  renderWithArray(
    template: Template,
    dataArray: FrontmatterData[],
  ): Result<string, TemplateError & { message: string }> {
    return this.render(template, dataArray);
  }
}
