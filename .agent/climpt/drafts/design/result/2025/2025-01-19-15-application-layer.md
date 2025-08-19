# アプリケーション層設計 - ユースケースとDI

## 1. ユースケース定義

### 1.1 メインユースケース

```typescript
import { Result, DomainError, ExecutionConfig, PipelineExecutionResult } from "../domain/domain-core-types";
import { SchemaSwitchManager, DynamicPipelineFactory } from "../domain/domain-services";

// フロントマター処理ユースケース
export class ProcessFrontMatterUseCase {
  constructor(
    private readonly schemaManager: SchemaSwitchManager,
    private readonly pipelineFactory: DynamicPipelineFactory
  ) {}
  
  async execute(configPath: string): Promise<Result<PipelineExecutionResult, DomainError>> {
    // 設定読み込み
    const configResult = await this.loadConfiguration(configPath);
    if (!configResult.ok) {
      return configResult;
    }
    
    // Schemaセット読み込み
    const schemaSetResult = await this.schemaManager.loadSchemaSet(configResult.data);
    if (!schemaSetResult.ok) {
      return schemaSetResult;
    }
    
    // パイプライン作成
    const pipelineResult = this.pipelineFactory.createPipeline(
      configResult.data,
      schemaSetResult.data
    );
    if (!pipelineResult.ok) {
      return pipelineResult;
    }
    
    // パイプライン実行
    try {
      const result = await pipelineResult.data.execute();
      return result;
    } finally {
      // リソースクリーンアップ
      pipelineResult.data.dispose();
      this.schemaManager.unloadCurrentSet();
    }
  }
  
  private async loadConfiguration(path: string): Promise<Result<ExecutionConfig, DomainError>> {
    // 設定ファイル読み込みロジック（実装は省略）
    const config = {
      schemaPath: "examples/climpt-registry/schema.json",
      templatePath: "examples/climpt-registry/template.json",
      inputPath: ".agent/climpt/registered-commands.md",
      outputPath: "examples/output/climpt-registry.json",
      outputFormat: "json"
    };
    
    return ExecutionConfig.create(config);
  }
}
```

### 1.2 サブユースケース

```typescript
// Schema切り替えユースケース
export class SwitchSchemaUseCase {
  constructor(
    private readonly schemaManager: SchemaSwitchManager,
    private readonly registry: SchemaRegistry
  ) {}
  
  async execute(schemaName: string): Promise<Result<void, DomainError>> {
    // レジストリからSchema設定取得
    const configResult = await this.registry.getConfig(schemaName);
    if (!configResult.ok) {
      return configResult;
    }
    
    // 現在のSchemaをアンロード
    this.schemaManager.unloadCurrentSet();
    
    // 新しいSchemaをロード
    const loadResult = await this.schemaManager.loadSchemaSet(configResult.data);
    if (!loadResult.ok) {
      return loadResult;
    }
    
    return { ok: true, data: undefined };
  }
}

// バッチ処理ユースケース
export class BatchProcessingUseCase {
  constructor(
    private readonly mainUseCase: ProcessFrontMatterUseCase
  ) {}
  
  async execute(configPaths: string[]): Promise<Result<BatchResult, DomainError>> {
    const results: PipelineExecutionResult[] = [];
    const errors: DomainError[] = [];
    
    for (const configPath of configPaths) {
      const result = await this.mainUseCase.execute(configPath);
      if (result.ok) {
        results.push(result.data);
      } else {
        errors.push(result.error);
      }
    }
    
    return BatchResult.create(results, errors);
  }
}

// バッチ結果
export class BatchResult {
  private constructor(
    private readonly successes: readonly PipelineExecutionResult[],
    private readonly failures: readonly DomainError[]
  ) {}
  
  static create(
    successes: PipelineExecutionResult[],
    failures: DomainError[]
  ): Result<BatchResult, DomainError> {
    return {
      ok: true,
      data: new BatchResult(successes, failures)
    };
  }
  
  getSuccesses(): readonly PipelineExecutionResult[] {
    return this.successes;
  }
  
  getFailures(): readonly DomainError[] {
    return this.failures;
  }
  
  getTotalProcessed(): number {
    return this.successes.reduce((sum, r) => sum + r.getProcessedCount(), 0);
  }
  
  getTotalFailed(): number {
    return this.failures.length + 
           this.successes.reduce((sum, r) => sum + r.getFailedCount(), 0);
  }
}
```

## 2. 依存性注入コンテナ

### 2.1 DIコンテナ設計

```typescript
// DIコンテナインターフェース
export interface DIContainer {
  register<T>(token: string, factory: () => T): void;
  registerSingleton<T>(token: string, factory: () => T): void;
  resolve<T>(token: string): T;
  createScope(): DIContainer;
}

// DIコンテナ実装
export class SimpleDIContainer implements DIContainer {
  private factories = new Map<string, () => unknown>();
  private singletons = new Map<string, unknown>();
  private parent?: SimpleDIContainer;
  
  constructor(parent?: SimpleDIContainer) {
    this.parent = parent;
  }
  
  register<T>(token: string, factory: () => T): void {
    this.factories.set(token, factory);
  }
  
  registerSingleton<T>(token: string, factory: () => T): void {
    if (!this.singletons.has(token)) {
      this.singletons.set(token, factory());
    }
  }
  
  resolve<T>(token: string): T {
    // シングルトンチェック
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }
    
    // ファクトリーチェック
    if (this.factories.has(token)) {
      const factory = this.factories.get(token)!;
      return factory() as T;
    }
    
    // 親コンテナチェック
    if (this.parent) {
      return this.parent.resolve<T>(token);
    }
    
    throw new Error(`Dependency not found: ${token}`);
  }
  
  createScope(): DIContainer {
    return new SimpleDIContainer(this);
  }
}
```

### 2.2 DIトークン定義

```typescript
// DIトークン定義
export const DITokens = {
  // コアサービス（Schema非依存）
  FrontMatterExtractor: "FrontMatterExtractor",
  FileDiscoveryService: "FileDiscoveryService",
  
  // Schema管理
  SchemaSwitchManager: "SchemaSwitchManager",
  SchemaRegistry: "SchemaRegistry",
  
  // 適用サービス
  SchemaApplicationService: "SchemaApplicationService",
  TemplateApplicationService: "TemplateApplicationService",
  
  // AI分析
  AIAnalysisService: "AIAnalysisService",
  
  // パイプライン
  DynamicPipelineFactory: "DynamicPipelineFactory",
  
  // ユースケース
  ProcessFrontMatterUseCase: "ProcessFrontMatterUseCase",
  SwitchSchemaUseCase: "SwitchSchemaUseCase",
  BatchProcessingUseCase: "BatchProcessingUseCase",
  
  // インフラ
  FileSystem: "FileSystem",
  HttpClient: "HttpClient",
  Logger: "Logger",
  
  // 設定
  ApplicationConfig: "ApplicationConfig"
} as const;

export type DIToken = typeof DITokens[keyof typeof DITokens];
```

### 2.3 依存性登録

```typescript
import { 
  FrontMatterExtractorService,
  FileDiscoveryServiceImpl,
  SchemaInjectionManager,
  SchemaApplicationServiceImpl,
  TemplateApplicationServiceImpl,
  ClaudeAnalysisService,
  DynamicPipelineFactoryImpl
} from "../domain/domain-services";

// 依存性登録関数
export function registerDependencies(container: DIContainer): void {
  // コアサービス登録（シングルトン）
  container.registerSingleton(
    DITokens.FrontMatterExtractor,
    () => new FrontMatterExtractorService()
  );
  
  container.registerSingleton(
    DITokens.FileDiscoveryService,
    () => new FileDiscoveryServiceImpl()
  );
  
  // Schema管理登録（リクエストスコープ）
  container.register(
    DITokens.SchemaSwitchManager,
    () => new SchemaInjectionManager()
  );
  
  // 適用サービス登録
  container.register(
    DITokens.SchemaApplicationService,
    () => new SchemaApplicationServiceImpl()
  );
  
  container.register(
    DITokens.TemplateApplicationService,
    () => new TemplateApplicationServiceImpl()
  );
  
  // AI分析サービス登録
  container.registerSingleton(
    DITokens.AIAnalysisService,
    () => new ClaudeAnalysisService()
  );
  
  // パイプラインファクトリ登録
  container.register(
    DITokens.DynamicPipelineFactory,
    () => new DynamicPipelineFactoryImpl(
      container.resolve(DITokens.FrontMatterExtractor),
      container.resolve(DITokens.FileDiscoveryService),
      container.resolve(DITokens.SchemaApplicationService),
      container.resolve(DITokens.TemplateApplicationService)
    )
  );
  
  // ユースケース登録
  container.register(
    DITokens.ProcessFrontMatterUseCase,
    () => new ProcessFrontMatterUseCase(
      container.resolve(DITokens.SchemaSwitchManager),
      container.resolve(DITokens.DynamicPipelineFactory)
    )
  );
  
  container.register(
    DITokens.SwitchSchemaUseCase,
    () => new SwitchSchemaUseCase(
      container.resolve(DITokens.SchemaSwitchManager),
      container.resolve(DITokens.SchemaRegistry)
    )
  );
  
  container.register(
    DITokens.BatchProcessingUseCase,
    () => new BatchProcessingUseCase(
      container.resolve(DITokens.ProcessFrontMatterUseCase)
    )
  );
}
```

## 3. アプリケーションファサード

### 3.1 アプリケーションファサード

```typescript
// アプリケーションファサード
export class ApplicationFacade {
  private container: DIContainer;
  
  constructor() {
    this.container = new SimpleDIContainer();
    registerDependencies(this.container);
  }
  
  // メイン処理実行
  async processFrontMatter(configPath: string): Promise<Result<ProcessingReport, DomainError>> {
    const useCase = this.container.resolve<ProcessFrontMatterUseCase>(
      DITokens.ProcessFrontMatterUseCase
    );
    
    const result = await useCase.execute(configPath);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    
    return ProcessingReport.create(result.data);
  }
  
  // Schema切り替え
  async switchSchema(schemaName: string): Promise<Result<void, DomainError>> {
    const useCase = this.container.resolve<SwitchSchemaUseCase>(
      DITokens.SwitchSchemaUseCase
    );
    
    return useCase.execute(schemaName);
  }
  
  // バッチ処理
  async processBatch(configPaths: string[]): Promise<Result<BatchReport, DomainError>> {
    const useCase = this.container.resolve<BatchProcessingUseCase>(
      DITokens.BatchProcessingUseCase
    );
    
    const result = await useCase.execute(configPaths);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    
    return BatchReport.create(result.data);
  }
  
  // リクエストスコープ作成
  createRequestScope(): RequestScope {
    const scopedContainer = this.container.createScope();
    return new RequestScope(scopedContainer);
  }
}

// リクエストスコープ
export class RequestScope {
  constructor(private readonly container: DIContainer) {}
  
  async execute(configPath: string): Promise<Result<PipelineExecutionResult, DomainError>> {
    const useCase = this.container.resolve<ProcessFrontMatterUseCase>(
      DITokens.ProcessFrontMatterUseCase
    );
    return useCase.execute(configPath);
  }
  
  dispose(): void {
    // スコープのクリーンアップ
  }
}
```

### 3.2 レポート生成

```typescript
// 処理レポート
export class ProcessingReport {
  private constructor(
    private readonly result: PipelineExecutionResult,
    private readonly timestamp: Date
  ) {}
  
  static create(result: PipelineExecutionResult): Result<ProcessingReport, DomainError> {
    return {
      ok: true,
      data: new ProcessingReport(result, new Date())
    };
  }
  
  toJSON(): object {
    return {
      timestamp: this.timestamp.toISOString(),
      outputPath: this.result.getOutputPath().getValue(),
      statistics: {
        processed: this.result.getProcessedCount(),
        skipped: this.result.getSkippedCount(),
        failed: this.result.getFailedCount(),
        executionTimeMs: this.result.getExecutionTime()
      }
    };
  }
  
  toMarkdown(): string {
    return `
# Processing Report

- **Timestamp**: ${this.timestamp.toISOString()}
- **Output**: ${this.result.getOutputPath().getValue()}

## Statistics
- Processed: ${this.result.getProcessedCount()}
- Skipped: ${this.result.getSkippedCount()}
- Failed: ${this.result.getFailedCount()}
- Execution Time: ${this.result.getExecutionTime()}ms
    `.trim();
  }
}

// バッチレポート
export class BatchReport {
  private constructor(
    private readonly batchResult: BatchResult,
    private readonly timestamp: Date
  ) {}
  
  static create(batchResult: BatchResult): Result<BatchReport, DomainError> {
    return {
      ok: true,
      data: new BatchReport(batchResult, new Date())
    };
  }
  
  toJSON(): object {
    return {
      timestamp: this.timestamp.toISOString(),
      summary: {
        totalSuccesses: this.batchResult.getSuccesses().length,
        totalFailures: this.batchResult.getFailures().length,
        totalProcessed: this.batchResult.getTotalProcessed(),
        totalFailed: this.batchResult.getTotalFailed()
      },
      successes: this.batchResult.getSuccesses().map(s => ({
        outputPath: s.getOutputPath().getValue(),
        processed: s.getProcessedCount(),
        skipped: s.getSkippedCount(),
        failed: s.getFailedCount()
      })),
      failures: this.batchResult.getFailures().map(f => ({
        kind: f.kind,
        details: f
      }))
    };
  }
}
```

## 4. エラーハンドリング

### 4.1 グローバルエラーハンドラー

```typescript
// エラーハンドラー
export class GlobalErrorHandler {
  private readonly handlers = new Map<DomainError["kind"], ErrorHandler>();
  
  register(kind: DomainError["kind"], handler: ErrorHandler): void {
    this.handlers.set(kind, handler);
  }
  
  handle(error: DomainError): ErrorResponse {
    const handler = this.handlers.get(error.kind);
    if (handler) {
      return handler.handle(error);
    }
    return this.defaultHandler(error);
  }
  
  private defaultHandler(error: DomainError): ErrorResponse {
    return {
      message: `An error occurred: ${error.kind}`,
      details: error,
      suggestion: "Please check the logs for more information"
    };
  }
}

// エラーハンドラーインターフェース
export interface ErrorHandler {
  handle(error: DomainError): ErrorResponse;
}

// エラーレスポンス
export interface ErrorResponse {
  message: string;
  details: unknown;
  suggestion?: string;
}

// 具体的なエラーハンドラー実装
export class SchemaNotLoadedHandler implements ErrorHandler {
  handle(error: Extract<DomainError, { kind: "SchemaNotLoaded" }>): ErrorResponse {
    return {
      message: "Schema is not loaded",
      details: error,
      suggestion: "Please ensure the schema file exists and is valid JSON"
    };
  }
}

export class FileNotFoundHandler implements ErrorHandler {
  handle(error: Extract<DomainError, { kind: "FileNotFound" }>): ErrorResponse {
    return {
      message: `File not found: ${error.path}`,
      details: error,
      suggestion: "Please check the file path and ensure the file exists"
    };
  }
}

// エラーハンドラー登録
export function registerErrorHandlers(handler: GlobalErrorHandler): void {
  handler.register("SchemaNotLoaded", new SchemaNotLoadedHandler());
  handler.register("FileNotFound", new FileNotFoundHandler());
  // 他のハンドラー登録...
}
```

## 5. アプリケーション起動

### 5.1 メインエントリーポイント

```typescript
// アプリケーションブートストラップ
export class ApplicationBootstrap {
  private facade?: ApplicationFacade;
  private errorHandler?: GlobalErrorHandler;
  
  async initialize(): Promise<void> {
    // アプリケーション初期化
    this.facade = new ApplicationFacade();
    
    // エラーハンドラー初期化
    this.errorHandler = new GlobalErrorHandler();
    registerErrorHandlers(this.errorHandler);
    
    // その他の初期化処理
    await this.loadEnvironmentConfig();
    await this.setupLogging();
  }
  
  async run(args: string[]): Promise<void> {
    if (!this.facade || !this.errorHandler) {
      throw new Error("Application not initialized");
    }
    
    try {
      // コマンドライン引数解析
      const command = this.parseCommand(args);
      
      // コマンド実行
      switch (command.type) {
        case "process":
          await this.handleProcess(command.configPath);
          break;
        case "batch":
          await this.handleBatch(command.configPaths);
          break;
        case "switch":
          await this.handleSwitch(command.schemaName);
          break;
        default:
          console.error("Unknown command");
      }
    } catch (error) {
      console.error("Fatal error:", error);
      process.exit(1);
    }
  }
  
  private async handleProcess(configPath: string): Promise<void> {
    const result = await this.facade!.processFrontMatter(configPath);
    if (result.ok) {
      console.log(result.data.toJSON());
    } else {
      const response = this.errorHandler!.handle(result.error);
      console.error(response.message);
      if (response.suggestion) {
        console.log(`Suggestion: ${response.suggestion}`);
      }
    }
  }
  
  private async handleBatch(configPaths: string[]): Promise<void> {
    const result = await this.facade!.processBatch(configPaths);
    if (result.ok) {
      console.log(result.data.toJSON());
    } else {
      const response = this.errorHandler!.handle(result.error);
      console.error(response.message);
    }
  }
  
  private async handleSwitch(schemaName: string): Promise<void> {
    const result = await this.facade!.switchSchema(schemaName);
    if (result.ok) {
      console.log(`Successfully switched to schema: ${schemaName}`);
    } else {
      const response = this.errorHandler!.handle(result.error);
      console.error(response.message);
    }
  }
  
  private parseCommand(args: string[]): Command {
    // コマンドライン引数解析ロジック（実装は省略）
    return { type: "process", configPath: args[0] };
  }
  
  private async loadEnvironmentConfig(): Promise<void> {
    // 環境設定読み込み（実装は省略）
  }
  
  private async setupLogging(): Promise<void> {
    // ロギング設定（実装は省略）
  }
}

// コマンド型定義
type Command = 
  | { type: "process"; configPath: string }
  | { type: "batch"; configPaths: string[] }
  | { type: "switch"; schemaName: string };

// メイン関数
export async function main(): Promise<void> {
  const app = new ApplicationBootstrap();
  await app.initialize();
  await app.run(process.argv.slice(2));
}
```

## まとめ

このアプリケーション層設計により：

1. **ユースケースの明確化**: ビジネスロジックをユースケースとして整理
2. **依存性注入**: DIコンテナによる柔軟な依存関係管理
3. **Schema可変性対応**: 実行時のSchema切り替えを自然に実現
4. **エラーハンドリング**: 統一的なエラー処理メカニズム
5. **全域性原則の実装**: Result型とSmart Constructorによる型安全性

アプリケーション層がドメイン層とインフラ層を適切に仲介し、Schema可変性を保ちながら型安全な実装を実現しています。