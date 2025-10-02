import { Result } from "../../shared/types/result.ts";
import { TemplateError } from "../../shared/types/errors.ts";
import { Template } from "../entities/template.ts";
import { TemplatePath } from "../value-objects/template-path.ts";
import { ItemsDetectionResult, ItemsDetector } from "./items-detector.ts";
import {
  ItemsExpander,
  ItemsExpansionContext,
  ItemsExpansionResult,
} from "./items-expander.ts";
import { DIRECTIVE_NAMES } from "../../schema/constants/directive-names.ts";

type TemplateSource =
  | typeof DIRECTIVE_NAMES.TEMPLATE
  | typeof DIRECTIVE_NAMES.TEMPLATE_ITEMS;

/**
 * Template reference information for {@items} expansion.
 */
export interface TemplateReference {
  readonly source: TemplateSource;
  readonly templatePath: string;
  readonly isRequired: boolean;
}

/**
 * Processing context for {@items} expansion containing all necessary data.
 */
export interface ItemsProcessingContext {
  readonly containerTemplate: Template;
  readonly itemsTemplateRef?: TemplateReference;
  readonly arrayData: readonly unknown[];
  readonly globalVariables: Record<string, unknown>;
}

/**
 * Complete result of {@items} processing.
 */
export interface ItemsProcessingResult {
  readonly processedTemplate: Template;
  readonly detectionResult: ItemsDetectionResult;
  readonly expansionResult?: ItemsExpansionResult;
  readonly wasExpanded: boolean;
}

/**
 * Processing errors following totality principle.
 */
export type ItemsProcessingError =
  | { kind: "DetectionError"; error: string }
  | { kind: "ExpansionError"; error: string }
  | { kind: "TemplateLoadError"; templatePath: string; error: string }
  | { kind: "InvalidProcessingContext"; reason: string }
  | { kind: "MultipleItemsPatterns"; patterns: string[] };

/**
 * Port interface for template loading operations.
 */
export interface ItemsTemplateLoader {
  loadTemplate(path: TemplatePath): Promise<Result<Template, TemplateError>>;
}

/**
 * Service for orchestrating {@items} detection and expansion.
 * Coordinates between Template and Schema domains for x-template-items processing.
 */
export class ItemsProcessor {
  private constructor(
    private readonly detector: ItemsDetector,
    private readonly expander: ItemsExpander,
    private readonly templateLoader: ItemsTemplateLoader,
  ) {}

  /**
   * Creates an ItemsProcessor with required dependencies.
   */
  static create(
    detector: ItemsDetector,
    expander: ItemsExpander,
    templateLoader: ItemsTemplateLoader,
  ): ItemsProcessor {
    return new ItemsProcessor(detector, expander, templateLoader);
  }

  /**
   * Processes {@items} patterns in a template with given context.
   * Returns processed template or original if no expansion needed.
   */
  async processItems(
    context: ItemsProcessingContext,
  ): Promise<Result<ItemsProcessingResult, TemplateError>> {
    try {
      // Validate processing context
      const contextValidation = this.validateProcessingContext(context);
      if (contextValidation.isError()) {
        return Result.error(
          this.convertProcessingErrorToTemplateError(
            contextValidation.unwrapError(),
          ),
        );
      }

      // Detect {@items} patterns in container template
      const detectionResult = this.detector.detectItems(
        context.containerTemplate.getContent(),
      );

      if (detectionResult.isError()) {
        return Result.error(detectionResult.unwrapError());
      }

      const detection = detectionResult.unwrap();

      // If no {@items} patterns found, return original template
      if (!detection.hasItems) {
        return Result.ok({
          processedTemplate: context.containerTemplate,
          detectionResult: detection,
          wasExpanded: false,
        });
      }

      // Validate patterns
      const patternValidation = this.detector.validateItemsPatterns(
        detection.patterns,
      );
      if (patternValidation.isError()) {
        return Result.error(patternValidation.unwrapError());
      }

      // Process expansion based on whether x-template-items is available
      if (context.itemsTemplateRef) {
        return await this.processWithItemsTemplate(context, detection);
      } else {
        return this.processWithoutItemsTemplate(context, detection);
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Unknown error";
      return Result.error(
        new TemplateError(
          `Items processing failed: ${errorMessage}`,
          "ITEMS_PROCESSING_ERROR",
          { context, error },
        ),
      );
    }
  }

  /**
   * Processes {@items} patterns when x-template-items is specified.
   */
  private async processWithItemsTemplate(
    context: ItemsProcessingContext,
    detection: ItemsDetectionResult,
  ): Promise<Result<ItemsProcessingResult, TemplateError>> {
    if (!context.itemsTemplateRef) {
      return Result.error(
        new TemplateError(
          "Items template reference is required but not provided",
          "MISSING_ITEMS_TEMPLATE",
          { context },
        ),
      );
    }

    // Load items template
    const itemsTemplatePathResult = TemplatePath.create(
      context.itemsTemplateRef.templatePath,
    );

    if (itemsTemplatePathResult.isError()) {
      return Result.error(itemsTemplatePathResult.unwrapError());
    }

    const itemsTemplateResult = await this.templateLoader.loadTemplate(
      itemsTemplatePathResult.unwrap(),
    );

    if (itemsTemplateResult.isError()) {
      return Result.error(
        this.convertProcessingErrorToTemplateError({
          kind: "TemplateLoadError",
          templatePath: context.itemsTemplateRef.templatePath,
          error: itemsTemplateResult.unwrapError().message,
        }),
      );
    }

    const itemsTemplate = itemsTemplateResult.unwrap();

    // Create expansion context
    const expansionContext: ItemsExpansionContext = {
      arrayData: context.arrayData,
      itemsTemplate,
      containerTemplate: context.containerTemplate,
      globalVariables: context.globalVariables,
    };

    // Perform expansion
    const expansionResult = await this.expander.expandItems(expansionContext);
    if (expansionResult.isError()) {
      return Result.error(expansionResult.unwrapError());
    }

    const expansion = expansionResult.unwrap();

    // Create processed template
    const processedTemplateResult = Template.create(
      context.containerTemplate.getPath(),
      {
        content: expansion.expandedContent,
        format: context.containerTemplate.getFormat(),
      },
    );

    if (processedTemplateResult.isError()) {
      return Result.error(processedTemplateResult.unwrapError());
    }

    return Result.ok({
      processedTemplate: processedTemplateResult.unwrap(),
      detectionResult: detection,
      expansionResult: expansion,
      wasExpanded: true,
    });
  }

  /**
   * Processes {@items} patterns when no x-template-items is specified.
   * Leaves {@items} patterns unexpanded as per requirements.
   */
  private processWithoutItemsTemplate(
    context: ItemsProcessingContext,
    detection: ItemsDetectionResult,
  ): Result<ItemsProcessingResult, TemplateError> {
    // When no x-template-items is specified, {@items} remains unexpanded
    const expansionResult = this.expander.expandItemsWithoutTemplate(
      context.containerTemplate.getContent(),
    );

    if (expansionResult.isError()) {
      return Result.error(expansionResult.unwrapError());
    }

    return Result.ok({
      processedTemplate: context.containerTemplate,
      detectionResult: detection,
      expansionResult: expansionResult.unwrap(),
      wasExpanded: false,
    });
  }

  /**
   * Checks if a template requires items processing.
   */
  requiresItemsProcessing(template: Template): boolean {
    const detectionResult = this.detector.detectItems(template.getContent());
    return detectionResult.isOk() && detectionResult.unwrap().hasItems;
  }

  /**
   * Extracts items template reference from schema context.
   * This is a port method that should be implemented by the caller.
   */
  static createTemplateReference(
    templatePath: string,
    source: TemplateSource = DIRECTIVE_NAMES.TEMPLATE_ITEMS,
  ): TemplateReference {
    return {
      source,
      templatePath,
      isRequired: source === DIRECTIVE_NAMES.TEMPLATE_ITEMS,
    };
  }

  /**
   * Validates the processing context for correctness.
   */
  private validateProcessingContext(
    context: ItemsProcessingContext,
  ): Result<void, ItemsProcessingError> {
    if (!context.containerTemplate) {
      return Result.error({
        kind: "InvalidProcessingContext",
        reason: "Container template is required",
      });
    }

    if (!Array.isArray(context.arrayData)) {
      return Result.error({
        kind: "InvalidProcessingContext",
        reason: "Array data must be an array",
      });
    }

    if (
      !context.globalVariables || typeof context.globalVariables !== "object"
    ) {
      return Result.error({
        kind: "InvalidProcessingContext",
        reason: "Global variables must be an object",
      });
    }

    return Result.ok(undefined);
  }

  /**
   * Converts processing error to template error.
   */
  private convertProcessingErrorToTemplateError(
    error: ItemsProcessingError,
  ): TemplateError {
    switch (error.kind) {
      case "DetectionError":
        return new TemplateError(
          `Items detection error: ${error.error}`,
          "ITEMS_DETECTION_ERROR",
          { error: error.error },
        );
      case "ExpansionError":
        return new TemplateError(
          `Items expansion error: ${error.error}`,
          "ITEMS_EXPANSION_ERROR",
          { error: error.error },
        );
      case "TemplateLoadError":
        return new TemplateError(
          `Template load error for ${error.templatePath}: ${error.error}`,
          "TEMPLATE_LOAD_ERROR",
          { templatePath: error.templatePath, error: error.error },
        );
      case "InvalidProcessingContext":
        return new TemplateError(
          `Invalid processing context: ${error.reason}`,
          "INVALID_PROCESSING_CONTEXT",
          { reason: error.reason },
        );
      case "MultipleItemsPatterns":
        return new TemplateError(
          `Multiple {@items} patterns detected: ${error.patterns.join(", ")}`,
          "MULTIPLE_ITEMS_PATTERNS",
          { patterns: error.patterns },
        );
    }
  }
}
