# ドメインコア型定義 - 全域性原則適用設計

## 1. コアドメイン型定義（Schema非依存層）

### 1.1 基本Result型

```typescript
// 全域性原則：Result型によるエラー値化
export type Result<T, E = Error> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: E };

// 共通エラー型定義
export type DomainError =
  | { readonly kind: "SchemaNotLoaded" }
  | { readonly kind: "InvalidSchemaFormat"; readonly details: string }
  | {
    readonly kind: "ValidationFailed";
    readonly violations: readonly string[];
  }
  | { readonly kind: "MappingFailed"; readonly reason: string }
  | { readonly kind: "FileNotFound"; readonly path: string }
  | { readonly kind: "ParseError"; readonly input: string }
  | { readonly kind: "InvalidConfiguration"; readonly field: string }
  | { readonly kind: "ProcessingFailed"; readonly step: string };

// エラー作成ヘルパー
export const createDomainError = <K extends DomainError["kind"]>(
  kind: K,
  details: Omit<Extract<DomainError, { kind: K }>, "kind">,
): DomainError => ({ kind, ...details } as DomainError);
```

### 1.2 フロントマター抽出ドメイン（Schema非依存）

```typescript
// 全域性原則：Smart Constructorパターン
export class MarkdownContent {
  private constructor(private readonly content: string) {}

  static create(content: string): Result<MarkdownContent, DomainError> {
    if (content.length === 0) {
      return {
        ok: false,
        error: createDomainError("ParseError", { input: "empty content" }),
      };
    }
    return { ok: true, data: new MarkdownContent(content) };
  }

  getValue(): string {
    return this.content;
  }
}

// フロントマター抽出結果（Schema非依存）
export type ExtractedData = {
  readonly kind: "WithFrontMatter";
  readonly frontMatter: Record<string, unknown>;
  readonly body: string;
} | {
  readonly kind: "NoFrontMatter";
  readonly body: string;
};

// 抽出サービスインターフェース
export interface FrontMatterExtractor {
  extract(content: MarkdownContent): Result<ExtractedData, DomainError>;
}
```

### 1.3 ファイル発見ドメイン（Schema非依存）

```typescript
// ファイルパスの値オブジェクト
export class FilePath {
  private constructor(private readonly path: string) {}

  static create(path: string): Result<FilePath, DomainError> {
    if (!path || path.trim().length === 0) {
      return {
        ok: false,
        error: createDomainError("FileNotFound", { path }),
      };
    }
    return { ok: true, data: new FilePath(path) };
  }

  getValue(): string {
    return this.path;
  }

  getDirectory(): string {
    const lastSlash = this.path.lastIndexOf("/");
    return lastSlash > 0 ? this.path.substring(0, lastSlash) : "/";
  }

  getFilename(): string {
    const lastSlash = this.path.lastIndexOf("/");
    return lastSlash >= 0 ? this.path.substring(lastSlash + 1) : this.path;
  }
}

// ファイルパターン
export class FilePattern {
  private constructor(private readonly pattern: string) {}

  static create(pattern: string): Result<FilePattern, DomainError> {
    if (!pattern) {
      return {
        ok: false,
        error: createDomainError("InvalidConfiguration", { field: "pattern" }),
      };
    }
    return { ok: true, data: new FilePattern(pattern) };
  }

  getValue(): string {
    return this.pattern;
  }
}
```

## 2. Schema注入境界型定義

### 2.1 Schema注入コンテキスト

```typescript
// 全域性原則：Discriminated Union による状態管理
export type SchemaContext =
  | { readonly kind: "NotLoaded" }
  | { readonly kind: "Loading"; readonly path: string }
  | {
    readonly kind: "Loaded";
    readonly schema: unknown;
    readonly loadedAt: Date;
  }
  | { readonly kind: "Failed"; readonly error: DomainError };

// Template注入コンテキスト
export type TemplateContext =
  | { readonly kind: "NotLoaded" }
  | { readonly kind: "Loading"; readonly path: string }
  | {
    readonly kind: "Loaded";
    readonly template: unknown;
    readonly loadedAt: Date;
  }
  | { readonly kind: "Failed"; readonly error: DomainError };

// Prompt注入コンテキスト
export type PromptContext =
  | { readonly kind: "NotLoaded" }
  | {
    readonly kind: "Loaded";
    readonly extraction: string;
    readonly mapping: string;
  }
  | { readonly kind: "Failed"; readonly error: DomainError };
```

### 2.2 実行時設定

```typescript
// 実行時設定の値オブジェクト
export class ExecutionConfig {
  private constructor(
    private readonly schemaPath: FilePath,
    private readonly templatePath: FilePath,
    private readonly inputPath: FilePath,
    private readonly outputPath: FilePath,
    private readonly outputFormat: OutputFormat,
  ) {}

  static create(config: {
    schemaPath: string;
    templatePath: string;
    inputPath: string;
    outputPath: string;
    outputFormat: string;
  }): Result<ExecutionConfig, DomainError> {
    const schemaPathResult = FilePath.create(config.schemaPath);
    if (!schemaPathResult.ok) return schemaPathResult;

    const templatePathResult = FilePath.create(config.templatePath);
    if (!templatePathResult.ok) return templatePathResult;

    const inputPathResult = FilePath.create(config.inputPath);
    if (!inputPathResult.ok) return inputPathResult;

    const outputPathResult = FilePath.create(config.outputPath);
    if (!outputPathResult.ok) return outputPathResult;

    const formatResult = OutputFormat.create(config.outputFormat);
    if (!formatResult.ok) return formatResult;

    return {
      ok: true,
      data: new ExecutionConfig(
        schemaPathResult.data,
        templatePathResult.data,
        inputPathResult.data,
        outputPathResult.data,
        formatResult.data,
      ),
    };
  }

  getSchemaPath(): FilePath {
    return this.schemaPath;
  }
  getTemplatePath(): FilePath {
    return this.templatePath;
  }
  getInputPath(): FilePath {
    return this.inputPath;
  }
  getOutputPath(): FilePath {
    return this.outputPath;
  }
  getOutputFormat(): OutputFormat {
    return this.outputFormat;
  }
}

// 出力フォーマット
export class OutputFormat {
  private static readonly VALID_FORMATS = ["json", "yaml", "xml"] as const;
  private constructor(
    private readonly format: typeof OutputFormat.VALID_FORMATS[number],
  ) {}

  static create(format: string): Result<OutputFormat, DomainError> {
    if (OutputFormat.VALID_FORMATS.includes(format as any)) {
      return { ok: true, data: new OutputFormat(format as any) };
    }
    return {
      ok: false,
      error: createDomainError("InvalidConfiguration", {
        field: "outputFormat",
      }),
    };
  }

  getValue(): string {
    return this.format;
  }
}
```

## 3. 処理パイプライン型定義

### 3.1 パイプライン状態

```typescript
// 全域性原則：タグ付きユニオンで状態遷移を表現
export type PipelineState =
  | { readonly kind: "Idle" }
  | { readonly kind: "Initializing"; readonly config: ExecutionConfig }
  | { readonly kind: "LoadingSchema"; readonly progress: number }
  | { readonly kind: "LoadingTemplate"; readonly progress: number }
  | {
    readonly kind: "ProcessingDocuments";
    readonly current: number;
    readonly total: number;
  }
  | { readonly kind: "ApplyingSchema"; readonly documentId: string }
  | { readonly kind: "MappingToTemplate"; readonly documentId: string }
  | { readonly kind: "GeneratingOutput" }
  | { readonly kind: "Completed"; readonly outputPath: FilePath }
  | {
    readonly kind: "Failed";
    readonly error: DomainError;
    readonly failedAt: Date;
  };

// パイプライン遷移ルール
export type StateTransition =
  | { from: "Idle"; to: "Initializing" }
  | { from: "Initializing"; to: "LoadingSchema" | "Failed" }
  | { from: "LoadingSchema"; to: "LoadingTemplate" | "Failed" }
  | { from: "LoadingTemplate"; to: "ProcessingDocuments" | "Failed" }
  | {
    from: "ProcessingDocuments";
    to: "ApplyingSchema" | "GeneratingOutput" | "Failed";
  }
  | { from: "ApplyingSchema"; to: "MappingToTemplate" | "Failed" }
  | {
    from: "MappingToTemplate";
    to: "ProcessingDocuments" | "GeneratingOutput" | "Failed";
  }
  | { from: "GeneratingOutput"; to: "Completed" | "Failed" };
```

### 3.2 処理結果

```typescript
// ドキュメント処理結果
export type DocumentProcessingResult =
  | { readonly kind: "Success"; readonly data: ProcessedDocument }
  | { readonly kind: "Skipped"; readonly reason: string }
  | { readonly kind: "Failed"; readonly error: DomainError };

// 処理済みドキュメント
export class ProcessedDocument {
  private constructor(
    private readonly id: string,
    private readonly originalPath: FilePath,
    private readonly extractedData: ExtractedData,
    private readonly validatedData: unknown,
    private readonly mappedData: unknown,
  ) {}

  static create(
    id: string,
    path: FilePath,
    extracted: ExtractedData,
    validated: unknown,
    mapped: unknown,
  ): Result<ProcessedDocument, DomainError> {
    if (!id) {
      return {
        ok: false,
        error: createDomainError("InvalidConfiguration", {
          field: "documentId",
        }),
      };
    }
    return {
      ok: true,
      data: new ProcessedDocument(id, path, extracted, validated, mapped),
    };
  }

  getId(): string {
    return this.id;
  }
  getOriginalPath(): FilePath {
    return this.originalPath;
  }
  getExtractedData(): ExtractedData {
    return this.extractedData;
  }
  getValidatedData(): unknown {
    return this.validatedData;
  }
  getMappedData(): unknown {
    return this.mappedData;
  }
}
```

## 4. Schema可変性管理型定義

### 4.1 Schema管理

```typescript
// アクティブSchemaセット
export type ActiveSchemaSet = {
  readonly kind: "Ready";
  readonly schema: unknown;
  readonly template: unknown;
  readonly prompts: {
    readonly extraction: string;
    readonly mapping: string;
  };
  readonly activatedAt: Date;
} | {
  readonly kind: "NotReady";
};

// Schema切り替えマネージャー
export interface SchemaSwitchManager {
  loadSchemaSet(
    config: ExecutionConfig,
  ): Promise<Result<ActiveSchemaSet, DomainError>>;
  getCurrentSet(): ActiveSchemaSet;
  unloadCurrentSet(): void;
}
```

### 4.2 動的パイプラインファクトリ

```typescript
// パイプライン生成器
export interface DynamicPipelineFactory {
  createPipeline(
    config: ExecutionConfig,
    schemaSet: ActiveSchemaSet,
  ): Result<ExecutablePipeline, DomainError>;
}

// 実行可能パイプライン
export interface ExecutablePipeline {
  readonly id: string;
  readonly config: ExecutionConfig;
  readonly state: PipelineState;

  execute(): Promise<Result<PipelineExecutionResult, DomainError>>;
  getProgress(): PipelineProgress;
  cancel(): void;
  dispose(): void;
}

// パイプライン実行結果
export class PipelineExecutionResult {
  private constructor(
    private readonly outputPath: FilePath,
    private readonly processedCount: number,
    private readonly skippedCount: number,
    private readonly failedCount: number,
    private readonly executionTime: number,
  ) {}

  static create(
    outputPath: FilePath,
    processed: number,
    skipped: number,
    failed: number,
    time: number,
  ): Result<PipelineExecutionResult, DomainError> {
    if (processed < 0 || skipped < 0 || failed < 0 || time < 0) {
      return {
        ok: false,
        error: createDomainError("InvalidConfiguration", {
          field: "statistics",
        }),
      };
    }
    return {
      ok: true,
      data: new PipelineExecutionResult(
        outputPath,
        processed,
        skipped,
        failed,
        time,
      ),
    };
  }

  getOutputPath(): FilePath {
    return this.outputPath;
  }
  getProcessedCount(): number {
    return this.processedCount;
  }
  getSkippedCount(): number {
    return this.skippedCount;
  }
  getFailedCount(): number {
    return this.failedCount;
  }
  getExecutionTime(): number {
    return this.executionTime;
  }
}

// パイプライン進行状況
export type PipelineProgress = {
  readonly state: PipelineState;
  readonly percentage: number;
  readonly message: string;
  readonly startedAt: Date;
  readonly estimatedCompletion?: Date;
};
```

## 5. 品質保証型定義

### 5.1 バリデーション結果

```typescript
// バリデーション結果
export type ValidationResult =
  | { readonly kind: "Valid"; readonly data: unknown }
  | {
    readonly kind: "Invalid";
    readonly violations: readonly ValidationViolation[];
  };

// バリデーション違反
export class ValidationViolation {
  private constructor(
    private readonly path: string,
    private readonly message: string,
    private readonly severity: ValidationSeverity,
  ) {}

  static create(
    path: string,
    message: string,
    severity: string,
  ): Result<ValidationViolation, DomainError> {
    const severityResult = ValidationSeverity.create(severity);
    if (!severityResult.ok) return severityResult;

    return {
      ok: true,
      data: new ValidationViolation(path, message, severityResult.data),
    };
  }

  getPath(): string {
    return this.path;
  }
  getMessage(): string {
    return this.message;
  }
  getSeverity(): ValidationSeverity {
    return this.severity;
  }
}

// バリデーション重要度
export class ValidationSeverity {
  private static readonly VALID_SEVERITIES = [
    "error",
    "warning",
    "info",
  ] as const;
  private constructor(
    private readonly severity:
      typeof ValidationSeverity.VALID_SEVERITIES[number],
  ) {}

  static create(severity: string): Result<ValidationSeverity, DomainError> {
    if (ValidationSeverity.VALID_SEVERITIES.includes(severity as any)) {
      return { ok: true, data: new ValidationSeverity(severity as any) };
    }
    return {
      ok: false,
      error: createDomainError("InvalidConfiguration", { field: "severity" }),
    };
  }

  getValue(): string {
    return this.severity;
  }

  isError(): boolean {
    return this.severity === "error";
  }
}
```

## 6. 型安全性検証関数

```typescript
// 網羅性チェック用のヘルパー関数
export const assertNever = (x: never): never => {
  throw new Error(`Unexpected value: ${x}`);
};

// 状態遷移の妥当性検証
export const validateStateTransition = (
  from: PipelineState,
  to: PipelineState,
): Result<void, DomainError> => {
  switch (from.kind) {
    case "Idle":
      if (to.kind === "Initializing") return { ok: true, data: undefined };
      break;
    case "Initializing":
      if (to.kind === "LoadingSchema" || to.kind === "Failed") {
        return { ok: true, data: undefined };
      }
      break;
    case "LoadingSchema":
      if (to.kind === "LoadingTemplate" || to.kind === "Failed") {
        return { ok: true, data: undefined };
      }
      break;
    case "LoadingTemplate":
      if (to.kind === "ProcessingDocuments" || to.kind === "Failed") {
        return { ok: true, data: undefined };
      }
      break;
    case "ProcessingDocuments":
      if (
        to.kind === "ApplyingSchema" || to.kind === "GeneratingOutput" ||
        to.kind === "Failed"
      ) {
        return { ok: true, data: undefined };
      }
      break;
    case "ApplyingSchema":
      if (to.kind === "MappingToTemplate" || to.kind === "Failed") {
        return { ok: true, data: undefined };
      }
      break;
    case "MappingToTemplate":
      if (
        to.kind === "ProcessingDocuments" || to.kind === "GeneratingOutput" ||
        to.kind === "Failed"
      ) {
        return { ok: true, data: undefined };
      }
      break;
    case "GeneratingOutput":
      if (to.kind === "Completed" || to.kind === "Failed") {
        return { ok: true, data: undefined };
      }
      break;
    case "Completed":
    case "Failed":
      // 終了状態からの遷移は不可
      break;
  }

  return {
    ok: false,
    error: createDomainError("ProcessingFailed", {
      step: `Invalid transition from ${from.kind} to ${to.kind}`,
    }),
  };
};
```

## まとめ

この型定義は以下の全域性原則を実装しています：

1. **Result型による全域関数化**: すべての関数が必ず値を返す
2. **Smart Constructor**: 不正な値の生成を型システムで防止
3. **Discriminated Union**: 状態の網羅的表現
4. **Schema可変性**: 実行時のSchema注入を型安全に実現
5. **状態遷移の型安全性**: 不正な状態遷移をコンパイル時に検出

これにより、Schema可変性を保ちながら型安全性を確保した設計を実現しています。
