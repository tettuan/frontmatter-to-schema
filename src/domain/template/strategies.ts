/**
 * Template Processing Strategies
 *
 * Implements strategy pattern for different template processing approaches
 * Following the principle from AI domain template:
 * - Primary: AI-based processing (Claude)
 * - Fallback: Native TypeScript processing
 */

import type { Result } from "../core/result.ts";
import type { ValidationError } from "../shared/errors.ts";
import { createValidationError } from "../shared/errors.ts";
import type { Template } from "../models/template.ts";
import type { TemplateApplicationContext } from "./aggregate.ts";
import type { AIAnalyzerPort } from "../../infrastructure/ports/ai-analyzer.ts";

// Re-export for external use
export type { TemplateApplicationContext };
import { TemplateFormatHandlerFactory } from "./format-handlers.ts";
import {
  type PlaceholderProcessingContext,
  PlaceholderProcessor,
} from "./placeholder-processor.ts";
import { LoggerFactory } from "../shared/logging/logger.ts";

/**
 * Strategy interface for template processing
 */
export interface TemplateProcessingStrategy {
  /**
   * Process a template with the given context
   */
  process(
    template: Template,
    context: TemplateApplicationContext,
  ): Promise<Result<string, ValidationError>>;

  /**
   * Check if this strategy can handle the given template
   */
  canHandle(template: Template): boolean;

  /**
   * Get strategy name for logging/debugging
   */
  getName(): string;
}

/**
 * AI-based template processing strategy (Primary)
 * Delegates template application to Claude AI
 */
export class AITemplateStrategy implements TemplateProcessingStrategy {
  constructor(private readonly aiAnalyzer: AIAnalyzerPort) {}

  async process(
    template: Template,
    context: TemplateApplicationContext,
  ): Promise<Result<string, ValidationError>> {
    const prompt = this.buildPrompt(template, context);

    const result = await this.aiAnalyzer.analyze({
      content: JSON.stringify({
        extractedData: context.extractedData,
        schema: context.schema,
        template: template.getDefinition().getDefinition(),
        format: context.format,
      }),
      prompt,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: createValidationError(
          `AI template processing failed: ${result.error.message}`,
        ),
      };
    }

    return {
      ok: true,
      data: result.data.result,
    };
  }

  canHandle(_template: Template): boolean {
    // AI can handle all template formats
    return true;
  }

  getName(): string {
    return "AITemplateStrategy";
  }

  private buildPrompt(
    template: Template,
    context: TemplateApplicationContext,
  ): string {
    return `
テンプレートへの値の当て込み処理を実行してください。

【入力情報】
1. Schemaで解釈されたデータ:
${JSON.stringify(context.extractedData, null, 2)}

2. Schema定義:
${JSON.stringify(context.schema, null, 2)}

3. テンプレート:
${template.getDefinition().getDefinition()}

【処理指示】
- Schemaで解釈されたデータをテンプレートに当て込んでください
- テンプレート内の変数プレースホルダーを、対応する値で正確に置き換えてください
- Schema定義に従って、データの形式を適切に変換してください
- 出力形式: ${context.format}
- 変数が見つからない場合は、プレースホルダーをそのまま残してください

【出力要件】
- 完全に置換されたテンプレートを出力してください
- 形式は${context.format}形式で出力してください
`;
  }
}

/**
 * Native TypeScript template processing strategy (Fallback)
 * Processes templates using shared common infrastructure
 * Updated to use TemplateFormatHandler and PlaceholderProcessor
 */
export class NativeTemplateStrategy implements TemplateProcessingStrategy {
  private readonly placeholderProcessor: PlaceholderProcessor;

  constructor() {
    this.placeholderProcessor = new PlaceholderProcessor();
  }

  process(
    template: Template,
    context: TemplateApplicationContext,
  ): Promise<Result<string, ValidationError>> {
    const format = template.getDefinition().getFormat();

    // Check if this strategy can handle the template format
    if (!this.canHandle(template)) {
      return Promise.resolve({
        ok: false,
        error: createValidationError(
          `NativeTemplateStrategy cannot handle format: ${format}`,
        ),
      });
    }

    try {
      // Get appropriate format handler from factory
      const handlerResult = TemplateFormatHandlerFactory.getHandler(format);
      if (!handlerResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createValidationError(
            `Unsupported template format for native processing: ${format}. ${handlerResult.error.message}`,
          ),
        });
      }

      const handler = handlerResult.data;
      const templateContent = template.getDefinition().getDefinition();

      // Parse template using format handler
      const parseResult = handler.parse(templateContent);
      if (!parseResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createValidationError(
            `Failed to parse template: ${parseResult.error.message}`,
          ),
        });
      }

      // Validate that extractedData is an object for placeholder processing
      if (
        context.extractedData === null || context.extractedData === undefined ||
        typeof context.extractedData !== "object" ||
        Array.isArray(context.extractedData)
      ) {
        return Promise.resolve({
          ok: false,
          error: createValidationError(
            `Template processing requires extractedData to be an object, received: ${typeof context
              .extractedData}`,
          ),
        });
      }

      // Process placeholders using unified processor
      const placeholderContext: PlaceholderProcessingContext = {
        data: context.extractedData as Record<string, unknown>,
        patternType: "mustache", // Default to mustache style
        strictMode: false, // Allow partial replacements
      };

      const placeholderResult = this.placeholderProcessor.process(
        parseResult.data,
        placeholderContext,
      );

      if (!placeholderResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createValidationError(
            `Placeholder processing failed: ${placeholderResult.error.message}`,
          ),
        });
      }

      const processResult = placeholderResult.data;

      // Handle processing results based on kind
      let processedData: unknown;
      switch (processResult.kind) {
        case "Success":
          processedData = processResult.processedContent;
          break;
        case "PartialSuccess": {
          // Log warning for missing placeholders but continue
          const logger = LoggerFactory.createLogger("native-strategy");
          logger.warn(
            "Template processing completed with missing placeholders",
            {
              missingPlaceholders: processResult.missingPlaceholders,
            },
          );
          processedData = processResult.processedContent;
          break;
        }
        case "Failure":
          return Promise.resolve({
            ok: false,
            error: processResult.error,
          });
      }

      // Serialize result using format handler
      const serializeResult = handler.serialize(processedData);
      if (!serializeResult.ok) {
        return Promise.resolve({
          ok: false,
          error: createValidationError(
            `Failed to serialize processed template: ${serializeResult.error.message}`,
          ),
        });
      }

      return Promise.resolve({
        ok: true,
        data: serializeResult.data,
      });
    } catch (error) {
      return Promise.resolve({
        ok: false,
        error: createValidationError(
          `Native template processing failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      });
    }
  }

  canHandle(template: Template): boolean {
    const format = template.getDefinition().getFormat();
    // Native strategy can handle json, yaml, and custom formats
    return ["json", "yaml", "custom"].includes(format);
  }

  getName(): string {
    return "NativeTemplateStrategy";
  }

  // Removed duplicate methods that are now handled by shared infrastructure:
  // - processJsonTemplate: replaced by TemplateFormatHandlerFactory
  // - processYamlTemplate: replaced by TemplateFormatHandlerFactory
  // - processCustomTemplate: replaced by TemplateFormatHandlerFactory
  // - applyDataToTemplate: replaced by PlaceholderProcessor
  // - getValueByPath: replaced by PlaceholderProcessor
  // - convertToYaml: replaced by YAMLTemplateHandler
  // - dataToYaml: replaced by YAMLTemplateHandler
}

/**
 * Composite strategy that tries AI first, then falls back to native
 */
export class CompositeTemplateStrategy implements TemplateProcessingStrategy {
  constructor(
    private readonly primary: TemplateProcessingStrategy,
    private readonly fallback: TemplateProcessingStrategy,
  ) {}

  async process(
    template: Template,
    context: TemplateApplicationContext,
  ): Promise<Result<string, ValidationError>> {
    // Try primary strategy first
    if (this.primary.canHandle(template)) {
      const result = await this.primary.process(template, context);
      if (result.ok) {
        return result;
      }

      // Log primary failure (in production, use proper logger)
      const logger = LoggerFactory.createLogger("fallback-strategy");
      logger.warn("Primary strategy failed, using fallback", {
        primaryStrategy: this.primary.getName(),
        error: result.error.message,
      });
    }

    // Fall back to secondary strategy
    if (this.fallback.canHandle(template)) {
      return this.fallback.process(template, context);
    }

    return {
      ok: false,
      error: createValidationError(
        "No suitable strategy found for template processing",
      ),
    };
  }

  canHandle(template: Template): boolean {
    return this.primary.canHandle(template) ||
      this.fallback.canHandle(template);
  }

  getName(): string {
    return `CompositeStrategy(${this.primary.getName()}, ${this.fallback.getName()})`;
  }
}
