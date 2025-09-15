import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { JsonFormatter } from "../formatters/json-formatter.ts";
import { YamlFormatter } from "../formatters/yaml-formatter.ts";
import { MarkdownFormatter } from "../formatters/markdown-formatter.ts";
import {
  UnifiedVariableReplacementStrategy,
  VariableReplacementStrategy,
} from "../services/variable-replacement-strategy.ts";
import {
  ProcessingContext,
  VerbosityMode,
} from "../value-objects/processing-context.ts";
import {
  DomainLogger,
  NullDomainLogger,
} from "../../shared/services/domain-logger.ts";

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
    private readonly domainLogger: DomainLogger = new NullDomainLogger(),
  ) {}

  /**
   * Smart Constructor for TemplateRenderer
   * @returns Result containing TemplateRenderer instance or error
   */
  static create(domainLogger?: DomainLogger): Result<
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
        domainLogger ?? new NullDomainLogger(),
      ),
    );
  }

  /**
   * Unified render method that handles both single and array data processing.
   * Eliminates the dual-path architecture by using strategy pattern with context.
   *
   * @param template - Template to render
   * @param data - Single data source or array of data sources
   * @param verbosityMode - Verbosity mode for null/undefined handling
   * @returns Result containing rendered string or error
   */
  render(
    template: Template,
    data: FrontmatterData | FrontmatterData[],
    verbosityMode: VerbosityMode = { kind: "normal" },
  ): Result<string, TemplateError & { message: string }> {
    this.domainLogger.logInfo(
      "template-render",
      "Starting unified template rendering",
      {
        templateFormat: template.getFormat(),
        isArrayData: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 1,
      },
    );

    // Determine processing context based on data type and template content
    const contextResult = this.determineProcessingContext(
      template,
      data,
      verbosityMode,
    );
    if (!contextResult.ok) {
      return contextResult;
    }

    const context = contextResult.data;
    const effectiveData = Array.isArray(data) ? data[0] : data; // Use first item for template processing context

    this.domainLogger.logDebug(
      "template-render",
      "Processing context determined",
      {
        operation: "template-render",
        contextType: context.processingType,
        hasArrayData: context.hasArrayData,
        timestamp: new Date().toISOString(),
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
      this.domainLogger.logError(
        "template-render",
        replacementResult.error,
        {
          operation: "template-render",
          templateFormat: template.getFormat(),
          timestamp: new Date().toISOString(),
        },
      );
      return replacementResult;
    }

    this.domainLogger.logDebug(
      "template-render",
      "Variable replacement completed successfully",
      {
        operation: "template-render",
        resultType: typeof replacementResult.data,
        timestamp: new Date().toISOString(),
      },
    );

    // Format the output
    const formatResult = this.formatOutput(
      replacementResult.data,
      template.getFormat(),
    );

    if (formatResult.ok) {
      this.domainLogger.logInfo(
        "template-render",
        "Unified template rendering completed successfully",
        {
          operation: "template-render",
          outputLength: formatResult.data.length,
          timestamp: new Date().toISOString(),
        },
      );
    } else {
      this.domainLogger.logError(
        "template-render",
        formatResult.error,
        {
          operation: "template-render",
          templateFormat: template.getFormat(),
          timestamp: new Date().toISOString(),
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
    verbosityMode: VerbosityMode,
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
        this.domainLogger.logDebug(
          "template-context",
          "Determined array expansion context",
          {
            operation: "context-determination",
            arrayLength: plainDataArray.length,
            timestamp: new Date().toISOString(),
          },
        );
        return ProcessingContext.forArrayExpansion(
          plainDataArray,
          verbosityMode,
        );
      } else {
        this.domainLogger.logDebug(
          "template-context",
          "Determined array processing context",
          {
            operation: "context-determination",
            arrayLength: plainDataArray.length,
            timestamp: new Date().toISOString(),
          },
        );
        return ProcessingContext.forArrayProcessing(
          plainDataArray,
          verbosityMode,
        );
      }
    }

    // Single item processing
    this.domainLogger.logDebug(
      "template-context",
      "Determined single item context",
      {
        operation: "context-determination",
        timestamp: new Date().toISOString(),
      },
    );
    return ProcessingContext.forSingleItem(verbosityMode);
  }

  /**
   * Format the processed data according to template format.
   * Handles all supported output formats consistently.
   */
  private formatOutput(
    data: unknown,
    format: "json" | "yaml" | "markdown",
  ): Result<string, TemplateError & { message: string }> {
    this.domainLogger.logDebug(
      "template-format",
      `Formatting output as ${format}`,
      {
        operation: "output-formatting",
        format,
        dataType: typeof data,
        isArray: Array.isArray(data),
        timestamp: new Date().toISOString(),
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
        this.domainLogger.logError(
          "template-format",
          createError({
            kind: "InvalidTemplate",
            message: `Invalid format: ${format}`,
          }),
          {
            operation: "output-formatting",
            format,
            timestamp: new Date().toISOString(),
          },
        );
        return err(error);
      }
    }

    if (result.ok) {
      this.domainLogger.logDebug(
        "template-format",
        `Successfully formatted output as ${format}`,
        {
          operation: "output-formatting",
          outputLength: result.data.length,
          timestamp: new Date().toISOString(),
        },
      );
    } else {
      this.domainLogger.logError(
        "template-format",
        result.error,
        {
          operation: "output-formatting",
          format,
          timestamp: new Date().toISOString(),
        },
      );
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
