# コアドメイン型定義 - Schema可変性対応設計

## 1. 基本原則（Totality適用）

全域性原則に基づき、すべての関数を全域関数として設計する。

## 2. コアドメイン型定義

### 2.1 Schema非依存コア型

```typescript
// ===============================================
// Result型（Totality基本型）
// ===============================================
export type Result<T, E> = 
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: E };

// ===============================================
// 基本エラー型（Discriminated Union）
// ===============================================
export type DomainError =
  | { readonly kind: "ValidationFailed"; readonly field: string; readonly reason: string }
  | { readonly kind: "SchemaNotFound"; readonly schemaId: string }
  | { readonly kind: "TemplateNotFound"; readonly templateId: string }
  | { readonly kind: "ProcessingFailed"; readonly step: string; readonly detail: string }
  | { readonly kind: "IOError"; readonly operation: string; readonly path: string }
  | { readonly kind: "ParseError"; readonly input: string; readonly format: string };

// ===============================================
// 処理状態型（Discriminated Union）
// ===============================================
export type ProcessingState =
  | { readonly kind: "NotStarted" }
  | { readonly kind: "Extracting"; readonly progress: number }
  | { readonly kind: "Validating"; readonly schemaId: string }
  | { readonly kind: "Mapping"; readonly templateId: string }
  | { readonly kind: "Completed"; readonly result: ProcessingResult }
  | { readonly kind: "Failed"; readonly error: DomainError };

// ===============================================
// 処理結果型
// ===============================================
export type ProcessingResult = {
  readonly documentCount: number;
  readonly successCount: number;
  readonly failedCount: number;
  readonly outputPath: string;
  readonly processingTime: number;
};
```

### 2.2 Schema注入型（実行時決定）

```typescript
// ===============================================
// Schema状態型（Discriminated Union）
// ===============================================
export type SchemaState =
  | { readonly kind: "Unloaded" }
  | { readonly kind: "Loading"; readonly path: string }
  | { readonly kind: "Loaded"; readonly context: SchemaContext }
  | { readonly kind: "Invalid"; readonly error: ValidationError };

// ===============================================
// SchemaContext（Smart Constructor適用）
// ===============================================
export class SchemaContext {
  private constructor(
    private readonly id: string,
    private readonly schema: unknown,
    private readonly loadedAt: Date
  ) {}

  static create(
    id: string,
    schema: unknown
  ): Result<SchemaContext, DomainError> {
    if (!id || id.trim() === "") {
      return {
        ok: false,
        error: { kind: "ValidationFailed", field: "id", reason: "ID cannot be empty" }
      };
    }
    
    if (!schema) {
      return {
        ok: false,
        error: { kind: "ValidationFailed", field: "schema", reason: "Schema cannot be null" }
      };
    }
    
    return {
      ok: true,
      data: new SchemaContext(id.trim(), schema, new Date())
    };
  }

  getId(): string { return this.id; }
  getSchema(): unknown { return this.schema; }
  getLoadedAt(): Date { return this.loadedAt; }
}

// ===============================================
// TemplateContext（Smart Constructor適用）
// ===============================================
export class TemplateContext {
  private constructor(
    private readonly id: string,
    private readonly template: unknown,
    private readonly format: TemplateFormat
  ) {}

  static create(
    id: string,
    template: unknown,
    format: string
  ): Result<TemplateContext, DomainError> {
    const formatResult = TemplateFormat.create(format);
    if (!formatResult.ok) {
      return {
        ok: false,
        error: { kind: "ValidationFailed", field: "format", reason: formatResult.error.message }
      };
    }
    
    return {
      ok: true,
      data: new TemplateContext(id, template, formatResult.data)
    };
  }

  getId(): string { return this.id; }
  getTemplate(): unknown { return this.template; }
  getFormat(): TemplateFormat { return this.format; }
}

// ===============================================
// TemplateFormat（列挙型の代替）
// ===============================================
export class TemplateFormat {
  private constructor(private readonly value: string) {}
  
  private static readonly VALID_FORMATS = ["json", "yaml", "xml", "toml"];
  
  static create(format: string): Result<TemplateFormat, ValidationError> {
    const normalized = format.toLowerCase().trim();
    if (!TemplateFormat.VALID_FORMATS.includes(normalized)) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          format: `Must be one of: ${TemplateFormat.VALID_FORMATS.join(", ")}`,
          input: format
        }
      };
    }
    return { ok: true, data: new TemplateFormat(normalized) };
  }
  
  getValue(): string { return this.value; }
  isJSON(): boolean { return this.value === "json"; }
  isYAML(): boolean { return this.value === "yaml"; }
  isXML(): boolean { return this.value === "xml"; }
  isTOML(): boolean { return this.value === "toml"; }
}
```

### 2.3 処理パイプライン型

```typescript
// ===============================================
// パイプライン状態（Discriminated Union）
// ===============================================
export type PipelineState =
  | { readonly kind: "Idle" }
  | { readonly kind: "Configured"; readonly config: PipelineConfig }
  | { readonly kind: "Running"; readonly stage: PipelineStage }
  | { readonly kind: "Completed"; readonly result: PipelineResult }
  | { readonly kind: "Aborted"; readonly reason: string };

// ===============================================
// パイプラインステージ
// ===============================================
export type PipelineStage =
  | { readonly kind: "Discovery"; readonly progress: number }
  | { readonly kind: "Extraction"; readonly current: number; readonly total: number }
  | { readonly kind: "Validation"; readonly current: number; readonly total: number }
  | { readonly kind: "Mapping"; readonly current: number; readonly total: number }
  | { readonly kind: "Aggregation" }
  | { readonly kind: "Output" };

// ===============================================
// パイプライン設定（Smart Constructor）
// ===============================================
export class PipelineConfig {
  private constructor(
    private readonly schemaContext: SchemaContext,
    private readonly templateContext: TemplateContext,
    private readonly inputPattern: string,
    private readonly outputPath: string
  ) {}

  static create(
    schema: SchemaContext,
    template: TemplateContext,
    inputPattern: string,
    outputPath: string
  ): Result<PipelineConfig, DomainError> {
    if (!inputPattern || inputPattern.trim() === "") {
      return {
        ok: false,
        error: { kind: "ValidationFailed", field: "inputPattern", reason: "Cannot be empty" }
      };
    }
    
    if (!outputPath || outputPath.trim() === "") {
      return {
        ok: false,
        error: { kind: "ValidationFailed", field: "outputPath", reason: "Cannot be empty" }
      };
    }
    
    return {
      ok: true,
      data: new PipelineConfig(schema, template, inputPattern.trim(), outputPath.trim())
    };
  }

  getSchemaContext(): SchemaContext { return this.schemaContext; }
  getTemplateContext(): TemplateContext { return this.templateContext; }
  getInputPattern(): string { return this.inputPattern; }
  getOutputPath(): string { return this.outputPath; }
}

// ===============================================
// パイプライン結果
// ===============================================
export class PipelineResult {
  private constructor(
    private readonly processedDocuments: number,
    private readonly successfulDocuments: number,
    private readonly failedDocuments: number,
    private readonly outputLocation: string,
    private readonly executionTime: number,
    private readonly errors: ReadonlyArray<ProcessingError>
  ) {}

  static create(
    processed: number,
    successful: number,
    failed: number,
    output: string,
    time: number,
    errors: ProcessingError[]
  ): Result<PipelineResult, DomainError> {
    if (processed < 0 || successful < 0 || failed < 0) {
      return {
        ok: false,
        error: { kind: "ValidationFailed", field: "counts", reason: "Counts cannot be negative" }
      };
    }
    
    if (successful + failed !== processed) {
      return {
        ok: false,
        error: { 
          kind: "ValidationFailed", 
          field: "counts", 
          reason: "Success + Failed must equal Processed" 
        }
      };
    }
    
    return {
      ok: true,
      data: new PipelineResult(processed, successful, failed, output, time, [...errors])
    };
  }

  getProcessedCount(): number { return this.processedDocuments; }
  getSuccessCount(): number { return this.successfulDocuments; }
  getFailedCount(): number { return this.failedDocuments; }
  getOutputLocation(): string { return this.outputLocation; }
  getExecutionTime(): number { return this.executionTime; }
  getErrors(): ReadonlyArray<ProcessingError> { return this.errors; }
  
  hasErrors(): boolean { return this.errors.length > 0; }
  isFullySuccessful(): boolean { return this.failedDocuments === 0; }
}

// ===============================================
// 処理エラー詳細
// ===============================================
export type ProcessingError = {
  readonly document: string;
  readonly stage: PipelineStage["kind"];
  readonly error: DomainError;
  readonly timestamp: Date;
};
```

## 3. 型の利用パターン

### 3.1 Schema注入の実装例

```typescript
function injectSchema(
  loader: SchemaLoader,
  path: string
): Promise<Result<SchemaContext, DomainError>> {
  return loader.loadSchema(path).then(result => {
    if (!result.ok) return result;
    return SchemaContext.create(path, result.data);
  });
}
```

### 3.2 パイプライン実行の実装例

```typescript
function executePipeline(
  config: PipelineConfig,
  engine: ProcessingEngine
): Promise<Result<PipelineResult, DomainError>> {
  // 状態遷移を明示的に管理
  let state: PipelineState = { kind: "Configured", config };
  
  // 各ステージを実行
  // すべてResult型を返し、エラーは値として扱う
  return engine.execute(config).then(result => {
    if (!result.ok) {
      state = { kind: "Aborted", reason: result.error.message };
      return result;
    }
    
    state = { kind: "Completed", result: result.data };
    return result;
  });
}
```

## 4. 設計の特徴

1. **全域性の実現**: すべての関数がResult型を返す
2. **型安全性**: Discriminated Unionによる網羅的な状態管理
3. **Schema可変性**: 実行時のSchema注入を型安全に実現
4. **不変性**: すべての型は不変（readonly）
5. **Smart Constructor**: 無効な状態を作れない設計

この設計により、Schema可変性を保ちながら型安全性を確保し、実行時エラーをコンパイル時に検出可能にする。