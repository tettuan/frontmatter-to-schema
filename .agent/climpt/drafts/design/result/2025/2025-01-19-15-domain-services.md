# ドメインサービス設計 - Schema可変性対応

## 1. Schema非依存コアサービス

### 1.1 フロントマター抽出サービス

```typescript
import { createDomainError, DomainError, Result } from "./domain-core-types";
import { ExtractedData, MarkdownContent } from "./domain-core-types";

// フロントマター抽出サービス実装（Schema非依存）
export class FrontMatterExtractorService implements FrontMatterExtractor {
  private readonly frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

  extract(content: MarkdownContent): Result<ExtractedData, DomainError> {
    const text = content.getValue();
    const match = text.match(this.frontMatterRegex);

    if (!match) {
      // フロントマターが存在しない場合
      return {
        ok: true,
        data: {
          kind: "NoFrontMatter",
          body: text,
        },
      };
    }

    const [, frontMatterText, body] = match;

    try {
      // YAMLパース（外部ライブラリへの依存は抽象化）
      const frontMatter = this.parseFrontMatter(frontMatterText);
      return {
        ok: true,
        data: {
          kind: "WithFrontMatter",
          frontMatter,
          body,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("ParseError", {
          input: `Invalid YAML in frontmatter: ${error}`,
        }),
      };
    }
  }

  private parseFrontMatter(text: string): Record<string, unknown> {
    // YAMLパース処理（実装は省略）
    // 実際の実装では yaml.parse() などを使用
    return JSON.parse(text); // 仮実装
  }
}
```

### 1.2 ファイル発見サービス

```typescript
import { FilePath, FilePattern } from "./domain-core-types";

// ファイル発見サービスインターフェース（Schema非依存）
export interface FileDiscoveryService {
  discover(
    patterns: readonly FilePattern[],
  ): Promise<Result<readonly FilePath[], DomainError>>;
  exists(path: FilePath): Promise<Result<boolean, DomainError>>;
  readContent(path: FilePath): Promise<Result<MarkdownContent, DomainError>>;
}

// 実装例（インフラ層で実装）
export class FileDiscoveryServiceImpl implements FileDiscoveryService {
  async discover(
    patterns: readonly FilePattern[],
  ): Promise<Result<readonly FilePath[], DomainError>> {
    const files: FilePath[] = [];

    for (const pattern of patterns) {
      const matchedPaths = await this.glob(pattern.getValue());

      for (const path of matchedPaths) {
        const filePathResult = FilePath.create(path);
        if (filePathResult.ok) {
          files.push(filePathResult.data);
        }
      }
    }

    return { ok: true, data: files };
  }

  async exists(path: FilePath): Promise<Result<boolean, DomainError>> {
    try {
      const exists = await this.checkFileExists(path.getValue());
      return { ok: true, data: exists };
    } catch {
      return { ok: true, data: false };
    }
  }

  async readContent(
    path: FilePath,
  ): Promise<Result<MarkdownContent, DomainError>> {
    try {
      const content = await this.readFile(path.getValue());
      return MarkdownContent.create(content);
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("FileNotFound", { path: path.getValue() }),
      };
    }
  }

  // 抽象メソッド（インフラ層で実装）
  private async glob(pattern: string): Promise<string[]> {
    // 実装は省略
    return [];
  }

  private async checkFileExists(path: string): Promise<boolean> {
    // 実装は省略
    return false;
  }

  private async readFile(path: string): Promise<string> {
    // 実装は省略
    return "";
  }
}
```

## 2. Schema注入層サービス

### 2.1 Schema注入管理サービス

```typescript
import {
  ActiveSchemaSet,
  ExecutionConfig,
  PromptContext,
  SchemaContext,
  TemplateContext,
} from "./domain-core-types";

// Schema注入管理サービス
export class SchemaInjectionManager implements SchemaSwitchManager {
  private schemaContext: SchemaContext = { kind: "NotLoaded" };
  private templateContext: TemplateContext = { kind: "NotLoaded" };
  private promptContext: PromptContext = { kind: "NotLoaded" };

  async loadSchemaSet(
    config: ExecutionConfig,
  ): Promise<Result<ActiveSchemaSet, DomainError>> {
    // Schema読み込み
    this.schemaContext = {
      kind: "Loading",
      path: config.getSchemaPath().getValue(),
    };
    const schemaResult = await this.loadSchema(config.getSchemaPath());
    if (!schemaResult.ok) {
      this.schemaContext = { kind: "Failed", error: schemaResult.error };
      return schemaResult;
    }
    this.schemaContext = {
      kind: "Loaded",
      schema: schemaResult.data,
      loadedAt: new Date(),
    };

    // Template読み込み
    this.templateContext = {
      kind: "Loading",
      path: config.getTemplatePath().getValue(),
    };
    const templateResult = await this.loadTemplate(config.getTemplatePath());
    if (!templateResult.ok) {
      this.templateContext = { kind: "Failed", error: templateResult.error };
      return templateResult;
    }
    this.templateContext = {
      kind: "Loaded",
      template: templateResult.data,
      loadedAt: new Date(),
    };

    // Prompts読み込み
    const promptsResult = await this.loadPrompts(config);
    if (!promptsResult.ok) {
      this.promptContext = { kind: "Failed", error: promptsResult.error };
      return promptsResult;
    }
    this.promptContext = {
      kind: "Loaded",
      extraction: promptsResult.data.extraction,
      mapping: promptsResult.data.mapping,
    };

    // アクティブセット作成
    if (
      this.schemaContext.kind === "Loaded" &&
      this.templateContext.kind === "Loaded" &&
      this.promptContext.kind === "Loaded"
    ) {
      return {
        ok: true,
        data: {
          kind: "Ready",
          schema: this.schemaContext.schema,
          template: this.templateContext.template,
          prompts: {
            extraction: this.promptContext.extraction,
            mapping: this.promptContext.mapping,
          },
          activatedAt: new Date(),
        },
      };
    }

    return {
      ok: false,
      error: createDomainError("SchemaNotLoaded", {}),
    };
  }

  getCurrentSet(): ActiveSchemaSet {
    if (
      this.schemaContext.kind === "Loaded" &&
      this.templateContext.kind === "Loaded" &&
      this.promptContext.kind === "Loaded"
    ) {
      return {
        kind: "Ready",
        schema: this.schemaContext.schema,
        template: this.templateContext.template,
        prompts: {
          extraction: this.promptContext.extraction,
          mapping: this.promptContext.mapping,
        },
        activatedAt: this.schemaContext.loadedAt,
      };
    }
    return { kind: "NotReady" };
  }

  unloadCurrentSet(): void {
    this.schemaContext = { kind: "NotLoaded" };
    this.templateContext = { kind: "NotLoaded" };
    this.promptContext = { kind: "NotLoaded" };
  }

  private async loadSchema(
    path: FilePath,
  ): Promise<Result<unknown, DomainError>> {
    // 実装は省略（ファイル読み込みとJSONパース）
    return { ok: true, data: {} };
  }

  private async loadTemplate(
    path: FilePath,
  ): Promise<Result<unknown, DomainError>> {
    // 実装は省略（ファイル読み込みとパース）
    return { ok: true, data: {} };
  }

  private async loadPrompts(
    config: ExecutionConfig,
  ): Promise<Result<{ extraction: string; mapping: string }, DomainError>> {
    // 実装は省略（プロンプトファイル読み込み）
    return {
      ok: true,
      data: {
        extraction: "extraction prompt",
        mapping: "mapping prompt",
      },
    };
  }
}
```

### 2.2 Schema適用サービス

```typescript
import {
  ExtractedData,
  ValidationResult,
  ValidationViolation,
} from "./domain-core-types";

// Schema適用サービスインターフェース
export interface SchemaApplicationService {
  apply(
    data: ExtractedData,
    schema: unknown,
  ): Promise<Result<ValidationResult, DomainError>>;
}

// Schema適用サービス実装
export class SchemaApplicationServiceImpl implements SchemaApplicationService {
  async apply(
    data: ExtractedData,
    schema: unknown,
  ): Promise<Result<ValidationResult, DomainError>> {
    // フロントマターがない場合はスキップ
    if (data.kind === "NoFrontMatter") {
      return {
        ok: true,
        data: {
          kind: "Invalid",
          violations: [
            await this.createViolation(
              "frontmatter",
              "No frontmatter found",
              "error",
            ),
          ],
        },
      };
    }

    // Schema検証ロジック（実装は省略）
    const violations = await this.validateAgainstSchema(
      data.frontMatter,
      schema,
    );

    if (violations.length === 0) {
      return {
        ok: true,
        data: {
          kind: "Valid",
          data: data.frontMatter,
        },
      };
    }

    return {
      ok: true,
      data: {
        kind: "Invalid",
        violations,
      },
    };
  }

  private async validateAgainstSchema(
    data: Record<string, unknown>,
    schema: unknown,
  ): Promise<readonly ValidationViolation[]> {
    // 実装は省略
    return [];
  }

  private async createViolation(
    path: string,
    message: string,
    severity: string,
  ): Promise<ValidationViolation> {
    const result = ValidationViolation.create(path, message, severity);
    if (!result.ok) {
      throw new Error("Failed to create violation");
    }
    return result.data;
  }
}
```

### 2.3 Template適用サービス

```typescript
// Template適用サービスインターフェース
export interface TemplateApplicationService {
  apply(
    data: unknown,
    template: unknown,
  ): Promise<Result<unknown, DomainError>>;
}

// Template適用サービス実装
export class TemplateApplicationServiceImpl
  implements TemplateApplicationService {
  async apply(
    data: unknown,
    template: unknown,
  ): Promise<Result<unknown, DomainError>> {
    try {
      // テンプレート適用ロジック（実装は省略）
      const mapped = await this.mapToTemplate(data, template);
      return { ok: true, data: mapped };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("MappingFailed", {
          reason: `Template mapping failed: ${error}`,
        }),
      };
    }
  }

  private async mapToTemplate(
    data: unknown,
    template: unknown,
  ): Promise<unknown> {
    // 実装は省略
    return {};
  }
}
```

## 3. 処理パイプラインサービス

### 3.1 パイプライン実行サービス

```typescript
import {
  ActiveSchemaSet,
  DocumentProcessingResult,
  ExecutionConfig,
  PipelineExecutionResult,
  PipelineState,
  ProcessedDocument,
} from "./domain-core-types";

// パイプライン実行サービス
export class PipelineExecutionService implements ExecutablePipeline {
  readonly id: string;
  readonly config: ExecutionConfig;
  private _state: PipelineState = { kind: "Idle" };
  private cancelled = false;

  constructor(
    config: ExecutionConfig,
    private readonly schemaSet: ActiveSchemaSet,
    private readonly extractor: FrontMatterExtractor,
    private readonly fileDiscovery: FileDiscoveryService,
    private readonly schemaService: SchemaApplicationService,
    private readonly templateService: TemplateApplicationService,
  ) {
    this.id = this.generateId();
    this.config = config;
  }

  get state(): PipelineState {
    return this._state;
  }

  async execute(): Promise<Result<PipelineExecutionResult, DomainError>> {
    const startTime = Date.now();

    // 状態遷移: Idle -> Initializing
    if (!this.transitionTo({ kind: "Initializing", config: this.config })) {
      return this.createFailureResult("Invalid state transition");
    }

    // 状態遷移: Initializing -> LoadingSchema
    if (!this.transitionTo({ kind: "LoadingSchema", progress: 0 })) {
      return this.createFailureResult("Failed to start schema loading");
    }

    // Schema検証
    if (this.schemaSet.kind !== "Ready") {
      return this.createFailureResult("Schema not ready");
    }

    // 状態遷移: LoadingSchema -> LoadingTemplate
    if (!this.transitionTo({ kind: "LoadingTemplate", progress: 0 })) {
      return this.createFailureResult("Failed to start template loading");
    }

    // ファイル発見
    const patterns = await this.getInputPatterns();
    const filesResult = await this.fileDiscovery.discover(patterns);
    if (!filesResult.ok) {
      return { ok: false, error: filesResult.error };
    }

    // 状態遷移: LoadingTemplate -> ProcessingDocuments
    const totalFiles = filesResult.data.length;
    if (
      !this.transitionTo({
        kind: "ProcessingDocuments",
        current: 0,
        total: totalFiles,
      })
    ) {
      return this.createFailureResult("Failed to start document processing");
    }

    // ドキュメント処理
    const results: DocumentProcessingResult[] = [];
    for (let i = 0; i < filesResult.data.length; i++) {
      if (this.cancelled) {
        return this.createFailureResult("Pipeline cancelled");
      }

      const file = filesResult.data[i];
      const result = await this.processDocument(file);
      results.push(result);

      // 進捗更新
      this.transitionTo({
        kind: "ProcessingDocuments",
        current: i + 1,
        total: totalFiles,
      });
    }

    // 状態遷移: ProcessingDocuments -> GeneratingOutput
    if (!this.transitionTo({ kind: "GeneratingOutput" })) {
      return this.createFailureResult("Failed to start output generation");
    }

    // 出力生成
    const outputResult = await this.generateOutput(results);
    if (!outputResult.ok) {
      return outputResult;
    }

    // 状態遷移: GeneratingOutput -> Completed
    if (
      !this.transitionTo({
        kind: "Completed",
        outputPath: this.config.getOutputPath(),
      })
    ) {
      return this.createFailureResult("Failed to complete pipeline");
    }

    // 統計計算
    const processed = results.filter((r) => r.kind === "Success").length;
    const skipped = results.filter((r) => r.kind === "Skipped").length;
    const failed = results.filter((r) => r.kind === "Failed").length;
    const executionTime = Date.now() - startTime;

    return PipelineExecutionResult.create(
      this.config.getOutputPath(),
      processed,
      skipped,
      failed,
      executionTime,
    );
  }

  getProgress(): PipelineProgress {
    const percentage = this.calculateProgress();
    const message = this.getProgressMessage();

    return {
      state: this._state,
      percentage,
      message,
      startedAt: new Date(),
      estimatedCompletion: this.estimateCompletion(),
    };
  }

  cancel(): void {
    this.cancelled = true;
    this.transitionTo({
      kind: "Failed",
      error: createDomainError("ProcessingFailed", {
        step: "Cancelled by user",
      }),
      failedAt: new Date(),
    });
  }

  dispose(): void {
    // リソースのクリーンアップ
    this.cancelled = true;
    this._state = { kind: "Idle" };
  }

  private async processDocument(
    file: FilePath,
  ): Promise<DocumentProcessingResult> {
    // ドキュメント読み込み
    const contentResult = await this.fileDiscovery.readContent(file);
    if (!contentResult.ok) {
      return { kind: "Failed", error: contentResult.error };
    }

    // フロントマター抽出
    const extractedResult = this.extractor.extract(contentResult.data);
    if (!extractedResult.ok) {
      return { kind: "Failed", error: extractedResult.error };
    }

    // Schema適用
    const validationResult = await this.schemaService.apply(
      extractedResult.data,
      this.schemaSet.kind === "Ready" ? this.schemaSet.schema : {},
    );
    if (!validationResult.ok) {
      return { kind: "Failed", error: validationResult.error };
    }

    if (validationResult.data.kind === "Invalid") {
      return { kind: "Skipped", reason: "Validation failed" };
    }

    // Template適用
    const mappingResult = await this.templateService.apply(
      validationResult.data.data,
      this.schemaSet.kind === "Ready" ? this.schemaSet.template : {},
    );
    if (!mappingResult.ok) {
      return { kind: "Failed", error: mappingResult.error };
    }

    // 処理済みドキュメント作成
    const docResult = ProcessedDocument.create(
      this.generateDocumentId(),
      file,
      extractedResult.data,
      validationResult.data.data,
      mappingResult.data,
    );

    if (!docResult.ok) {
      return { kind: "Failed", error: docResult.error };
    }

    return { kind: "Success", data: docResult.data };
  }

  private transitionTo(newState: PipelineState): boolean {
    const validationResult = validateStateTransition(this._state, newState);
    if (validationResult.ok) {
      this._state = newState;
      return true;
    }
    return false;
  }

  private createFailureResult(
    reason: string,
  ): Result<PipelineExecutionResult, DomainError> {
    this.transitionTo({
      kind: "Failed",
      error: createDomainError("ProcessingFailed", { step: reason }),
      failedAt: new Date(),
    });
    return {
      ok: false,
      error: createDomainError("ProcessingFailed", { step: reason }),
    };
  }

  private async getInputPatterns(): Promise<readonly FilePattern[]> {
    // 実装は省略
    return [];
  }

  private async generateOutput(
    results: DocumentProcessingResult[],
  ): Promise<Result<void, DomainError>> {
    // 実装は省略
    return { ok: true, data: undefined };
  }

  private calculateProgress(): number {
    switch (this._state.kind) {
      case "Idle":
        return 0;
      case "Initializing":
        return 5;
      case "LoadingSchema":
        return 10 + this._state.progress * 0.1;
      case "LoadingTemplate":
        return 20 + this._state.progress * 0.1;
      case "ProcessingDocuments":
        return 30 + (this._state.current / this._state.total) * 60;
      case "ApplyingSchema":
        return 70;
      case "MappingToTemplate":
        return 80;
      case "GeneratingOutput":
        return 90;
      case "Completed":
        return 100;
      case "Failed":
        return -1;
    }
  }

  private getProgressMessage(): string {
    switch (this._state.kind) {
      case "Idle":
        return "Waiting to start";
      case "Initializing":
        return "Initializing pipeline";
      case "LoadingSchema":
        return "Loading schema";
      case "LoadingTemplate":
        return "Loading template";
      case "ProcessingDocuments":
        return `Processing documents (${this._state.current}/${this._state.total})`;
      case "ApplyingSchema":
        return "Applying schema";
      case "MappingToTemplate":
        return "Mapping to template";
      case "GeneratingOutput":
        return "Generating output";
      case "Completed":
        return "Pipeline completed";
      case "Failed":
        return `Failed: ${this._state.error.kind}`;
    }
  }

  private estimateCompletion(): Date | undefined {
    // 実装は省略
    return undefined;
  }

  private generateId(): string {
    return `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDocumentId(): string {
    return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 3.2 パイプラインファクトリサービス

```typescript
// パイプラインファクトリ実装
export class DynamicPipelineFactoryImpl implements DynamicPipelineFactory {
  constructor(
    private readonly extractor: FrontMatterExtractor,
    private readonly fileDiscovery: FileDiscoveryService,
    private readonly schemaService: SchemaApplicationService,
    private readonly templateService: TemplateApplicationService,
  ) {}

  createPipeline(
    config: ExecutionConfig,
    schemaSet: ActiveSchemaSet,
  ): Result<ExecutablePipeline, DomainError> {
    if (schemaSet.kind !== "Ready") {
      return {
        ok: false,
        error: createDomainError("SchemaNotLoaded", {}),
      };
    }

    const pipeline = new PipelineExecutionService(
      config,
      schemaSet,
      this.extractor,
      this.fileDiscovery,
      this.schemaService,
      this.templateService,
    );

    return { ok: true, data: pipeline };
  }
}
```

## 4. AI分析サービス（Schema依存）

### 4.1 Claude分析サービス

```typescript
// AI分析サービスインターフェース
export interface AIAnalysisService {
  analyzeWithSchema(
    content: string,
    schema: unknown,
    prompt: string,
  ): Promise<Result<unknown, DomainError>>;

  mapWithTemplate(
    data: unknown,
    template: unknown,
    prompt: string,
  ): Promise<Result<unknown, DomainError>>;
}

// Claude実装（詳細は省略）
export class ClaudeAnalysisService implements AIAnalysisService {
  async analyzeWithSchema(
    content: string,
    schema: unknown,
    prompt: string,
  ): Promise<Result<unknown, DomainError>> {
    try {
      // Claude APIコール（実装は省略）
      const result = await this.callClaude(content, schema, prompt);
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("ProcessingFailed", {
          step: `AI analysis failed: ${error}`,
        }),
      };
    }
  }

  async mapWithTemplate(
    data: unknown,
    template: unknown,
    prompt: string,
  ): Promise<Result<unknown, DomainError>> {
    try {
      // Claude APIコール（実装は省略）
      const result = await this.callClaude(data, template, prompt);
      return { ok: true, data: result };
    } catch (error) {
      return {
        ok: false,
        error: createDomainError("MappingFailed", {
          reason: `AI mapping failed: ${error}`,
        }),
      };
    }
  }

  private async callClaude(
    input: unknown,
    context: unknown,
    prompt: string,
  ): Promise<unknown> {
    // 実装は省略
    return {};
  }
}
```

## まとめ

このサービス設計により以下を実現：

1. **Schema非依存コアサービス**:
   フロントマター抽出とファイル発見はSchemaに依存しない
2. **Schema注入管理**: 実行時にSchemaを注入し、管理する仕組み
3. **型安全な状態遷移**: パイプライン実行の状態遷移を型で保証
4. **エラーの値化**: すべてのサービスがResult型を返し、エラーを値として扱う
5. **Schema可変性**: 同じサービスが異なるSchemaで動作可能

全域性原則に従い、部分関数を排除し、型安全性を確保したサービス設計となっています。
