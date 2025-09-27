import { err, ok, Result } from "../../shared/types/result.ts";
import { createError, DomainError } from "../../shared/types/errors.ts";
import { Schema } from "../../schema/entities/schema.ts";
import type { DomainFileReader } from "../../shared/interfaces/file-operations.ts";

/**
 * テンプレート管理ドメイン (Template Management Domain)
 *
 * 責務: 出力テンプレートの管理と提供
 *
 * 要求:
 * - x-template: メインコンテナのテンプレートファイルを管理する
 * - x-template-items: 配列要素展開用のテンプレートファイルを管理する
 * - x-template-format: 出力形式の指定を管理する
 * - 要求に応じてテンプレートファイルを提供する
 */
export interface TemplateConfiguration {
  readonly mainTemplate?: string;
  readonly itemsTemplate?: string;
  readonly outputFormat?: string;
}

export interface ResolvedTemplateConfiguration {
  readonly mainTemplateContent: string;
  readonly itemsTemplateContent?: string;
  readonly outputFormat: string;
}

export class TemplateManagementDomainService {
  private templateConfig: TemplateConfiguration | null = null;
  private resolvedConfig: ResolvedTemplateConfiguration | null = null;

  constructor(
    private readonly fileReader: DomainFileReader,
  ) {}

  /**
   * Smart Constructor following Totality principles
   */
  static create(
    fileReader: DomainFileReader,
  ): Result<
    TemplateManagementDomainService,
    DomainError & { message: string }
  > {
    if (!fileReader) {
      return err(createError({
        kind: "ConfigurationError",
        message: "FileReader is required for Template Management Domain",
      }));
    }

    return ok(new TemplateManagementDomainService(fileReader));
  }

  /**
   * Schemaからテンプレート指定を解析し、テンプレート設定を把握する
   * x-template, x-template-items, x-template-format を抽出する
   */
  extractTemplateConfiguration(
    schema: Schema,
  ): Result<void, DomainError & { message: string }> {
    // Extract directives
    const mainTemplateResult = this.extractDirectiveValue(schema, "x-template");
    const itemsTemplateResult = this.extractDirectiveValue(
      schema,
      "x-template-items",
    );
    const formatResult = this.extractDirectiveValue(
      schema,
      "x-template-format",
    );

    // Build config immutably
    const mainTemplate = mainTemplateResult.ok
      ? mainTemplateResult.data
      : undefined;
    const itemsTemplate = itemsTemplateResult.ok
      ? itemsTemplateResult.data
      : undefined;
    let outputFormat: string;

    if (formatResult.ok) {
      outputFormat = formatResult.data;
    } else if (mainTemplate) {
      outputFormat = this.inferFormatFromTemplatePath(mainTemplate);
    } else {
      outputFormat = "json"; // Default format
    }

    const config: TemplateConfiguration = {
      mainTemplate,
      itemsTemplate,
      outputFormat,
    };

    // Validate that at least main template is specified
    if (!config.mainTemplate) {
      return err(createError({
        kind: "ConfigurationError",
        message: "x-template directive is required but not found in schema",
      }));
    }

    this.templateConfig = config;
    return ok(void 0);
  }

  /**
   * テンプレートファイルを読み込み、解決済み設定を作成する
   * 要求に応じてテンプレートファイルを提供する準備を行う
   */
  resolveTemplateFiles(
    schemaFilePath?: string,
  ): Promise<Result<void, DomainError & { message: string }>> {
    if (!this.templateConfig) {
      return Promise.resolve(err(createError({
        kind: "InitializationError",
        message:
          "Template configuration must be extracted before resolving files",
      })));
    }

    // Resolve template paths relative to schema file directory
    const schemaDir = schemaFilePath
      ? schemaFilePath.substring(0, schemaFilePath.lastIndexOf("/"))
      : "";

    const resolveTemplatePath = (templatePath: string): string => {
      if (schemaDir && !templatePath.startsWith("/")) {
        return `${schemaDir}/${templatePath}`;
      }
      return templatePath;
    };

    // Read main template file
    const mainTemplatePath = resolveTemplatePath(
      this.templateConfig.mainTemplate!,
    );
    const mainTemplateResult = this.fileReader.read(mainTemplatePath);
    if (!mainTemplateResult.ok) {
      return Promise.resolve(err(createError({
        kind: "ConfigurationError",
        message: `Failed to read main template file: ${mainTemplatePath}`,
      })));
    }

    // Read items template file if specified
    let itemsTemplateContent: string | undefined;
    if (this.templateConfig.itemsTemplate) {
      const itemsTemplatePath = resolveTemplatePath(
        this.templateConfig.itemsTemplate,
      );
      const itemsTemplateResult = this.fileReader.read(itemsTemplatePath);
      if (!itemsTemplateResult.ok) {
        return Promise.resolve(err(createError({
          kind: "ConfigurationError",
          message: `Failed to read items template file: ${itemsTemplatePath}`,
        })));
      }
      itemsTemplateContent = itemsTemplateResult.data;
    }

    const resolvedConfig: ResolvedTemplateConfiguration = {
      mainTemplateContent: mainTemplateResult.data,
      itemsTemplateContent,
      outputFormat: this.templateConfig.outputFormat!,
    };

    this.resolvedConfig = resolvedConfig;
    return Promise.resolve(ok(void 0));
  }

  /**
   * メインテンプレートの内容を提供する
   * 要求に応じてテンプレートファイルを提供する
   */
  getMainTemplate(): Result<string, DomainError & { message: string }> {
    if (!this.resolvedConfig) {
      return err(createError({
        kind: "InitializationError",
        message: "Template files must be resolved before accessing templates",
      }));
    }

    return ok(this.resolvedConfig.mainTemplateContent);
  }

  /**
   * 配列要素展開用テンプレートの内容を提供する
   * x-template-items で指定されたテンプレートを返す
   */
  getItemsTemplate(): Result<
    string | undefined,
    DomainError & { message: string }
  > {
    if (!this.resolvedConfig) {
      return err(createError({
        kind: "InitializationError",
        message: "Template files must be resolved before accessing templates",
      }));
    }

    return ok(this.resolvedConfig.itemsTemplateContent);
  }

  /**
   * 出力形式の指定を提供する
   * x-template-format で指定された形式またはデフォルト形式を返す
   */
  getOutputFormat(): Result<string, DomainError & { message: string }> {
    if (!this.resolvedConfig) {
      return err(createError({
        kind: "InitializationError",
        message:
          "Template configuration must be resolved before accessing format",
      }));
    }

    return ok(this.resolvedConfig.outputFormat);
  }

  /**
   * テンプレート設定が完了しているかチェックする
   */
  hasResolvedConfiguration(): boolean {
    return this.resolvedConfig !== null;
  }

  /**
   * テンプレート設定の概要を取得する（デバッグ用）
   */
  getConfigurationSummary(): Result<{
    hasMainTemplate: boolean;
    hasItemsTemplate: boolean;
    outputFormat: string;
  }, DomainError & { message: string }> {
    if (!this.templateConfig) {
      return err(createError({
        kind: "InitializationError",
        message: "Template configuration has not been extracted",
      }));
    }

    return ok({
      hasMainTemplate: !!this.templateConfig.mainTemplate,
      hasItemsTemplate: !!this.templateConfig.itemsTemplate,
      outputFormat: this.templateConfig.outputFormat || "unknown",
    });
  }

  /**
   * PRIVATE: Schemaから特定のディレクティブの値を抽出する
   */
  private extractDirectiveValue(
    schema: Schema,
    directiveName: string,
  ): Result<string, DomainError & { message: string }> {
    try {
      // Schema の getRawSchema を使用してディレクティブを検索
      const rawSchema = schema.getRawSchema();
      const directiveValue = this.findDirectiveInSchema(
        rawSchema,
        directiveName,
      );

      if (directiveValue && typeof directiveValue === "string") {
        return ok(directiveValue);
      } else {
        return err(createError({
          kind: "ConfigurationError",
          message: `Directive ${directiveName} not found or invalid in schema`,
        }));
      }
    } catch (error) {
      return err(createError({
        kind: "ConfigurationError",
        message: `Failed to extract ${directiveName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }));
    }
  }

  /**
   * PRIVATE: Schema内を再帰的に検索してディレクティブを見つける
   */
  private findDirectiveInSchema(obj: unknown, directiveName: string): unknown {
    if (typeof obj !== "object" || obj === null) {
      return undefined;
    }

    const record = obj as Record<string, unknown>;

    // 直接的にディレクティブが存在するかチェック
    if (directiveName in record) {
      return record[directiveName];
    }

    // 再帰的に子オブジェクトを検索
    for (const value of Object.values(record)) {
      const found = this.findDirectiveInSchema(value, directiveName);
      if (found !== undefined) {
        return found;
      }
    }

    return undefined;
  }

  /**
   * PRIVATE: テンプレートファイルパスから出力形式を推測する
   */
  private inferFormatFromTemplatePath(templatePath: string): string {
    const extension = templatePath.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "json":
        return "json";
      case "yml":
      case "yaml":
        return "yaml";
      case "xml":
        return "xml";
      case "md":
        return "markdown";
      default:
        return "json"; // Default fallback
    }
  }
}
