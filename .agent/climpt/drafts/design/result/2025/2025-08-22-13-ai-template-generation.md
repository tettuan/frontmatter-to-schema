# AI解析ドメイン - テンプレート当て込み版

## 概要

第2段階のAI処理で、外部テンプレートファイルと抽出情報を`Claude Code SDK`に渡し、AIがテンプレートへの値の埋め込みを行う設計。TypeScriptでのテンプレート解析は行わない。

## 1. 修正版AI解析オーケストレーター

### 1.1 型定義

```typescript
// ========================================
// AI Analysis with Template Application
// ========================================

/** AI解析オーケストレーター - テンプレート当て込み版 */
export class AIAnalysisOrchestrator {
  constructor(
    private readonly aiProvider: AIProvider,
    private readonly promptA: Prompt, // 情報抽出用プロンプト
    private readonly promptB: Prompt, // テンプレート当て込み用プロンプト
  ) {}

  /**
   * 第1段階: 情報抽出（成果B → 成果C）
   * フロントマターから必要な情報を抽出
   */
  async extractInformation(
    frontMatter: FrontMatter,
    schema: AnalysisSchema,
  ): Promise<Result<ExtractedInfo, AnalysisError>> {
    // プロンプトAをレンダリング
    const renderResult = this.promptA.render({
      FRONTMATTER: JSON.stringify(frontMatter.getParsed()),
      SCHEMA: JSON.stringify(schema.getSchema()),
    });

    if (!renderResult.ok) {
      return {
        ok: false,
        error: {
          kind: "PromptRenderError",
          message: renderResult.error.variable,
        },
      };
    }

    // AI解析実行 (claude -p 1回目)
    const analysisResult = await this.aiProvider.analyze(renderResult.data);

    if (!analysisResult.ok) {
      return {
        ok: false,
        error: {
          kind: "AIAnalysisError",
          message: analysisResult.error.message,
        },
      };
    }

    // 結果をパースして成果Cを生成
    try {
      const parsed = JSON.parse(analysisResult.data);
      const metadata: ExtractionMetadata = {
        extractedAt: new Date(),
        promptUsed: "PromptA",
        schemaVersion: schema.getVersion(),
      };

      return ExtractedInfo.create(parsed, metadata);
    } catch (e) {
      return {
        ok: false,
        error: {
          kind: "ParseError",
          message: `Failed to parse AI response: ${e}`,
        },
      };
    }
  }

  /**
   * 第2段階: テンプレート当て込み（成果C → 成果D）
   * AIが抽出情報をテンプレートに埋め込む
   */
  async applyTemplate(
    extractedInfo: ExtractedInfo,
    schema: AnalysisSchema,
    template: Template,
  ): Promise<Result<TemplateResult, AnalysisError>> {
    // プロンプトBをレンダリング - テンプレート当て込み指示
    const renderResult = this.promptB.render({
      EXTRACTED_DATA: JSON.stringify(extractedInfo.getData()),
      SCHEMA: JSON.stringify(schema.getSchema()),
      TEMPLATE: template.getContent(),
    });

    if (!renderResult.ok) {
      return {
        ok: false,
        error: {
          kind: "PromptRenderError",
          message: renderResult.error.variable,
        },
      };
    }

    const startTime = Date.now();

    // AI解析実行 (claude -p 2回目) - テンプレート当て込み
    const analysisResult = await this.aiProvider.analyze(renderResult.data);

    if (!analysisResult.ok) {
      return {
        ok: false,
        error: {
          kind: "AIAnalysisError",
          message: analysisResult.error.message,
        },
      };
    }

    const duration = Date.now() - startTime;

    // AIが当て込んだテンプレート結果を作成
    const metadata: TemplateApplicationMetadata = {
      promptUsed: "PromptB",
      aiProvider: this.aiProvider.getProviderName(),
      templateName: template.getName(),
      duration,
      retryCount: 0,
    };

    const templateResult = TemplateResult.create(
      analysisResult.data,
      template,
      metadata,
    );

    if (!templateResult.ok) {
      return {
        ok: false,
        error: {
          kind: "TemplateApplicationError",
          message: templateResult.error.message,
        },
      };
    }

    // 当て込み結果の検証（必要に応じて）
    // 注: claude -pが適切に処理するため、基本的に検証は不要

    return { ok: true, data: templateResult.data };
  }

  /**
   * 完全な2段階処理パイプライン
   * 情報抽出 → テンプレート当て込み
   */
  async analyze(
    frontMatter: FrontMatter,
    schema: AnalysisSchema,
    template: Template,
  ): Promise<Result<StructuredData, AnalysisError>> {
    // 第1段階: 情報抽出
    const extractionResult = await this.extractInformation(frontMatter, schema);
    if (!extractionResult.ok) {
      return extractionResult;
    }

    // 第2段階: AIによるテンプレート当て込み
    const templateResult = await this.applyTemplate(
      extractionResult.data,
      schema,
      template,
    );

    if (!templateResult.ok) {
      return templateResult;
    }

    // TemplateResultをStructuredDataに変換
    const structuredData = StructuredData.createFromTemplateResult(
      templateResult.data,
      extractionResult.data,
    );

    return structuredData;
  }
}
```

### 1.2 テンプレート関連型定義

```typescript
/** テンプレート - 外部ファイルから読み込み */
export class Template {
  private constructor(
    private readonly name: string,
    private readonly content: string,
    private readonly format: "json" | "yaml" | "markdown",
  ) {}

  static create(
    name: string,
    content: string,
    format: "json" | "yaml" | "markdown" = "json",
  ): Result<Template, ValidationError> {
    if (!name || name.trim() === "") {
      return {
        ok: false,
        error: { kind: "EmptyInput", field: "TemplateName" },
      };
    }

    if (!content || content.trim() === "") {
      return {
        ok: false,
        error: { kind: "EmptyInput", field: "TemplateContent" },
      };
    }

    return { ok: true, data: new Template(name, content, format) };
  }

  getName(): string {
    return this.name;
  }
  getContent(): string {
    return this.content;
  }
  getFormat(): string {
    return this.format;
  }
}

/** テンプレート当て込み結果 */
export class TemplateResult {
  private constructor(
    private readonly appliedContent: string,
    private readonly template: Template,
    private readonly metadata: TemplateApplicationMetadata,
  ) {}

  static create(
    appliedContent: string,
    template: Template,
    metadata: TemplateApplicationMetadata,
  ): Result<TemplateResult, ValidationError> {
    if (!appliedContent || appliedContent.trim() === "") {
      return {
        ok: false,
        error: { kind: "EmptyInput", field: "AppliedContent" },
      };
    }

    return {
      ok: true,
      data: new TemplateResult(appliedContent, template, metadata),
    };
  }

  getAppliedContent(): string {
    return this.appliedContent;
  }
  getTemplate(): Template {
    return this.template;
  }
  getMetadata(): TemplateApplicationMetadata {
    return this.metadata;
  }
}

/** テンプレート適用メタデータ */
export interface TemplateApplicationMetadata {
  promptUsed: string;
  aiProvider: string;
  templateName: string;
  duration: number;
  retryCount: number;
}

/** 構造化データ - テンプレート当て込み結果から作成 */
export class StructuredData {
  private constructor(
    private readonly content: string,
    private readonly sourceResult: TemplateResult,
    private readonly sourceInfo: ExtractedInfo,
    private readonly metadata: StructuringMetadata,
  ) {}

  /**
   * テンプレート当て込み結果から構造化データを作成
   */
  static createFromTemplateResult(
    result: TemplateResult,
    sourceInfo: ExtractedInfo,
  ): Result<StructuredData, StructuringError> {
    const metadata: StructuringMetadata = {
      structuredAt: new Date(),
      promptUsed: "PromptB",
      templateName: result.getTemplate().getName(),
      appliedAt: result.getMetadata().duration,
      sourceMetadata: sourceInfo.getMetadata(),
    };

    return {
      ok: true,
      data: new StructuredData(
        result.getAppliedContent(),
        result,
        sourceInfo,
        metadata,
      ),
    };
  }

  getContent(): string {
    return this.content;
  }

  getSourceResult(): TemplateResult {
    return this.sourceResult;
  }

  getSourceInfo(): ExtractedInfo {
    return this.sourceInfo;
  }

  getMetadata(): StructuringMetadata {
    return this.metadata;
  }
}

/** 構造化メタデータ - テンプレート当て込み版 */
export interface StructuringMetadata {
  structuredAt: Date;
  promptUsed: string;
  templateName: string;
  appliedAt: number;
  sourceMetadata: ExtractionMetadata;
}
```

## 2. プロンプト設計

### 2.1 プロンプトA（情報抽出用）

```typescript
const PROMPT_A_TEMPLATE = `
以下のフロントマターから、Schemaに定義された情報を抽出してください。

フロントマター:
{{FRONTMATTER}}

Schema定義:
{{SCHEMA}}

抽出した情報をJSON形式で出力してください。
`;
```

### 2.2 プロンプトB（テンプレート当て込み用）

```typescript
const PROMPT_B_TEMPLATE = `
以下の抽出情報をテンプレートに当て込んでください。
テンプレート内の変数を適切な値で置き換えてください。

抽出情報:
{{EXTRACTED_DATA}}

Schema定義:
{{SCHEMA}}

テンプレート:
{{TEMPLATE}}

指示:
テンプレート内の変数プレースホルダーを、抽出情報の対応する値で置き換えてください。
Schemaの定義に従って、適切な形式で出力してください。
`;
```

## 3. 処理フロー

```mermaid
graph TD
    A[Markdownファイル] --> B[フロントマター抽出]
    B --> C[成果B: FrontMatter]
    C --> D[AI情報抽出<br/>claude -p 1回目]
    D --> E[成果C: ExtractedInfo]
    E --> F[テンプレート当て込み<br/>claude -p 2回目]
    F --> G[成果D: 変換後テンプレート]
    G --> H[StructuredData]
    H --> I[最終成果物Z]
    
    J[Schema] --> D
    J --> F
    K[PromptA] --> D
    L[PromptB] --> F
    M[Template] --> F
    
    style M fill:#f9f,stroke:#333,stroke-width:2px
```

## 4. エラーハンドリング

```typescript
export type AnalysisError =
  | { kind: "PromptRenderError"; message: string }
  | { kind: "AIAnalysisError"; message: string }
  | { kind: "ParseError"; message: string }
  | { kind: "TemplateApplicationError"; message: string };
```

## 5. 利点

1. **簡潔性**: TypeScriptでのテンプレート解析が不要
2. **柔軟性**: AIが自然言語理解で適切に値を埋め込み
3. **保守性**: テンプレート変更が容易
4. **一貫性**: Schemaによる構造の一貫性保証

## 6. 実装例

```typescript
// テンプレートファイルの読み込み
const templateContent = await readFile("templates/output.json.template");
const templateResult = Template.create("output", templateContent, "json");

if (!templateResult.ok) {
  throw new Error("Failed to load template");
}

// 使用例
const orchestrator = new AIAnalysisOrchestrator(
  new ClaudeAIProvider(commandExecutor),
  promptA,
  promptB,
);

const result = await orchestrator.analyze(
  frontMatter,
  schema,
  templateResult.data, // テンプレート
);

if (result.ok) {
  const output = result.data.getContent();
  console.log("Applied template result:", output);
}
```

## 7. テンプレート当て込みの原則

[docs/domain/domain-template.md](../../domain/domain-template.md)に基づく:

1. **TypeScriptでテンプレート解析しない**: `Claude Code SDK`に全て任せる
2. **テンプレートはそのまま渡す**: 変数埋め込みはAIが実行
3. **変換結果をそのまま利用**: 統合処理に直接使用

```mermaid
graph TD
    subgraph "Inputs to claude -p"
        A[テンプレート当て込みprompt]
        B[Schema]
        C[テンプレート]
        D[抽出情報]
    end
    
    subgraph "claude -p"
        P[AI処理]
    end
    
    subgraph "Output"
        O[変換後テンプレート]
    end
    
    A --> P
    B --> P
    C --> P
    D --> P
    P --> O
```
