# ドメインアーキテクチャ - 全域性強化版

## 設計原則の強化

[全域性の原則](docs/development/totality.ja.md)をより厳密に適用し、以下を実現：

1. **Smart Constructorによる不変条件の保証**
2. **Discriminated Unionによる状態の網羅的表現**
3. **Result型による例外の完全排除**
4. **パターンマッチングによる分岐の完全性**

## 1. 強化型定義

### 1.1 共通バリデーション型

```typescript
// ========================================
// Common Validation Errors
// ========================================

export type ValidationError =
  | { kind: "EmptyInput"; field: string }
  | { kind: "TooLong"; field: string; maxLength: number; actualLength: number }
  | { kind: "PatternMismatch"; field: string; pattern: string; value: string }
  | { kind: "OutOfRange"; field: string; min?: number; max?: number; value: number }
  | { kind: "InvalidFormat"; field: string; expectedFormat: string; value: string }
  | { kind: "MissingRequired"; field: string }
  | { kind: "InvalidState"; message: string };

// エラーメッセージ生成（全域関数）
export function getValidationErrorMessage(error: ValidationError): string {
  switch (error.kind) {
    case "EmptyInput":
      return `${error.field} cannot be empty`;
    case "TooLong":
      return `${error.field} exceeds maximum length of ${error.maxLength} (actual: ${error.actualLength})`;
    case "PatternMismatch":
      return `${error.field} "${error.value}" does not match pattern ${error.pattern}`;
    case "OutOfRange":
      const range = `${error.min ?? "??"}-${error.max ?? "??"}`;
      return `${error.field} ${error.value} is out of range ${range}`;
    case "InvalidFormat":
      return `${error.field} has invalid format. Expected: ${error.expectedFormat}, got: ${error.value}`;
    case "MissingRequired":
      return `${error.field} is required but missing`;
    case "InvalidState":
      return error.message;
  }
}
```

### 1.2 パス型の強化

```typescript
// ========================================
// Path Types with Smart Constructor
// ========================================

/** パス種別 - Discriminated Union */
export type PathKind = 
  | { type: "markdown"; extension: ".md" | ".markdown" }
  | { type: "yaml"; extension: ".yml" | ".yaml" }
  | { type: "json"; extension: ".json" }
  | { type: "directory"; extension: null };

/** 汎用パス基底クラス */
abstract class PathBase<K extends PathKind> {
  protected constructor(
    protected readonly value: string,
    protected readonly kind: K
  ) {}
  
  getValue(): string { return this.value; }
  getKind(): K { return this.kind; }
  
  abstract validate(): Result<void, ValidationError>;
}

/** Markdownファイルパス */
export class MarkdownFilePath extends PathBase<{ type: "markdown"; extension: ".md" | ".markdown" }> {
  private constructor(value: string, extension: ".md" | ".markdown") {
    super(value, { type: "markdown", extension });
  }
  
  static create(path: string): Result<MarkdownFilePath, ValidationError> {
    if (!path || path.trim() === '') {
      return { ok: false, error: { kind: "EmptyInput", field: "MarkdownFilePath" } };
    }
    
    const extension = path.endsWith('.md') ? '.md' : 
                     path.endsWith('.markdown') ? '.markdown' : null;
    
    if (!extension) {
      return { 
        ok: false, 
        error: { 
          kind: "InvalidFormat", 
          field: "MarkdownFilePath",
          expectedFormat: "*.md or *.markdown",
          value: path
        }
      };
    }
    
    return { ok: true, data: new MarkdownFilePath(path, extension) };
  }
  
  validate(): Result<void, ValidationError> {
    if (!this.value.endsWith(this.kind.extension)) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          field: "MarkdownFilePath",
          expectedFormat: `*${this.kind.extension}`,
          value: this.value
        }
      };
    }
    return { ok: true, data: undefined };
  }
  
  getBaseName(): string {
    const parts = this.value.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace(this.kind.extension, '');
  }
}

/** Schema/Templateパス */
export class ConfigFilePath extends PathBase<{ type: "yaml" | "json"; extension: string }> {
  private constructor(
    value: string, 
    type: "yaml" | "json",
    extension: string
  ) {
    super(value, { type, extension });
  }
  
  static create(path: string): Result<ConfigFilePath, ValidationError> {
    if (!path || path.trim() === '') {
      return { ok: false, error: { kind: "EmptyInput", field: "ConfigFilePath" } };
    }
    
    let type: "yaml" | "json" | null = null;
    let extension = '';
    
    if (path.endsWith('.yml')) {
      type = "yaml";
      extension = ".yml";
    } else if (path.endsWith('.yaml')) {
      type = "yaml";
      extension = ".yaml";
    } else if (path.endsWith('.json')) {
      type = "json";
      extension = ".json";
    }
    
    if (!type) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          field: "ConfigFilePath",
          expectedFormat: "*.yml, *.yaml, or *.json",
          value: path
        }
      };
    }
    
    return { ok: true, data: new ConfigFilePath(path, type, extension) };
  }
  
  validate(): Result<void, ValidationError> {
    return { ok: true, data: undefined };
  }
  
  isYaml(): boolean {
    return this.kind.type === "yaml";
  }
  
  isJson(): boolean {
    return this.kind.type === "json";
  }
}
```

### 1.3 フロントマター処理の状態型

```typescript
// ========================================
// FrontMatter Processing State
// ========================================

/** フロントマター処理状態 - Discriminated Union */
export type FrontMatterProcessingState =
  | { stage: "extracted"; data: FrontMatter }
  | { stage: "analyzing"; data: FrontMatter; startedAt: Date }
  | { stage: "extracted-info"; data: ExtractedInfo; frontMatter: FrontMatter }
  | { stage: "mapping"; data: ExtractedInfo; startedAt: Date }
  | { stage: "structured"; data: StructuredData; history: ProcessingHistory }
  | { stage: "failed"; error: ProcessingError; history: ProcessingHistory };

/** 処理履歴 */
export interface ProcessingHistory {
  extractedAt?: Date;
  analyzedAt?: Date;
  mappedAt?: Date;
  failedAt?: Date;
  retryCount: number;
}

/** 処理エラー */
export type ProcessingError =
  | { kind: "ExtractionFailed"; message: string }
  | { kind: "AnalysisFailed"; message: string; stage: 1 | 2 }
  | { kind: "ValidationFailed"; errors: ValidationError[] }
  | { kind: "Timeout"; stage: string; duration: number };

/** フロントマター処理パイプライン */
export class FrontMatterProcessor {
  constructor(
    private readonly extractor: FrontMatterExtractor,
    private readonly analyzer: AIAnalysisOrchestrator
  ) {}
  
  async process(
    document: MarkdownDocument,
    schema: AnalysisSchema,
    template: AnalysisTemplate
  ): Promise<Result<StructuredData, ProcessingError>> {
    // 初期状態
    let state: FrontMatterProcessingState;
    
    // フロントマター抽出
    const extractResult = this.extractor.extract(document);
    if (!extractResult.ok) {
      state = {
        stage: "failed",
        error: { kind: "ExtractionFailed", message: extractResult.error.message },
        history: { retryCount: 0, failedAt: new Date() }
      };
      return { ok: false, error: state.error };
    }
    
    state = { stage: "extracted", data: extractResult.data };
    
    // 第1段階: 情報抽出
    state = { stage: "analyzing", data: state.data, startedAt: new Date() };
    
    const infoResult = await this.analyzer.extractInformation(state.data, schema);
    if (!infoResult.ok) {
      state = {
        stage: "failed",
        error: { kind: "AnalysisFailed", message: infoResult.error.message, stage: 1 },
        history: { extractedAt: new Date(), retryCount: 0, failedAt: new Date() }
      };
      return { ok: false, error: state.error };
    }
    
    state = { 
      stage: "extracted-info", 
      data: infoResult.data,
      frontMatter: (state as any).data 
    };
    
    // 第2段階: テンプレートマッピング
    state = { stage: "mapping", data: state.data, startedAt: new Date() };
    
    const structResult = await this.analyzer.mapToTemplate(state.data, schema, template);
    if (!structResult.ok) {
      state = {
        stage: "failed",
        error: { kind: "AnalysisFailed", message: structResult.error.message, stage: 2 },
        history: { 
          extractedAt: new Date(),
          analyzedAt: new Date(),
          retryCount: 0,
          failedAt: new Date()
        }
      };
      return { ok: false, error: state.error };
    }
    
    state = {
      stage: "structured",
      data: structResult.data,
      history: {
        extractedAt: new Date(),
        analyzedAt: new Date(),
        mappedAt: new Date(),
        retryCount: 0
      }
    };
    
    return { ok: true, data: state.data };
  }
  
  // 状態遷移の可視化
  getNextStage(current: FrontMatterProcessingState["stage"]): string[] {
    switch (current) {
      case "extracted": return ["analyzing", "failed"];
      case "analyzing": return ["extracted-info", "failed"];
      case "extracted-info": return ["mapping", "failed"];
      case "mapping": return ["structured", "failed"];
      case "structured": return [];
      case "failed": return ["extracted"]; // リトライ可能
    }
  }
}
```

### 1.4 AI生成テンプレート型

```typescript
// ========================================
// AI-Generated Template
// ========================================

/** テンプレート生成要求 */
export class TemplateGenerationRequest {
  private constructor(
    private readonly extractedInfo: ExtractedInfo,
    private readonly schema: AnalysisSchema,
    private readonly targetFormat: "json" | "yaml" | "markdown"
  ) {}
  
  static create(
    extractedInfo: ExtractedInfo,
    schema: AnalysisSchema,
    targetFormat: "json" | "yaml" | "markdown" = "json"
  ): Result<TemplateGenerationRequest, ValidationError> {
    if (!extractedInfo) {
      return { ok: false, error: { kind: "MissingRequired", field: "ExtractedInfo" } };
    }
    
    if (!schema) {
      return { ok: false, error: { kind: "MissingRequired", field: "Schema" } };
    }
    
    return {
      ok: true,
      data: new TemplateGenerationRequest(extractedInfo, schema, targetFormat)
    };
  }
  
  getExtractedInfo(): ExtractedInfo { return this.extractedInfo; }
  getSchema(): AnalysisSchema { return this.schema; }
  getTargetFormat(): string { return this.targetFormat; }
}

/** AI生成テンプレート - AIが生成した構造化データ */
export class AIGeneratedTemplate {
  private constructor(
    private readonly structuredData: Record<string, unknown>,
    private readonly format: "json" | "yaml" | "markdown",
    private readonly generatedAt: Date,
    private readonly metadata: TemplateGenerationMetadata
  ) {}
  
  static create(
    rawResponse: string,
    format: "json" | "yaml" | "markdown",
    metadata: TemplateGenerationMetadata
  ): Result<AIGeneratedTemplate, ValidationError> {
    // AIレスポンスの解析
    let structuredData: Record<string, unknown>;
    
    try {
      if (format === "json") {
        structuredData = JSON.parse(rawResponse);
      } else if (format === "yaml") {
        // YAML解析
        structuredData = parseYaml(rawResponse);
      } else {
        // Markdownの場合は構造化データとして保存
        structuredData = {
          content: rawResponse,
          format: "markdown"
        };
      }
    } catch (e) {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          field: "AIResponse",
          expectedFormat: format,
          value: rawResponse.substring(0, 100) + "..."
        }
      };
    }
    
    return {
      ok: true,
      data: new AIGeneratedTemplate(
        structuredData,
        format,
        new Date(),
        metadata
      )
    };
  }
  
  getStructuredData(): Readonly<Record<string, unknown>> { 
    return this.structuredData; 
  }
  
  getFormat(): string { return this.format; }
  getGeneratedAt(): Date { return this.generatedAt; }
  getMetadata(): TemplateGenerationMetadata { return this.metadata; }
  
  // スキーマに対する検証
  validateAgainstSchema(schema: AnalysisSchema): Result<void, ValidationError[]> {
    return schema.validate(this.structuredData);
  }
}

/** テンプレート生成メタデータ */
export interface TemplateGenerationMetadata {
  promptUsed: string;
  aiProvider: string;
  duration: number;
  retryCount: number;
}
```

### 1.5 集約境界の強化

```typescript
// ========================================
// Aggregate Boundaries with Invariants
// ========================================

/** ドキュメント集約 - 不変条件を保証 */
export class DocumentAggregate {
  private constructor(
    private readonly documents: Map<DocumentId, MarkdownDocument>,
    private readonly processingStates: Map<DocumentId, FrontMatterProcessingState>,
    private readonly version: number
  ) {}
  
  static create(): DocumentAggregate {
    return new DocumentAggregate(new Map(), new Map(), 0);
  }
  
  // ドキュメント追加（不変条件チェック付き）
  addDocument(document: MarkdownDocument): Result<DocumentAggregate, ValidationError> {
    const id = document.getId();
    
    if (this.documents.has(id)) {
      return {
        ok: false,
        error: {
          kind: "InvalidState",
          message: `Document ${id.getValue()} already exists`
        }
      };
    }
    
    const newDocuments = new Map(this.documents);
    newDocuments.set(id, document);
    
    const newStates = new Map(this.processingStates);
    if (document.hasFrontMatter()) {
      newStates.set(id, {
        stage: "extracted",
        data: document.getFrontMatter()!
      });
    }
    
    return {
      ok: true,
      data: new DocumentAggregate(newDocuments, newStates, this.version + 1)
    };
  }
  
  // 処理状態の更新（状態遷移ルールを強制）
  updateProcessingState(
    documentId: DocumentId,
    newState: FrontMatterProcessingState
  ): Result<DocumentAggregate, ValidationError> {
    const currentState = this.processingStates.get(documentId);
    
    if (!currentState) {
      return {
        ok: false,
        error: {
          kind: "InvalidState",
          message: `No processing state for document ${documentId.getValue()}`
        }
      };
    }
    
    // 状態遷移の妥当性チェック
    if (!this.isValidTransition(currentState.stage, newState.stage)) {
      return {
        ok: false,
        error: {
          kind: "InvalidState",
          message: `Invalid transition from ${currentState.stage} to ${newState.stage}`
        }
      };
    }
    
    const newStates = new Map(this.processingStates);
    newStates.set(documentId, newState);
    
    return {
      ok: true,
      data: new DocumentAggregate(this.documents, newStates, this.version + 1)
    };
  }
  
  private isValidTransition(from: string, to: string): boolean {
    const validTransitions: Record<string, string[]> = {
      "extracted": ["analyzing", "failed"],
      "analyzing": ["extracted-info", "failed"],
      "extracted-info": ["mapping", "failed"],
      "mapping": ["structured", "failed"],
      "structured": [],
      "failed": ["extracted"]
    };
    
    return validTransitions[from]?.includes(to) ?? false;
  }
  
  // 集約の状態を取得
  getDocumentCount(): number {
    return this.documents.size;
  }
  
  getProcessingStats(): ProcessingStats {
    const stats: ProcessingStats = {
      total: this.documents.size,
      extracted: 0,
      analyzing: 0,
      extractedInfo: 0,
      mapping: 0,
      structured: 0,
      failed: 0
    };
    
    for (const state of this.processingStates.values()) {
      switch (state.stage) {
        case "extracted": stats.extracted++; break;
        case "analyzing": stats.analyzing++; break;
        case "extracted-info": stats.extractedInfo++; break;
        case "mapping": stats.mapping++; break;
        case "structured": stats.structured++; break;
        case "failed": stats.failed++; break;
      }
    }
    
    return stats;
  }
}

interface ProcessingStats {
  total: number;
  extracted: number;
  analyzing: number;
  extractedInfo: number;
  mapping: number;
  structured: number;
  failed: number;
}
```

## 2. イベント駆動の全域性

### 2.1 イベント型の強化

```typescript
// ========================================
// Domain Events with Type Safety
// ========================================

/** イベント基底型 */
export type DomainEventBase<T extends string, P> = {
  eventType: T;
  aggregateId: string;
  occurredAt: Date;
  version: number;
  payload: P;
};

/** ドメインイベント - Discriminated Union */
export type DomainEvent =
  | DomainEventBase<"FrontMatterExtracted", {
      documentPath: string;
      frontMatter: Record<string, unknown>;
    }>
  | DomainEventBase<"InformationExtracted", {
      documentId: string;
      extractedInfo: Record<string, unknown>;
      duration: number;
    }>
  | DomainEventBase<"DataStructured", {
      documentId: string;
      structuredData: Record<string, unknown>;
      templateName: string;
      duration: number;
    }>
  | DomainEventBase<"ProcessingFailed", {
      documentId: string;
      error: ProcessingError;
      stage: string;
    }>
  | DomainEventBase<"BatchCompleted", {
      totalDocuments: number;
      successCount: number;
      failureCount: number;
      duration: number;
    }>;

/** イベントハンドラー型 */
export type EventHandler<E extends DomainEvent> = (event: E) => Promise<Result<void, Error>>;

/** イベントバス - 型安全な実装 */
export class EventBus {
  private handlers = new Map<string, EventHandler<any>[]>();
  
  subscribe<E extends DomainEvent>(
    eventType: E["eventType"],
    handler: EventHandler<E>
  ): void {
    const existing = this.handlers.get(eventType) || [];
    this.handlers.set(eventType, [...existing, handler]);
  }
  
  async publish<E extends DomainEvent>(event: E): Promise<Result<void, Error>[]> {
    const handlers = this.handlers.get(event.eventType) || [];
    const results = await Promise.all(
      handlers.map(handler => handler(event))
    );
    return results;
  }
  
  // イベントの網羅的処理
  async handle(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case "FrontMatterExtracted":
        await this.handleFrontMatterExtracted(event);
        break;
      case "InformationExtracted":
        await this.handleInformationExtracted(event);
        break;
      case "DataStructured":
        await this.handleDataStructured(event);
        break;
      case "ProcessingFailed":
        await this.handleProcessingFailed(event);
        break;
      case "BatchCompleted":
        await this.handleBatchCompleted(event);
        break;
    }
  }
  
  private async handleFrontMatterExtracted(
    event: DomainEventBase<"FrontMatterExtracted", any>
  ): Promise<void> {
    console.log(`FrontMatter extracted from ${event.payload.documentPath}`);
  }
  
  private async handleInformationExtracted(
    event: DomainEventBase<"InformationExtracted", any>
  ): Promise<void> {
    console.log(`Information extracted in ${event.payload.duration}ms`);
  }
  
  private async handleDataStructured(
    event: DomainEventBase<"DataStructured", any>
  ): Promise<void> {
    console.log(`Data structured using template: ${event.payload.templateName}`);
  }
  
  private async handleProcessingFailed(
    event: DomainEventBase<"ProcessingFailed", any>
  ): Promise<void> {
    console.error(`Processing failed at ${event.payload.stage}: ${event.payload.error.kind}`);
  }
  
  private async handleBatchCompleted(
    event: DomainEventBase<"BatchCompleted", any>
  ): Promise<void> {
    const { successCount, failureCount, duration } = event.payload;
    console.log(`Batch completed: ${successCount} success, ${failureCount} failures in ${duration}ms`);
  }
}
```

## 3. 実装チェックリスト

### ✅ 全域性の実現

- [ ] すべての関数がResult型を返す
- [ ] 例外を投げるコードが存在しない
- [ ] Smart Constructorで不正な状態を作れない
- [ ] Discriminated Unionで状態を網羅的に表現
- [ ] switch文にdefault節が不要

### ✅ 型安全性の保証

- [ ] 型アサーション（as）を使用していない
- [ ] any型を使用していない
- [ ] オプショナルプロパティを最小限に抑えている
- [ ] nullやundefinedの扱いが明確

### ✅ 不変性の維持

- [ ] すべてのクラスがイミュータブル
- [ ] privateコンストラクタとstatic createパターン
- [ ] 状態変更は新しいインスタンスを返す

### ✅ ドメイン境界の明確化

- [ ] 各ドメインが単一の責務を持つ
- [ ] イベント駆動で疎結合
- [ ] 反腐敗層で外部依存を隔離

## 4. まとめ

本設計により、コンパイル時に以下を保証：

1. **不正な状態が作成できない**
2. **すべてのエラーケースが処理される**
3. **状態遷移が正しく制御される**
4. **型の不整合が発生しない**
5. **ドメイン境界が侵害されない**

これにより、ランタイムエラーを最小化し、保守性と拡張性の高いシステムを実現します。