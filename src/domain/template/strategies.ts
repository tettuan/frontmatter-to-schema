/**
 * Template Processing Strategies
 *
 * Implements strategy pattern for different template processing approaches
 * Following the principle from AI domain template:
 * - Primary: AI-based processing (Claude)
 * - Fallback: Native TypeScript processing
 */

import type { Result } from "../shared/result.ts";
import type { ValidationError } from "../shared/errors.ts";
import { createValidationError } from "../shared/errors.ts";
import type { Template } from "../models/template.ts";
import type { TemplateApplicationContext } from "./aggregate.ts";
import type { AIAnalyzerPort } from "../../infrastructure/ports/ai-analyzer.ts";

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
 * Processes templates using TypeScript logic
 */
export class NativeTemplateStrategy implements TemplateProcessingStrategy {
  async process(
    template: Template,
    context: TemplateApplicationContext,
  ): Promise<Result<string, ValidationError>> {
    const format = template.getDefinition().getFormat();

    try {
      // Use await to satisfy linter
      switch (format) {
        case "json":
          return await Promise.resolve(
            this.processJsonTemplate(template, context),
          );
        case "yaml":
          return await Promise.resolve(
            this.processYamlTemplate(template, context),
          );
        case "custom":
          return await Promise.resolve(
            this.processCustomTemplate(template, context),
          );
        default:
          return {
            ok: false,
            error: createValidationError(
              `Unsupported template format for native processing: ${format}`,
            ),
          };
      }
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Native template processing failed: ${error}`,
        ),
      };
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

  private processJsonTemplate(
    template: Template,
    context: TemplateApplicationContext,
  ): Result<string, ValidationError> {
    const templateDef = template.getDefinition().getDefinition();

    try {
      const parsedTemplate = JSON.parse(templateDef);
      const result = this.applyDataToTemplate(
        context.extractedData,
        parsedTemplate,
      );

      if (!result.ok) {
        return result;
      }

      return {
        ok: true,
        data: JSON.stringify(result.data, null, 2),
      };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(
          `Failed to process JSON template: ${error}`,
        ),
      };
    }
  }

  private processYamlTemplate(
    _template: Template,
    context: TemplateApplicationContext,
  ): Result<string, ValidationError> {
    const result = this.convertToYaml(context.extractedData);
    return result;
  }

  private processCustomTemplate(
    _template: Template,
    context: TemplateApplicationContext,
  ): Result<string, ValidationError> {
    // For custom templates, just return the data as JSON
    return {
      ok: true,
      data: JSON.stringify(context.extractedData, null, 2),
    };
  }

  /**
   * Apply data to template with Result type (Totality principle)
   */
  private applyDataToTemplate(
    data: unknown,
    template: unknown,
  ): Result<unknown, ValidationError> {
    if (template === null || template === undefined) {
      return { ok: true, data };
    }

    if (typeof template === "string") {
      // Check if it's a placeholder
      if (template.startsWith("{{") && template.endsWith("}}")) {
        const path = template.slice(2, -2).trim();
        const result = this.getValueByPath(data, path);
        return result;
      }
      return { ok: true, data: template };
    }

    if (Array.isArray(template)) {
      const results: unknown[] = [];
      for (const item of template) {
        const result = this.applyDataToTemplate(data, item);
        if (!result.ok) {
          return result;
        }
        results.push(result.data);
      }
      return { ok: true, data: results };
    }

    if (typeof template === "object") {
      const resultObj: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(template)) {
        const result = this.applyDataToTemplate(data, value);
        if (!result.ok) {
          return result;
        }
        resultObj[key] = result.data;
      }
      return { ok: true, data: resultObj };
    }

    return { ok: true, data: template };
  }

  /**
   * Get value by path with Result type (Totality principle)
   */
  private getValueByPath(
    data: unknown,
    path: string,
  ): Result<unknown, ValidationError> {
    const parts = path.split(".");
    let current = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return {
          ok: false,
          error: createValidationError(
            `Path "${path}" not found: value is null/undefined at "${part}"`,
          ),
        };
      }

      if (typeof current !== "object") {
        return {
          ok: false,
          error: createValidationError(
            `Path "${path}" not found: expected object at "${part}" but got ${typeof current}`,
          ),
        };
      }

      const obj = current as Record<string, unknown>;
      if (!(part in obj)) {
        return {
          ok: false,
          error: createValidationError(
            `Path "${path}" not found: property "${part}" does not exist`,
          ),
        };
      }

      current = obj[part];
    }

    return { ok: true, data: current };
  }

  /**
   * Convert data to YAML format with Result type
   */
  private convertToYaml(data: unknown): Result<string, ValidationError> {
    try {
      const yaml = this.dataToYaml(data, 0);
      return { ok: true, data: yaml };
    } catch (error) {
      return {
        ok: false,
        error: createValidationError(`Failed to convert to YAML: ${error}`),
      };
    }
  }

  private dataToYaml(data: unknown, indent: number): string {
    const indentStr = "  ".repeat(indent);

    if (data === null || data === undefined) {
      return `${indentStr}null`;
    }

    if (typeof data === "string") {
      if (data.includes(":") || data.includes("#") || data.includes('"')) {
        return `${indentStr}"${data.replace(/"/g, '\\"')}"`;
      }
      return `${indentStr}${data}`;
    }

    if (typeof data === "number" || typeof data === "boolean") {
      return `${indentStr}${data}`;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return `${indentStr}[]`;
      }
      return data
        .map((item) => {
          const itemStr = this.dataToYaml(item, indent + 1);
          return `${indentStr}- ${itemStr.trim()}`;
        })
        .join("\n");
    }

    if (typeof data === "object") {
      const entries = Object.entries(data as Record<string, unknown>);
      if (entries.length === 0) {
        return `${indentStr}{}`;
      }
      return entries
        .map(([key, value]) => {
          if (typeof value === "object" && value !== null) {
            return `${indentStr}${key}:\n${this.dataToYaml(value, indent + 1)}`;
          }
          const valueStr = this.dataToYaml(value, 0);
          return `${indentStr}${key}: ${valueStr.trim()}`;
        })
        .join("\n");
    }

    return `${indentStr}${String(data)}`;
  }
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
      console.warn(
        `Primary strategy (${this.primary.getName()}) failed: ${result.error.message}`,
      );
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
