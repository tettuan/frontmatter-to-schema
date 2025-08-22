/**
 * AI-based template mapper that delegates template application to claude -p
 * 
 * Domain Template Principle:
 * - TypeScriptでテンプレートを解析する必要はない
 * - `claude -p` へテンプレート当て込みプロンプトと一緒に、テンプレートを渡し、返却結果を受け取るだけ
 * - NG: TypeScriptでの当て込み
 * - OK: `claude -p` での変換結果を受け取るだけ
 */

import type { Result } from "../shared/result.ts";
import {
  createValidationError,
  type ValidationError,
} from "../shared/errors.ts";
import type { Template } from "../models/template.ts";
import type { AIAnalyzerPort } from "../../infrastructure/ports/ai-analyzer.ts";

export interface TemplateApplicationRequest {
  extractedData: Record<string, unknown>;
  schema: object;
  template: string;
  format: "json" | "yaml" | "markdown";
}

export class AITemplateMapper {
  constructor(private readonly aiAnalyzer: AIAnalyzerPort) {}

  /**
   * Apply template using AI (claude -p)
   * The AI receives the template, extracted data, and schema,
   * then performs the variable substitution
   */
  async applyTemplate(
    extractedData: unknown,
    schema: object,
    template: Template,
  ): Promise<Result<string, ValidationError>> {
    const format = template.getDefinition().getFormat();
    const templateContent = template.getDefinition().getDefinition();

    // Build the prompt for template application
    const prompt = this.buildTemplateApplicationPrompt(
      extractedData,
      schema,
      templateContent,
      format,
    );

    // Send to AI for template application
    const result = await this.aiAnalyzer.analyze({
      content: JSON.stringify({
        extractedData,
        schema,
        template: templateContent,
      }),
      prompt,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: createValidationError(
          `Template application failed: ${result.error.message}`,
        ),
      };
    }

    return {
      ok: true,
      data: result.data.result,
    };
  }

  private buildTemplateApplicationPrompt(
    extractedData: unknown,
    schema: object,
    template: string,
    format: string,
  ): string {
    return `
テンプレートへの値の当て込み処理を実行してください。

【入力情報】
1. Schemaで解釈されたデータ:
${JSON.stringify(extractedData, null, 2)}

2. Schema定義:
${JSON.stringify(schema, null, 2)}

3. テンプレート:
${template}

【処理指示】
- Schemaで解釈されたデータをテンプレートに当て込んでください
- テンプレート内の変数プレースホルダーを、対応する値で正確に置き換えてください
- Schema定義に従って、データの形式を適切に変換してください
- 出力形式: ${format}
- 変数が見つからない場合は、プレースホルダーをそのまま残してください

【重要】
- TypeScriptでの解析や変換は行わず、AIが直接テンプレート変換を実行します
- 変換後のテンプレートは、そのまま統合に利用されます
`;
  }
}