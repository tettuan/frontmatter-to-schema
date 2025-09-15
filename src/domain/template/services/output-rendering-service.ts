import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import { TemplateRenderer } from "../renderers/template-renderer.ts";
import { FrontmatterData } from "../../frontmatter/value-objects/frontmatter-data.ts";
import { DebugLogger } from "../../../infrastructure/adapters/debug-logger.ts";
import { parse as parseYaml } from "jsr:@std/yaml@1.0.5";
import { TemplateStructureAnalyzer } from "./template-structure-analyzer.ts";
import { DynamicDataComposer } from "./dynamic-data-composer.ts";
import { VariableContext } from "../value-objects/variable-context.ts";
import { FormatterFactory } from "../formatters/formatter-factory.ts";
import {
  ErrorContextFactory,
  ProcessingProgress,
} from "../../shared/types/error-context.ts";

export type RenderingMode =
  | {
    readonly kind: "SingleData";
    readonly data: FrontmatterData;
  }
  | {
    readonly kind: "ArrayData";
    readonly dataArray: FrontmatterData[];
  };

export interface FileReader {
  read(path: string): Result<string, DomainError & { message: string }>;
}

export interface FileWriter {
  write(
    path: string,
    content: string,
  ): Result<void, DomainError & { message: string }>;
}

/**
 * Domain service responsible for Output rendering stage of the 3-stage pipeline.
 * Handles: Template + Data → RenderedOutput + File writing
 */
export class OutputRenderingService {
  private readonly structureAnalyzer: TemplateStructureAnalyzer;
  private readonly dataComposer: DynamicDataComposer;

  private constructor(
    private readonly templateRenderer: TemplateRenderer,
    private readonly fileReader: FileReader,
    private readonly fileWriter: FileWriter,
    private readonly structureAnalyzerInstance: TemplateStructureAnalyzer,
    private readonly dataComposerInstance: DynamicDataComposer,
    private readonly debugLogger?: DebugLogger,
  ) {
    this.structureAnalyzer = structureAnalyzerInstance;
    this.dataComposer = dataComposerInstance;
  }

  static create(
    templateRenderer: TemplateRenderer,
    fileReader: FileReader,
    fileWriter: FileWriter,
    debugLogger?: DebugLogger,
  ): Result<OutputRenderingService, DomainError> {
    // Initialize DDD services following Totality pattern
    const analyzerResult = TemplateStructureAnalyzer.create();
    if (!analyzerResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message: `Failed to create TemplateStructureAnalyzer`,
      }));
    }

    const composerResult = DynamicDataComposer.create();
    if (!composerResult.ok) {
      return err(createError({
        kind: "InitializationError",
        message: `Failed to create DynamicDataComposer`,
      }));
    }

    return ok(
      new OutputRenderingService(
        templateRenderer,
        fileReader,
        fileWriter,
        analyzerResult.data,
        composerResult.data,
        debugLogger,
      ),
    );
  }

  /**
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
    outputFormat: "json" | "yaml" | "toml" | "markdown" = "json",
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

    this.debugLogger?.logInfo(
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
    this.debugLogger?.logDebug(
      "template-loading",
      `Loading template from: ${templatePath}`,
    );
    const templateResult = this.loadTemplate(templatePath);
    if (!templateResult.ok) {
      this.debugLogger?.logError("template-loading", templateResult.error, {
        templatePath,
        context: currentContext.getDebugInfo(),
      });
      return templateResult;
    }

    this.debugLogger?.logDebug(
      "template-loading",
      `Successfully loaded template: ${templatePath}`,
    );

    // Load items template if provided
    let itemsTemplateResult:
      | Result<Template, DomainError & { message: string }>
      | undefined;
    if (itemsTemplatePath) {
      this.debugLogger?.logDebug(
        "template-loading",
        `Loading items template from: ${itemsTemplatePath}`,
      );
      itemsTemplateResult = this.loadTemplate(itemsTemplatePath);
      if (!itemsTemplateResult.ok) {
        this.debugLogger?.logError(
          "template-loading",
          itemsTemplateResult.error,
          {
            itemsTemplatePath,
          },
        );
        return itemsTemplateResult;
      }
      this.debugLogger?.logDebug(
        "template-loading",
        `Successfully loaded items template: ${itemsTemplatePath}`,
      );
    }

    // Stage 2: Render data with template
    this.debugLogger?.logInfo(
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
      this.debugLogger?.logError(
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
        const itemResult = this.templateRenderer.render(
          itemsTemplateResult.data,
          item,
        );
        if (!itemResult.ok) {
          this.debugLogger?.logError(
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
        this.debugLogger?.logError(
          "data-composition",
          composedDataResult.error,
        );
        return composedDataResult;
      }

      // Create variable context from composed data
      const contextResult = VariableContext.fromComposedData(
        composedDataResult.data,
      );
      if (!contextResult.ok) {
        this.debugLogger?.logError(
          "variable-context-creation",
          contextResult.error,
        );
        return contextResult;
      }

      // Render with main template using proper context
      const finalFrontmatterResult = FrontmatterData.create(
        composedDataResult.data.mainData,
      );
      if (!finalFrontmatterResult.ok) {
        return finalFrontmatterResult;
      }
      renderResult = this.templateRenderer.render(
        templateResult.data,
        finalFrontmatterResult.data,
      );
    } else if (itemsData) {
      // ✅ DDD Fix: Use dynamic data composition for array rendering
      const composedDataResult = this.dataComposer.compose(
        mainData,
        itemsData,
        templateStructure.getArrayExpansionKeys(),
      );
      if (!composedDataResult.ok) {
        this.debugLogger?.logError(
          "array-data-composition",
          composedDataResult.error,
        );
        return composedDataResult;
      }

      // Use unified render method with proper composition
      renderResult = this.templateRenderer.render(
        templateResult.data,
        itemsData,
      );
    } else {
      // ✅ DDD Fix: Single data rendering with proper context
      const composedDataResult = this.dataComposer.composeSingle(mainData);
      if (!composedDataResult.ok) {
        this.debugLogger?.logError(
          "single-data-composition",
          composedDataResult.error,
        );
        return composedDataResult;
      }

      renderResult = this.templateRenderer.render(
        templateResult.data,
        mainData,
      );
    }

    if (!renderResult.ok) {
      this.debugLogger?.logError(
        "template-rendering-stage",
        renderResult.error,
        {
          templatePath,
          itemsTemplatePath,
        },
      );
      return renderResult;
    }

    this.debugLogger?.logDebug(
      "template-rendering-stage",
      `Template rendering successful`,
      {
        outputLength: renderResult.data.length,
      },
    );

    // Stage 3: Format the rendered output
    let finalOutput: string;

    this.debugLogger?.logDebug(
      "output-formatting",
      `Formatting output as ${outputFormat}`,
      { outputFormat },
    );

    const formatterResult = FormatterFactory.createFormatter(outputFormat);
    if (!formatterResult.ok) {
      this.debugLogger?.logError("output-formatting", formatterResult.error, {
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
        this.debugLogger?.logError("output-formatting", formatResult.error, {
          outputFormat,
        });
        return formatResult;
      }
      finalOutput = formatResult.data;
    } catch (error) {
      // If parsing as JSON fails, check if it's already in the target format
      if (outputFormat === "json") {
        // Expected JSON but couldn't parse - this is an error
        this.debugLogger?.logError("output-parsing", {
          kind: "InvalidTemplate",
          message: `Failed to parse rendered output: ${error}`,
        }, { renderResult: renderResult.data });
        return err(createError({
          kind: "InvalidTemplate",
          message: `Failed to parse rendered output for formatting: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }));
      } else {
        // Non-JSON format - assume template already produces correct format
        this.debugLogger?.logDebug(
          "output-direct-use",
          `Using rendered output directly for ${outputFormat}`,
          { outputFormat },
        );
        finalOutput = renderResult.data;
      }
    }

    // Stage 4: Write formatted output to file
    this.debugLogger?.logDebug(
      "output-writing",
      `Writing formatted output to: ${outputPath}`,
    );
    const writeResult = this.fileWriter.write(outputPath, finalOutput);

    if (writeResult.ok) {
      this.debugLogger?.logInfo(
        "template-rendering",
        `Template rendering pipeline completed successfully`,
        {
          outputPath,
          outputSize: finalOutput.length,
          outputFormat,
        },
      );
    } else {
      this.debugLogger?.logError("output-writing", writeResult.error, {
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
      return err(createError({
        kind: "InvalidTemplate",
        template: templatePath,
        message:
          `Failed to parse template content: ${parseResult.error.message}`,
      }));
    }

    const templateContent = parseResult.data;

    // Create Template entity
    return Template.create(templatePathResult.data, templateContent);
  }

  /**
   * Parse template content supporting both JSON and YAML formats.
   * Attempts JSON first, falls back to YAML if JSON parsing fails.
   */
  private parseTemplateContent(
    content: string,
    templatePath: string,
  ): Result<unknown, { message: string }> {
    this.debugLogger?.logDebug(
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
      this.debugLogger?.logDebug(
        "template-parsing",
        `Successfully parsed template as JSON: ${templatePath}`,
      );
      return jsonResult;
    }

    this.debugLogger?.logDebug(
      "template-parsing",
      `JSON parsing failed, attempting YAML: ${templatePath}`,
      {
        jsonError: jsonResult.error.message,
      },
    );

    // Try YAML parsing as fallback
    const yamlResult = this.safeYamlParse(content);
    if (yamlResult.ok) {
      this.debugLogger?.logDebug(
        "template-parsing",
        `Successfully parsed template as YAML: ${templatePath}`,
      );
      return yamlResult;
    }

    // Both parsing methods failed
    const parseError = createError({
      kind: "InvalidTemplate",
      template: templatePath,
      message: `Failed to parse template as JSON or YAML: ${templatePath}`,
    });

    this.debugLogger?.logError("template-parsing", parseError, {
      jsonError: jsonResult.error.message,
      yamlError: yamlResult.error.message,
    });

    return err({
      message:
        `Failed to parse as JSON (${jsonResult.error.message}) or YAML (${yamlResult.error.message})`,
    });
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
}
