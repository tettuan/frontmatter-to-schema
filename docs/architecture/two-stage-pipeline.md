# 二段階処理パイプライン アーキテクチャ設計書

## エグゼクティブサマリー

本設計書は、Issue
#465に対応する二段階処理パイプラインアーキテクチャを定義します。 Stage
1で個別Markdownファイルからコマンドオブジェクトを生成し、Stage
2でコマンド群を集約して最終レジストリを生成する、段階的な処理モデルを実装します。

## 1. ドメインモデル設計

### 1.1 新規ドメイン境界

#### CommandAnalysisDomain（Stage 1）

```typescript
// 集約ルート：コマンド処理の中核
export class CommandProcessor {
  private constructor(
    private readonly extractor: FrontMatterExtractor,
    private readonly validator: SchemaValidator,
    private readonly mapper: TemplateMapper,
  ) {}

  // Smart Constructor with Totality
  static create(deps: {
    extractor: FrontMatterExtractor;
    validator: SchemaValidator;
    mapper: TemplateMapper;
  }): Result<CommandProcessor, DomainError> {
    if (!deps.extractor || !deps.validator || !deps.mapper) {
      return { ok: false, error: { kind: "InvalidDependencies" } };
    }
    return {
      ok: true,
      data: new CommandProcessor(deps.extractor, deps.validator, deps.mapper),
    };
  }

  async process(
    document: MarkdownDocument,
    schema: CommandSchema,
    template: CommandTemplate,
  ): Promise<Result<Command, ProcessingError>> {
    // Stage 1-1: Extract frontmatter
    const frontMatterResult = await this.extractor.extract(document);
    if (!frontMatterResult.ok) return frontMatterResult;

    // Stage 1-2: Validate against command schema
    const validationResult = await this.validator.validate(
      frontMatterResult.data,
      schema,
    );
    if (!validationResult.ok) return validationResult;

    // Stage 1-3: Map to command template
    const mappingResult = await this.mapper.map(
      validationResult.data,
      template,
    );

    return mappingResult;
  }
}
```

#### RegistryAggregationDomain（Stage 2）

```typescript
// 集約ルート：レジストリ構築の中核
export class RegistryBuilder {
  private constructor(
    private readonly aggregator: CommandAggregator,
    private readonly validator: SchemaValidator,
    private readonly mapper: TemplateMapper,
  ) {}

  // Smart Constructor with Totality
  static create(deps: {
    aggregator: CommandAggregator;
    validator: SchemaValidator;
    mapper: TemplateMapper;
  }): Result<RegistryBuilder, DomainError> {
    if (!deps.aggregator || !deps.validator || !deps.mapper) {
      return { ok: false, error: { kind: "InvalidDependencies" } };
    }
    return {
      ok: true,
      data: new RegistryBuilder(deps.aggregator, deps.validator, deps.mapper),
    };
  }

  async build(
    commands: Command[],
    schema: RegistrySchema,
    template: RegistryTemplate,
  ): Promise<Result<Registry, BuildError>> {
    // Stage 2-1: Aggregate commands and generate availableConfigs
    const aggregationResult = await this.aggregator.aggregate(commands);
    if (!aggregationResult.ok) return aggregationResult;

    // Stage 2-2: Validate against registry schema
    const validationResult = await this.validator.validate(
      aggregationResult.data,
      schema,
    );
    if (!validationResult.ok) return validationResult;

    // Stage 2-3: Map to registry template
    const mappingResult = await this.mapper.map(
      validationResult.data,
      template,
    );

    return mappingResult;
  }
}
```

### 1.2 Value Objects（全域性原則に基づく）

```typescript
// Discriminated Union for Processing State
export type ProcessingState =
  | { kind: "NotStarted" }
  | { kind: "Stage1Processing"; progress: number; total: number }
  | { kind: "Stage1Complete"; commands: Command[] }
  | { kind: "Stage2Processing" }
  | { kind: "Stage2Complete"; registry: Registry }
  | { kind: "Failed"; error: ProcessingError };

// Command Value Object with validation
export class Command {
  private constructor(
    readonly c1: string,
    readonly c2: string,
    readonly c3: string,
    readonly metadata: Record<string, unknown>,
  ) {}

  static create(data: unknown): Result<Command, ValidationError> {
    if (!isValidCommandData(data)) {
      return { ok: false, error: { kind: "InvalidCommandData", data } };
    }

    const { c1, c2, c3, ...metadata } = data as CommandData;

    // Validate c1, c2, c3 are non-empty strings
    if (!c1 || !c2 || !c3) {
      return {
        ok: false,
        error: { kind: "MissingRequiredFields", fields: ["c1", "c2", "c3"] },
      };
    }

    return {
      ok: true,
      data: new Command(c1, c2, c3, metadata),
    };
  }
}

// Registry Value Object
export class Registry {
  private constructor(
    readonly version: string,
    readonly availableConfigs: string[],
    readonly commands: Command[],
    readonly metadata: Record<string, unknown>,
  ) {}

  static create(data: unknown): Result<Registry, ValidationError> {
    if (!isValidRegistryData(data)) {
      return { ok: false, error: { kind: "InvalidRegistryData", data } };
    }

    const { version, availableConfigs, commands, ...metadata } =
      data as RegistryData;

    // Validate version format
    if (!isValidVersion(version)) {
      return { ok: false, error: { kind: "InvalidVersion", version } };
    }

    // Validate availableConfigs matches c1 values from commands
    const c1Values = new Set(commands.map((cmd) => cmd.c1));
    const configSet = new Set(availableConfigs);

    if (!areSetsEqual(c1Values, configSet)) {
      return {
        ok: false,
        error: {
          kind: "ConfigMismatch",
          expected: c1Values,
          actual: configSet,
        },
      };
    }

    return {
      ok: true,
      data: new Registry(version, availableConfigs, commands, metadata),
    };
  }
}
```

## 2. ユースケース実装

```typescript
export class TwoStageProcessingUseCase {
  private constructor(
    private readonly commandProcessor: CommandProcessor,
    private readonly registryBuilder: RegistryBuilder,
    private readonly schemaRepo: SchemaRepository,
    private readonly templateRepo: TemplateRepository,
    private readonly eventBus: EventBus,
  ) {}

  static create(
    deps: UseCaseDependencies,
  ): Result<TwoStageProcessingUseCase, DomainError> {
    // Validate all dependencies exist
    const validation = validateDependencies(deps);
    if (!validation.ok) return validation;

    return {
      ok: true,
      data: new TwoStageProcessingUseCase(
        deps.commandProcessor,
        deps.registryBuilder,
        deps.schemaRepo,
        deps.templateRepo,
        deps.eventBus,
      ),
    };
  }

  async execute(
    config: TwoStageConfig,
  ): Promise<Result<Registry, ProcessingError>> {
    // Emit processing started event
    await this.eventBus.emit({
      type: "TwoStageProcessingStarted",
      timestamp: new Date(),
      config,
    });

    // Stage 1: Process all documents to commands
    const stage1Result = await this.executeStage1(
      config.documents,
      config.commandSchemaPath,
      config.commandTemplatePath,
    );

    if (!stage1Result.ok) {
      await this.eventBus.emit({
        type: "Stage1Failed",
        error: stage1Result.error,
      });
      return stage1Result;
    }

    await this.eventBus.emit({
      type: "Stage1Completed",
      commands: stage1Result.data,
    });

    // Stage 2: Aggregate commands to registry
    const stage2Result = await this.executeStage2(
      stage1Result.data,
      config.registrySchemaPath,
      config.registryTemplatePath,
    );

    if (!stage2Result.ok) {
      await this.eventBus.emit({
        type: "Stage2Failed",
        error: stage2Result.error,
      });
      return stage2Result;
    }

    await this.eventBus.emit({
      type: "TwoStageProcessingCompleted",
      registry: stage2Result.data,
    });

    return stage2Result;
  }

  private async executeStage1(
    documents: MarkdownDocument[],
    schemaPath: string,
    templatePath: string,
  ): Promise<Result<Command[], ProcessingError>> {
    // Load schema and template
    const schemaResult = await this.schemaRepo.load(schemaPath);
    if (!schemaResult.ok) return schemaResult;

    const templateResult = await this.templateRepo.load(templatePath);
    if (!templateResult.ok) return templateResult;

    const commands: Command[] = [];
    const errors: ProcessingError[] = [];

    // Process each document
    for (const [index, doc] of documents.entries()) {
      const result = await this.commandProcessor.process(
        doc,
        schemaResult.data,
        templateResult.data,
      );

      if (result.ok) {
        commands.push(result.data);
      } else {
        errors.push({
          ...result.error,
          documentIndex: index,
          documentPath: doc.path,
        });
      }

      // Emit progress event
      await this.eventBus.emit({
        type: "Stage1Progress",
        current: index + 1,
        total: documents.length,
      });
    }

    // Fail if any document failed
    if (errors.length > 0) {
      return {
        ok: false,
        error: { kind: "Stage1BatchError", errors },
      };
    }

    return { ok: true, data: commands };
  }

  private async executeStage2(
    commands: Command[],
    schemaPath: string,
    templatePath: string,
  ): Promise<Result<Registry, ProcessingError>> {
    // Load schema and template
    const schemaResult = await this.schemaRepo.load(schemaPath);
    if (!schemaResult.ok) return schemaResult;

    const templateResult = await this.templateRepo.load(templatePath);
    if (!templateResult.ok) return templateResult;

    // Build registry
    return await this.registryBuilder.build(
      commands,
      schemaResult.data,
      templateResult.data,
    );
  }
}
```

## 3. イベント駆動アーキテクチャ

```typescript
// Domain Events
export type TwoStageEvent =
  | {
    type: "TwoStageProcessingStarted";
    timestamp: Date;
    config: TwoStageConfig;
  }
  | { type: "Stage1Progress"; current: number; total: number }
  | { type: "Stage1Completed"; commands: Command[] }
  | { type: "Stage1Failed"; error: ProcessingError }
  | { type: "Stage2Started" }
  | { type: "Stage2Completed"; registry: Registry }
  | { type: "Stage2Failed"; error: ProcessingError }
  | { type: "TwoStageProcessingCompleted"; registry: Registry };

// Event Bus Interface
export interface EventBus {
  emit(event: TwoStageEvent): Promise<void>;
  subscribe(
    eventType: TwoStageEvent["type"],
    handler: (event: TwoStageEvent) => Promise<void>,
  ): void;
}
```

## 4. CLI統合

```typescript
export class TwoStageCLIAdapter {
  constructor(
    private readonly useCase: TwoStageProcessingUseCase,
    private readonly fileSystem: FileSystem,
  ) {}

  async execute(args: CLIArguments): Promise<Result<void, CLIError>> {
    // Parse and validate arguments
    const configResult = this.parseConfig(args);
    if (!configResult.ok) return configResult;

    // Load documents
    const documentsResult = await this.loadDocuments(
      configResult.data.documentsPath,
    );
    if (!documentsResult.ok) return documentsResult;

    // Execute two-stage processing
    const processingResult = await this.useCase.execute({
      ...configResult.data,
      documents: documentsResult.data,
    });

    if (!processingResult.ok) {
      return {
        ok: false,
        error: { kind: "ProcessingFailed", inner: processingResult.error },
      };
    }

    // Save output
    const saveResult = await this.fileSystem.writeFile(
      configResult.data.outputPath,
      JSON.stringify(processingResult.data, null, 2),
    );

    return saveResult;
  }

  private parseConfig(args: CLIArguments): Result<TwoStageConfig, CLIError> {
    // Validate mode flag
    if (args.mode !== "two-stage") {
      return {
        ok: false,
        error: { kind: "InvalidMode", mode: args.mode },
      };
    }

    // Validate required paths
    const requiredPaths = [
      "commandSchema",
      "commandTemplate",
      "registrySchema",
      "registryTemplate",
      "output",
    ];

    for (const path of requiredPaths) {
      if (!args[path]) {
        return {
          ok: false,
          error: { kind: "MissingArgument", argument: path },
        };
      }
    }

    return {
      ok: true,
      data: {
        documentsPath: args.documents,
        commandSchemaPath: args.commandSchema,
        commandTemplatePath: args.commandTemplate,
        registrySchemaPath: args.registrySchema,
        registryTemplatePath: args.registryTemplate,
        outputPath: args.output,
      },
    };
  }
}
```

## 5. エラーハンドリング（全域性）

```typescript
// Error Types (Discriminated Union)
export type ProcessingError =
  | { kind: "DocumentNotFound"; path: string }
  | { kind: "InvalidFrontMatter"; path: string; error: string }
  | { kind: "SchemaValidationFailed"; errors: ValidationError[] }
  | { kind: "TemplateApplicationFailed"; template: string; error: string }
  | { kind: "Stage1BatchError"; errors: ProcessingError[] }
  | { kind: "AggregationFailed"; reason: string }
  | { kind: "OutputWriteFailed"; path: string; error: string };

// Error Recovery Strategy
export class ErrorRecoveryService {
  async recover(
    error: ProcessingError,
  ): Promise<Result<RecoveryAction, FatalError>> {
    switch (error.kind) {
      case "DocumentNotFound":
        return {
          ok: true,
          data: { action: "Skip", reason: "Document not found" },
        };

      case "InvalidFrontMatter":
        return { ok: true, data: { action: "UseDefault", defaultValue: {} } };

      case "SchemaValidationFailed":
        if (error.errors.length === 1 && error.errors[0].field === "optional") {
          return { ok: true, data: { action: "IgnoreOptional" } };
        }
        return { ok: false, error: { kind: "Unrecoverable", inner: error } };

      case "Stage1BatchError":
        if (error.errors.length < 3) {
          return { ok: true, data: { action: "ContinueWithPartial" } };
        }
        return {
          ok: false,
          error: { kind: "TooManyErrors", count: error.errors.length },
        };

      default:
        return { ok: false, error: { kind: "UnknownError", error } };
    }
  }
}
```

## 6. テスト戦略

```typescript
// Unit Tests
describe("CommandProcessor", () => {
  it("should extract and process valid markdown", async () => {
    const processor = CommandProcessor.create(mockDependencies);
    const result = await processor.unwrap().process(
      validDocument,
      validSchema,
      validTemplate,
    );

    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      c1: "spec",
      c2: "analyze",
      c3: "quality-metrics",
    });
  });

  it("should handle invalid frontmatter gracefully", async () => {
    const processor = CommandProcessor.create(mockDependencies);
    const result = await processor.unwrap().process(
      invalidDocument,
      validSchema,
      validTemplate,
    );

    expect(result.ok).toBe(false);
    expect(result.error.kind).toBe("InvalidFrontMatter");
  });
});

// Integration Tests
describe("TwoStageProcessingUseCase", () => {
  it("should complete full two-stage pipeline", async () => {
    const useCase = TwoStageProcessingUseCase.create(realDependencies);
    const result = await useCase.unwrap().execute(testConfig);

    expect(result.ok).toBe(true);
    expect(result.data.availableConfigs).toContain("spec");
    expect(result.data.commands).toHaveLength(3);
  });
});

// E2E Tests
describe("CLI Two-Stage Mode", () => {
  it("should process climpt prompts to registry", async () => {
    const exitCode = await runCLI([
      "prompts/climpt",
      "--mode=two-stage",
      "--command-schema=schemas/command.json",
      "--command-template=templates/command.yaml",
      "--registry-schema=schemas/registry.json",
      "--registry-template=templates/registry.yaml",
      "--output=registry.json",
    ]);

    expect(exitCode).toBe(0);
    expect(await fileExists("registry.json")).toBe(true);
  });
});
```

## 7. 実装ロードマップ

### Phase 1: 基盤実装（Week 1）

- [ ] CommandProcessor集約ルートの実装
- [ ] RegistryBuilder集約ルートの実装
- [ ] Value Objectsの実装（Command, Registry）
- [ ] 基本的な単体テスト

### Phase 2: ユースケース実装（Week 2）

- [ ] TwoStageProcessingUseCaseの実装
- [ ] EventBusの実装
- [ ] ErrorRecoveryServiceの実装
- [ ] 統合テスト

### Phase 3: CLI統合（Week 3）

- [ ] TwoStageCLIAdapterの実装
- [ ] CLI引数パーサーの拡張
- [ ] E2Eテスト
- [ ] 後方互換性の確認

### Phase 4: ドキュメント（Week 4）

- [ ] アーキテクチャ図の作成
- [ ] 使用例の追加
- [ ] APIドキュメント
- [ ] マイグレーションガイド

## 8. 後方互換性

既存の単一段階処理はデフォルトとして維持：

```typescript
class CLIRouter {
  async route(args: CLIArguments): Promise<Result<void, CLIError>> {
    // Default to single-stage for backward compatibility
    const mode = args.mode || "single-stage";

    switch (mode) {
      case "single-stage":
        return await this.singleStageAdapter.execute(args);
      case "two-stage":
        return await this.twoStageAdapter.execute(args);
      default:
        return { ok: false, error: { kind: "UnknownMode", mode } };
    }
  }
}
```

## 9. パフォーマンス考慮事項

- Stage 1は並列処理可能（各ドキュメントは独立）
- 中間結果のキャッシュ機能（オプション）
- ストリーミング処理の検討（大量ドキュメント対応）

## 10. セキュリティ考慮事項

- Schema検証による入力検証
- テンプレートインジェクション対策
- ファイルパスのサニタイゼーション
