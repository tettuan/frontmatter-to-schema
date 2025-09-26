import { err, ok, Result } from "../../shared/types/result.ts";
import { DomainError } from "../../shared/types/errors.ts";
import { ErrorHandler } from "../../shared/services/unified-error-handler.ts";
import { Template } from "../entities/template.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import { TemplateRenderer } from "../renderers/template-renderer.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { VerbosityMode } from "../value-objects/processing-context.ts";
import {
  DomainLogger,
  NullDomainLogger,
} from "../../shared/services/domain-logger.ts";
import { TemplateConfiguration } from "../value-objects/template-configuration.ts";
import {
  TemplateIntermediateRepresentation,
} from "../value-objects/template-intermediate-representation.ts";
import {
  TemplateContext,
  TemplateContextBuilder,
} from "../value-objects/template-context.ts";

export type DataConfiguration =
  | { readonly kind: "SingleData"; readonly data: FrontmatterData }
  | {
    readonly kind: "ArrayData";
    readonly mainData: FrontmatterData;
    readonly itemsData: FrontmatterData[];
  };

export interface RenderingConfiguration {
  readonly templateConfig: TemplateConfiguration;
  readonly dataConfig: DataConfiguration;
  readonly outputPath: string;
  readonly outputFormat: "json" | "yaml" | "markdown";
  readonly verbosityMode: VerbosityMode;
}
import { parse as parseYaml } from "jsr:@std/yaml@1.0.5";
import { TemplateStructureAnalyzer } from "./template-structure-analyzer.ts";
import { DynamicDataComposer } from "./dynamic-data-composer.ts";
import { VariableContext } from "../value-objects/variable-context.ts";
import { FormatterFactory } from "../formatters/formatter-factory.ts";
import {
  ErrorContext,
  ErrorContextFactory,
  ProcessingProgress,
} from "../../shared/types/error-context.ts";
import type {
  DomainFileReader,
  DomainFileWriter,
} from "../../shared/interfaces/file-operations.ts";

export type RenderingMode =
  | {
    readonly kind: "SingleData";
    readonly data: FrontmatterData;
  }
  | {
    readonly kind: "ArrayData";
    readonly dataArray: FrontmatterData[];
  };

/**
 * Domain service responsible for Output rendering stage of the 3-stage pipeline.
 * Handles: Template + Data → RenderedOutput + File writing
 */
export class OutputRenderingService {
  private readonly structureAnalyzer: TemplateStructureAnalyzer;
  private readonly dataComposer: DynamicDataComposer;

  private constructor(
    private readonly templateRenderer: TemplateRenderer,
    private readonly fileReader: DomainFileReader,
    private readonly fileWriter: DomainFileWriter,
    private readonly structureAnalyzerInstance: TemplateStructureAnalyzer,
    private readonly dataComposerInstance: DynamicDataComposer,
    private readonly domainLogger: DomainLogger = new NullDomainLogger(),
  ) {
    this.structureAnalyzer = structureAnalyzerInstance;
    this.dataComposer = dataComposerInstance;
  }

  static create(
    templateRenderer: TemplateRenderer,
    fileReader: DomainFileReader,
    fileWriter: DomainFileWriter,
    domainLogger?: DomainLogger,
  ): Result<OutputRenderingService, DomainError> {
    // Initialize DDD services following Totality pattern
    const analyzerResult = TemplateStructureAnalyzer.create();
    if (!analyzerResult.ok) {
      return ErrorHandler.system({
        operation: "create",
        method: "initializeAnalyzer",
      }).initializationError("Failed to create TemplateStructureAnalyzer");
    }

    const composerResult = DynamicDataComposer.create();
    if (!composerResult.ok) {
      return ErrorHandler.system({
        operation: "create",
        method: "initializeComposer",
      }).initializationError("Failed to create DynamicDataComposer");
    }

    return ok(
      new OutputRenderingService(
        templateRenderer,
        fileReader,
        fileWriter,
        analyzerResult.data,
        composerResult.data,
        domainLogger ?? new NullDomainLogger(),
      ),
    );
  }

  /**
   * Render data using template and write to output file using discriminated unions.
   * Follows Totality principle - all error paths handled explicitly.
   * This method replaces optional parameters with type-safe discriminated unions.
   *
   * @param config - Complete rendering configuration with template and data specifications
   */
  renderOutputWithConfiguration(
    config: RenderingConfiguration,
  ): Result<void, DomainError & { message: string }> {
    // Create ErrorContext for output rendering operation
    const contextResult = ErrorContextFactory.forDomainService(
      "OutputRenderingService",
      "Render output with configuration",
      "renderOutputWithConfiguration",
    );
    if (!contextResult.ok) {
      return err(contextResult.error);
    }

    const progressResult = ProcessingProgress.create(
      "template-rendering",
      "configuration-processing",
      [],
      3, // Total steps: config processing, template processing, data processing, rendering
    );
    if (!progressResult.ok) {
      return err(progressResult.error);
    }

    const currentContext = contextResult.data.withProgress(progressResult.data);

    this.domainLogger.logInfo(
      "template-rendering",
      `Starting template rendering with configuration`,
      {
        templateKind: config.templateConfig.kind,
        dataKind: config.dataConfig.kind,
        outputPath: config.outputPath,
        outputFormat: config.outputFormat,
        verbosityMode: config.verbosityMode.kind,
      },
    );

    // Process template configuration
    const templateResult = this.processTemplateConfiguration(
      config.templateConfig,
    );
    if (!templateResult.ok) {
      return err(templateResult.error);
    }

    // Process data configuration
    const dataResult = this.processDataConfiguration(config.dataConfig);
    if (!dataResult.ok) {
      return err(dataResult.error);
    }

    // Render using the processed configuration
    return this.executeRendering(
      templateResult.data,
      dataResult.data,
      config.outputPath,
      config.outputFormat,
      config.verbosityMode,
      currentContext,
    );
  }

  /**
   * Renders output to file using Template Intermediate Representation
   *
   * This method accepts IR containing normalized variable mappings, template paths,
   * and metadata to produce the final output. The IR provides scope management
   * and variable resolution, eliminating the need for direct data partitioning.
   *
   * @param intermediateRepresentation - IR containing normalized variable scope and template info
   * @param outputPath - Output file path
   * @param verbosityMode - Logging verbosity configuration
   * @returns Success/failure result
   */
  renderOutputFromIR(
    intermediateRepresentation: TemplateIntermediateRepresentation,
    outputPath: string,
    verbosityMode: VerbosityMode = { kind: "normal" },
  ): Result<void, DomainError & { message: string }> {
    // Create ErrorContext for output rendering operation
    const contextResult = ErrorContextFactory.forDomainService(
      "OutputRenderingService",
      "Render output from IR",
      "renderOutputFromIR",
    );
    if (!contextResult.ok) {
      return contextResult;
    }

    // Create TemplateContext from IR
    const templateContext = TemplateContextBuilder.fromIR(
      intermediateRepresentation,
    );

    // Use existing template rendering infrastructure
    return this.renderFromTemplateContext(
      templateContext,
      outputPath,
      verbosityMode,
      contextResult.data,
    );
  }

  /**
   * Internal method to render from TemplateContext
   */
  private renderFromTemplateContext(
    context: TemplateContext,
    outputPath: string,
    _verbosityMode: VerbosityMode,
    _currentContext: ErrorContext,
  ): Result<void, DomainError & { message: string }> {
    // Load main template using proper template loading logic
    const mainTemplateResult = this.loadTemplate(
      context.renderingOptions.templatePaths.main,
    );
    if (!mainTemplateResult.ok) {
      return mainTemplateResult;
    }

    // Load items template if specified
    let _itemsTemplate: Template | undefined;
    if (context.renderingOptions.templatePaths.items) {
      const itemsTemplateResult = this.loadTemplate(
        context.renderingOptions.templatePaths.items,
      );
      if (!itemsTemplateResult.ok) {
        return itemsTemplateResult;
      }
      _itemsTemplate = itemsTemplateResult.data;
    }

    // Render using the template context
    const frontmatterResult = FrontmatterData.create(context.mainVariables);
    if (!frontmatterResult.ok) {
      return frontmatterResult;
    }

    const renderedResult = this.templateRenderer.render(
      mainTemplateResult.data,
      frontmatterResult.data,
      { kind: "normal" },
    );

    if (!renderedResult.ok) {
      return renderedResult;
    }

    // Write output to file
    const outputFormat = (context.renderingOptions.format || "json") as
      | "json"
      | "yaml"
      | "markdown";
    const formatResult = FormatterFactory.createFormatter(outputFormat);
    if (!formatResult.ok) {
      return formatResult;
    }

    // Parse and format the output
    let finalOutput: string;
    try {
      const parsed = JSON.parse(renderedResult.data);
      const formattedResult = formatResult.data.format(parsed);
      if (!formattedResult.ok) {
        return formattedResult;
      }
      finalOutput = formattedResult.data;
    } catch {
      finalOutput = renderedResult.data;
    }

    return this.fileWriter.write(outputPath, finalOutput);
  }

  /**
   * Legacy render method using optional parameters.
   * @deprecated Use renderOutputFromIR for IR-based processing
   *
   * Render data using template and write to output file.
   * Follows Totality principle - all error paths handled explicitly.
   * @param templatePath - Main template path (x-template)
   * @param itemsTemplatePath - Optional items template path (x-template-items)
   * @param mainData - Data for main template
   * @param itemsData - Optional array data for items template
   * @param outputPath - Output file path
   * @param outputFormat - Optional output format (defaults to "json")
   */
  renderOutput(
    templatePath: string,
    itemsTemplatePath: string | undefined,
    mainData: FrontmatterData,
    itemsData: FrontmatterData[] | undefined,
    outputPath: string,
    outputFormat: "json" | "yaml" | "markdown" = "json",
    verbosityMode: VerbosityMode = { kind: "normal" },
  ): Result<void, DomainError & { message: string }> {
    // Create ErrorContext for output rendering operation
    const contextResult = ErrorContextFactory.forDomainService(
      "OutputRenderingService",
      "Render output",
      "renderOutput",
    );
    if (!contextResult.ok) {
      return contextResult;
    }

    const context = contextResult.data
      .withInput("templatePath", templatePath)
      .withInput("itemsTemplatePath", itemsTemplatePath)
      .withInput("hasItemsData", !!itemsData)
      .withInput("outputPath", outputPath)
      .withInput("outputFormat", outputFormat);

    // Create processing progress tracker
    const progressResult = ProcessingProgress.create(
      "Template Rendering",
      "Loading main template",
      [],
      4,
    );
    if (!progressResult.ok) {
      return progressResult;
    }

    const currentContext = context.withProgress(progressResult.data);

    // 🔍 DEBUG: Input data analysis
    this.domainLogger.logInfo(
      "input-data-debug",
      `Input data analysis for template rendering`,
      {
        mainDataKeys: mainData.getAllKeys(),
        mainDataSample: JSON.stringify(mainData.toJSON(), null, 2).slice(
          0,
          500,
        ),
        itemsDataCount: itemsData?.length || 0,
        itemsDataFirstSample: itemsData?.[0]
          ? JSON.stringify(itemsData[0].toJSON(), null, 2).slice(0, 300)
          : "none",
      },
    );

    this.domainLogger.logInfo(
      "template-rendering",
      `Starting template rendering pipeline`,
      {
        templatePath,
        itemsTemplatePath,
        hasItemsData: !!itemsData,
        outputPath,
        outputFormat,
        context: currentContext.getDebugInfo(),
      },
    );

    // Stage 1: Load and create template(s)
    this.domainLogger.logDebug(
      "template-loading",
      `Loading template from: ${templatePath}`,
    );
    const templateResult = this.loadTemplate(templatePath);
    if (!templateResult.ok) {
      this.domainLogger.logError("template-loading", templateResult.error, {
        templatePath,
        context: currentContext.getDebugInfo(),
      });
      return templateResult;
    }

    this.domainLogger.logDebug(
      "template-loading",
      `Successfully loaded template: ${templatePath}`,
    );

    // Load items template if provided
    let itemsTemplateResult:
      | Result<Template, DomainError & { message: string }>
      | undefined;
    if (itemsTemplatePath) {
      this.domainLogger.logDebug(
        "template-loading",
        `Loading items template from: ${itemsTemplatePath}`,
      );
      itemsTemplateResult = this.loadTemplate(itemsTemplatePath);
      if (!itemsTemplateResult.ok) {
        this.domainLogger.logError(
          "template-loading",
          itemsTemplateResult.error,
          {
            itemsTemplatePath,
          },
        );
        return itemsTemplateResult;
      }
      this.domainLogger.logDebug(
        "template-loading",
        `Successfully loaded items template: ${itemsTemplatePath}`,
      );
    }

    // Stage 2: Render data with template
    this.domainLogger.logInfo(
      "template-rendering-stage",
      `Starting template rendering`,
      {
        hasItemsTemplate: !!itemsTemplatePath,
        hasItemsData: !!itemsData,
        itemsCount: itemsData?.length ?? 0,
      },
    );

    let renderResult: Result<string, DomainError & { message: string }>;

    // Analyze template structure to determine processing strategy
    const structureResult = this.structureAnalyzer.analyzeStructure(
      templateResult.data,
    );
    if (!structureResult.ok) {
      this.domainLogger.logError(
        "template-structure-analysis",
        structureResult.error,
      );
      return structureResult;
    }

    const templateStructure = structureResult.data;

    // If we have both items template and items data, use dual-template rendering
    if (
      itemsTemplatePath && itemsTemplateResult && itemsTemplateResult.ok &&
      itemsData
    ) {
      // First render each item with the items template
      const renderedItems: string[] = [];
      for (const item of itemsData) {
        this.domainLogger.logDebug(
          "template-rendering-stage",
          "Processing item for template rendering",
          {
            itemType: typeof item,
            itemKeys: typeof item === "object" && item !== null
              ? Object.keys(item)
              : "N/A",
            itemPreview: JSON.stringify(item).slice(0, 200),
          },
        );

        // The item should already be a FrontmatterData object
        // (itemsData parameter is typed as FrontmatterData[])
        const itemData = item;

        this.domainLogger.logDebug(
          "template-rendering-stage",
          "Using existing FrontmatterData item",
          {
            canAccessId: itemData.get("id").ok,
            canAccessIdFull: itemData.get("id.full").ok,
            canAccessC1: itemData.get("c1").ok,
            canAccessC2: itemData.get("c2").ok,
            canAccessDescription: itemData.get("description").ok,
            c1Value: (() => {
              const r = itemData.get("c1");
              return r.ok ? r.data : "NOT_FOUND";
            })(),
            c2Value: (() => {
              const r = itemData.get("c2");
              return r.ok ? r.data : "NOT_FOUND";
            })(),
          },
        );

        const itemResult = this.templateRenderer.render(
          itemsTemplateResult.data,
          itemData,
          verbosityMode,
        );
        if (!itemResult.ok) {
          this.domainLogger.logError(
            "template-rendering-stage",
            itemResult.error,
            {
              itemsTemplatePath,
            },
          );
          return itemResult;
        }
        renderedItems.push(itemResult.data);
      }

      // ✅ DDD Fix: Use dynamic data composition instead of hardcoded 'items'
      const composedDataResult = this.dataComposer.createDualTemplateData(
        mainData,
        renderedItems,
      );
      if (!composedDataResult.ok) {
        this.domainLogger.logError(
          "data-composition",
          composedDataResult.error,
        );
        return composedDataResult;
      }

      // Create variable context from composed data
      this.domainLogger.logDebug(
        "variable-context-debug",
        "Creating VariableContext from composed data",
        {
          composedDataKeys: Object.keys(composedDataResult.data.mainData),
          composedDataSample: JSON.stringify(
            composedDataResult.data.mainData,
            null,
            2,
          ).slice(0, 500),
          hasArrayData: !!composedDataResult.data.arrayData,
          arrayDataLength: composedDataResult.data.arrayData?.length || 0,
        },
      );

      const contextResult = VariableContext.fromComposedData(
        composedDataResult.data,
      );
      if (!contextResult.ok) {
        this.domainLogger.logError(
          "variable-context-creation",
          contextResult.error,
        );
        return contextResult;
      }

      this.domainLogger.logDebug(
        "variable-context-debug",
        "VariableContext created successfully",
        {
          contextType: typeof contextResult.data,
          contextHasData: !!contextResult.data,
        },
      );

      // Render with main template using proper context
      // Since we have composedDataResult.data.arrayData, we need to ensure
      // the template renderer knows about it for {@items} expansion

      // ✅ DDD Fix: Enhanced data composition for {@items} expansion following Totality principles
      this.domainLogger.logDebug(
        "dual-template-rendering",
        "Data composition for {@items} expansion",
        {
          mainDataKeys: Object.keys(composedDataResult.data.mainData),
          hasArrayData: !!composedDataResult.data.arrayData,
          arrayDataLength: composedDataResult.data.arrayData?.length || 0,
        },
      );

      const finalFrontmatterResult = FrontmatterData.create(
        composedDataResult.data.mainData,
      );
      if (!finalFrontmatterResult.ok) {
        this.domainLogger.logError(
          "frontmatter-data-creation",
          finalFrontmatterResult.error,
        );
        return finalFrontmatterResult;
      }

      this.domainLogger.logDebug(
        "template-variable-debug",
        "FrontmatterData created for template rendering",
        {
          frontmatterDataKeys: Object.keys(
            finalFrontmatterResult.data.toJSON(),
          ),
          frontmatterDataSample: JSON.stringify(
            finalFrontmatterResult.data.toJSON(),
            null,
            2,
          ).slice(0, 500),
        },
      );

      // ✅ DDD Fix: Verify proper data structure for {@items} expansion
      this.domainLogger.logDebug(
        "dual-template-rendering",
        "Final frontmatter data prepared for template rendering",
        {
          hasComposedData: !!composedDataResult.data.mainData,
          hasArrayData: !!composedDataResult.data.arrayData,
        },
      );

      // If we have arrayData from composition, use array-aware rendering
      if (composedDataResult.data.arrayData) {
        this.domainLogger.logDebug(
          "template-rendering-debug",
          "Rendering with array data for {@items} expansion",
          {
            templateContent: String(
              (templateResult.data as any).getContent?.() ||
                templateResult.data,
            ).slice(0, 200),
            arrayDataCount: composedDataResult.data.arrayData.length,
            firstArrayItem: composedDataResult.data.arrayData[0]
              ? JSON.stringify(composedDataResult.data.arrayData[0], null, 2)
                .slice(0, 300)
              : "none",
          },
        );

        // ✅ DDD Fix: Enhanced template rendering with proper context for {@items} expansion
        renderResult = this.templateRenderer.render(
          templateResult.data,
          finalFrontmatterResult.data,
          verbosityMode,
        );
      } else {
        this.domainLogger.logDebug(
          "template-rendering-debug",
          "Rendering without array data",
          {
            templateContent: String(
              (templateResult.data as any).getContent?.() ||
                templateResult.data,
            ).slice(0, 200),
            frontmatterKeys: Object.keys(finalFrontmatterResult.data.toJSON()),
          },
        );

        renderResult = this.templateRenderer.render(
          templateResult.data,
          finalFrontmatterResult.data,
          verbosityMode,
        );
      }

      this.domainLogger.logDebug(
        "template-rendering-result",
        "Template rendering completed",
        {
          renderSuccess: renderResult.ok,
          renderError: renderResult.ok ? null : renderResult.error.message,
          renderResultPreview: renderResult.ok
            ? renderResult.data.slice(0, 300)
            : "failed",
        },
      );
    } else if (itemsData) {
      // ✅ DDD Fix: Use dynamic data composition for array rendering
      const composedDataResult = this.dataComposer.compose(
        mainData,
        itemsData,
        templateStructure.getArrayExpansionKeys(),
      );
      if (!composedDataResult.ok) {
        this.domainLogger.logError(
          "array-data-composition",
          composedDataResult.error,
        );
        return composedDataResult;
      }

      // Use unified render method with proper composition
      renderResult = this.templateRenderer.render(
        templateResult.data,
        itemsData,
        verbosityMode,
      );
    } else {
      // ✅ DDD Fix: Single data rendering with proper context
      const composedDataResult = this.dataComposer.composeSingle(mainData);
      if (!composedDataResult.ok) {
        this.domainLogger.logError(
          "single-data-composition",
          composedDataResult.error,
        );
        return composedDataResult;
      }

      renderResult = this.templateRenderer.render(
        templateResult.data,
        mainData,
        verbosityMode,
      );
    }

    if (!renderResult.ok) {
      this.domainLogger.logError(
        "template-rendering-stage",
        renderResult.error,
        {
          templatePath,
          itemsTemplatePath,
        },
      );
      return renderResult;
    }

    this.domainLogger.logDebug(
      "template-rendering-stage",
      `Template rendering successful`,
      {
        outputLength: renderResult.data.length,
      },
    );

    // Stage 3: Format the rendered output
    let finalOutput: string;

    this.domainLogger.logDebug(
      "output-formatting",
      `Formatting output as ${outputFormat}`,
      { outputFormat },
    );

    const formatterResult = FormatterFactory.createFormatter(outputFormat);
    if (!formatterResult.ok) {
      this.domainLogger.logError("output-formatting", formatterResult.error, {
        outputFormat,
      });
      return formatterResult;
    }

    // Try to parse the rendered output as JSON first
    let parsedOutput: unknown;
    try {
      parsedOutput = JSON.parse(renderResult.data);

      // ✅ Fix: Convert stringified JSON arrays back to actual arrays
      parsedOutput = this.convertStringifiedArraysToObjects(parsedOutput);

      // Successfully parsed as JSON, format with the target formatter
      const formatResult = formatterResult.data.format(parsedOutput);
      if (!formatResult.ok) {
        this.domainLogger.logError("output-formatting", formatResult.error, {
          outputFormat,
        });
        return formatResult;
      }
      finalOutput = formatResult.data;
    } catch (error) {
      // If parsing as JSON fails, check if it's already in the target format
      if (outputFormat === "json") {
        // Expected JSON but couldn't parse - this is an error
        this.domainLogger.logError("output-parsing", {
          kind: "InvalidTemplate",
          message: `Failed to parse rendered output: ${error}`,
        }, { renderResult: renderResult.data });
        return ErrorHandler.template({
          operation: "renderOutput",
          method: "parseRenderedOutput",
        }).invalid(
          `Failed to parse rendered output for formatting: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      } else {
        // Non-JSON format - assume template already produces correct format
        this.domainLogger.logDebug(
          "output-direct-use",
          `Using rendered output directly for ${outputFormat}`,
          { outputFormat },
        );
        finalOutput = renderResult.data;
      }
    }

    // Stage 4: Write formatted output to file
    this.domainLogger.logDebug(
      "output-writing",
      `Writing formatted output to: ${outputPath}`,
    );
    const writeResult = this.fileWriter.write(outputPath, finalOutput);

    if (writeResult.ok) {
      this.domainLogger.logInfo(
        "template-rendering",
        `Template rendering pipeline completed successfully`,
        {
          outputPath,
          outputSize: finalOutput.length,
          outputFormat,
        },
      );
    } else {
      this.domainLogger.logError("output-writing", writeResult.error, {
        outputPath,
      });
    }

    return writeResult;
  }

  /**
   * Load template from file path and create Template entity.
   * All error cases handled with Result types.
   */
  private loadTemplate(
    templatePath: string,
  ): Result<Template, DomainError & { message: string }> {
    // Create template path value object
    const templatePathResult = TemplatePath.create(templatePath);
    if (!templatePathResult.ok) {
      return templatePathResult;
    }

    // Read template file content
    const templateContentResult = this.fileReader.read(templatePath);
    if (!templateContentResult.ok) {
      return templateContentResult;
    }

    // Parse template content (supports both JSON and YAML)
    const parseResult = this.parseTemplateContent(
      templateContentResult.data,
      templatePath,
    );
    if (!parseResult.ok) {
      return ErrorHandler.template({
        operation: "loadTemplate",
        method: "parseTemplateContent",
      }).invalid(
        `Failed to parse template content: ${parseResult.error.message}`,
      );
    }

    const templateContent = parseResult.data;

    // Create Template entity with default configuration
    return Template.createWithDefaultConfig(
      templatePathResult.data,
      templateContent,
    );
  }

  /**
   * Parse template content supporting both JSON and YAML formats.
   * Attempts JSON first, falls back to YAML if JSON parsing fails.
   */
  private parseTemplateContent(
    content: string,
    templatePath: string,
  ): Result<unknown, { message: string }> {
    this.domainLogger.logDebug(
      "template-parsing",
      `Attempting to parse template: ${templatePath}`,
      {
        contentLength: content.length,
        isLikelyJson: content.trim().startsWith("{") ||
          content.trim().startsWith("["),
      },
    );

    // Try JSON parsing first
    const jsonResult = this.safeJsonParse(content);
    if (jsonResult.ok) {
      this.domainLogger.logDebug(
        "template-parsing",
        `Successfully parsed template as JSON: ${templatePath}`,
      );
      return jsonResult;
    }

    this.domainLogger.logDebug(
      "template-parsing",
      `JSON parsing failed, attempting YAML: ${templatePath}`,
      {
        jsonError: jsonResult.error.message,
      },
    );

    // Try YAML parsing as fallback
    const yamlResult = this.safeYamlParse(content);
    if (yamlResult.ok) {
      this.domainLogger.logDebug(
        "template-parsing",
        `Successfully parsed template as YAML: ${templatePath}`,
      );
      return yamlResult;
    }

    // Both parsing methods failed
    this.domainLogger.logError("template-parsing", "Failed to parse template", {
      templatePath,
      jsonError: jsonResult.error.message,
      yamlError: yamlResult.error.message,
    });

    return ErrorHandler.template({
      operation: "parseTemplateContent",
      method: "tryBothFormats",
    }).invalid(`Failed to parse template as JSON or YAML: ${templatePath}`);
  }

  private safeJsonParse(content: string): Result<unknown, { message: string }> {
    try {
      return ok(JSON.parse(content));
    } catch (error) {
      return err({
        message: error instanceof Error
          ? error.message
          : "Unknown JSON parsing error",
      });
    }
  }

  /**
   * Recursively converts stringified JSON arrays back to actual objects/arrays.
   * This fixes the issue where @items generates stringified JSON that needs to be parsed.
   */
  private convertStringifiedArraysToObjects(obj: unknown): unknown {
    if (typeof obj === "string") {
      // Try to parse stringified JSON arrays/objects
      if (
        (obj.startsWith("[") && obj.endsWith("]")) ||
        (obj.startsWith("{") && obj.endsWith("}"))
      ) {
        try {
          const parsed = JSON.parse(obj);
          // Recursively process the parsed object
          return this.convertStringifiedArraysToObjects(parsed);
        } catch {
          // If parsing fails, return the original string
          return obj;
        }
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.convertStringifiedArraysToObjects(item));
    }

    if (obj && typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.convertStringifiedArraysToObjects(value);
      }
      return result;
    }

    return obj;
  }

  private safeYamlParse(content: string): Result<unknown, { message: string }> {
    try {
      const parsed = parseYaml(content);
      return ok(parsed);
    } catch (error) {
      return err({
        message: error instanceof Error
          ? error.message
          : "Unknown YAML parsing error",
      });
    }
  }

  /**
   * Process template configuration using discriminated union patterns.
   * Follows Totality principle with exhaustive case handling.
   */
  private processTemplateConfiguration(
    config: TemplateConfiguration,
  ): Result<
    { mainPath: string; itemsPath?: string },
    DomainError & { message: string }
  > {
    switch (config.kind) {
      case "SingleTemplate":
        this.domainLogger.logDebug(
          "template-configuration",
          "Processing single template configuration",
          { path: config.path },
        );
        return ok({ mainPath: config.path });

      case "DualTemplate":
        this.domainLogger.logDebug(
          "template-configuration",
          "Processing dual template configuration",
          { mainPath: config.mainPath, itemsPath: config.itemsPath },
        );
        return ok({ mainPath: config.mainPath, itemsPath: config.itemsPath });
    }
  }

  /**
   * Process data configuration using discriminated union patterns.
   * Follows Totality principle with exhaustive case handling.
   */
  private processDataConfiguration(
    config: DataConfiguration,
  ): Result<
    { mainData: FrontmatterData; itemsData?: FrontmatterData[] },
    DomainError & { message: string }
  > {
    switch (config.kind) {
      case "SingleData":
        this.domainLogger.logDebug(
          "data-configuration",
          "Processing single data configuration",
        );
        return ok({ mainData: config.data });

      case "ArrayData":
        this.domainLogger.logDebug(
          "data-configuration",
          "Processing array data configuration",
          {
            mainDataKeys: config.mainData.getAllKeys().length,
            itemsCount: config.itemsData.length,
          },
        );
        return ok({ mainData: config.mainData, itemsData: config.itemsData });
    }
  }

  /**
   * Execute the rendering with processed configuration.
   * This is the core rendering logic extracted from the legacy method.
   */
  private executeRendering(
    templateConfig: { mainPath: string; itemsPath?: string },
    dataConfig: { mainData: FrontmatterData; itemsData?: FrontmatterData[] },
    outputPath: string,
    outputFormat: "json" | "yaml" | "markdown",
    verbosityMode: VerbosityMode,
    _context: any,
  ): Result<void, DomainError & { message: string }> {
    // Use the existing renderOutput method implementation
    // This delegates to the legacy method while we transition
    return this.renderOutput(
      templateConfig.mainPath,
      templateConfig.itemsPath,
      dataConfig.mainData,
      dataConfig.itemsData,
      outputPath,
      outputFormat,
      verbosityMode,
    );
  }
}
