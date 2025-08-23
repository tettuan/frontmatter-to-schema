# Domain実装パターン - Schema注入境界設計

## 1. Schema注入境界の実装

### 1.1 SchemaAdapter Interface（抽象境界）

```typescript
// ===============================================
// SchemaAdapter抽象インターフェース
// ===============================================
export interface SchemaAdapter {
  loadSchema(path: string): Promise<Result<unknown, DomainError>>;
  validateData(
    data: unknown,
    schema: unknown,
  ): Result<ValidationResult, DomainError>;
  getSchemaType(): string;
}

// ===============================================
// ValidationResult型
// ===============================================
export type ValidationResult = {
  readonly isValid: boolean;
  readonly errors: ReadonlyArray<ValidationIssue>;
  readonly normalizedData?: unknown;
};

export type ValidationIssue = {
  readonly path: string;
  readonly message: string;
  readonly code: string;
};
```

### 1.2 具体的なSchemaAdapter実装例

```typescript
// ===============================================
// Zod Schema Adapter
// ===============================================
export class ZodSchemaAdapter implements SchemaAdapter {
  async loadSchema(path: string): Promise<Result<unknown, DomainError>> {
    try {
      const module = await import(path);
      if (!module.schema) {
        return {
          ok: false,
          error: { kind: "SchemaNotFound", schemaId: path },
        };
      }
      return { ok: true, data: module.schema };
    } catch (error) {
      return {
        ok: false,
        error: { kind: "IOError", operation: "load", path },
      };
    }
  }

  validateData(
    data: unknown,
    schema: unknown,
  ): Result<ValidationResult, DomainError> {
    // Zodスキーマとして型チェック
    if (!this.isZodSchema(schema)) {
      return {
        ok: false,
        error: {
          kind: "ValidationFailed",
          field: "schema",
          reason: "Not a valid Zod schema",
        },
      };
    }

    const result = schema.safeParse(data);
    if (result.success) {
      return {
        ok: true,
        data: {
          isValid: true,
          errors: [],
          normalizedData: result.data,
        },
      };
    }

    return {
      ok: true,
      data: {
        isValid: false,
        errors: this.mapZodErrors(result.error),
        normalizedData: undefined,
      },
    };
  }

  private isZodSchema(schema: unknown): schema is ZodSchema {
    return schema && typeof schema === "object" && "safeParse" in schema;
  }

  private mapZodErrors(error: ZodError): ValidationIssue[] {
    return error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: issue.code,
    }));
  }

  getSchemaType(): string {
    return "zod";
  }
}

// ===============================================
// JSON Schema Adapter
// ===============================================
export class JSONSchemaAdapter implements SchemaAdapter {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
  }

  async loadSchema(path: string): Promise<Result<unknown, DomainError>> {
    try {
      const content = await Deno.readTextFile(path);
      const schema = JSON.parse(content);
      return { ok: true, data: schema };
    } catch (error) {
      return {
        ok: false,
        error: { kind: "ParseError", input: path, format: "json" },
      };
    }
  }

  validateData(
    data: unknown,
    schema: unknown,
  ): Result<ValidationResult, DomainError> {
    const validate = this.ajv.compile(schema);
    const isValid = validate(data);

    return {
      ok: true,
      data: {
        isValid,
        errors: this.mapAjvErrors(validate.errors || []),
        normalizedData: isValid ? data : undefined,
      },
    };
  }

  private mapAjvErrors(errors: ErrorObject[]): ValidationIssue[] {
    return errors.map((error) => ({
      path: error.instancePath,
      message: error.message || "Validation failed",
      code: error.keyword,
    }));
  }

  getSchemaType(): string {
    return "json-schema";
  }
}
```

## 2. Template注入境界の実装

### 2.1 TemplateAdapter Interface

```typescript
// ===============================================
// TemplateAdapter抽象インターフェース
// ===============================================
export interface TemplateAdapter {
  loadTemplate(path: string): Promise<Result<unknown, DomainError>>;
  renderTemplate(template: unknown, data: unknown): Result<string, DomainError>;
  getTemplateType(): string;
}
```

### 2.2 具体的なTemplateAdapter実装

```typescript
// ===============================================
// Handlebars Template Adapter
// ===============================================
export class HandlebarsTemplateAdapter implements TemplateAdapter {
  async loadTemplate(path: string): Promise<Result<unknown, DomainError>> {
    try {
      const content = await Deno.readTextFile(path);
      const template = Handlebars.compile(content);
      return { ok: true, data: template };
    } catch (error) {
      return {
        ok: false,
        error: { kind: "IOError", operation: "load", path },
      };
    }
  }

  renderTemplate(
    template: unknown,
    data: unknown,
  ): Result<string, DomainError> {
    if (!this.isHandlebarsTemplate(template)) {
      return {
        ok: false,
        error: {
          kind: "ValidationFailed",
          field: "template",
          reason: "Not a Handlebars template",
        },
      };
    }

    try {
      const rendered = template(data);
      return { ok: true, data: rendered };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ProcessingFailed",
          step: "render",
          detail: error.message,
        },
      };
    }
  }

  private isHandlebarsTemplate(
    template: unknown,
  ): template is HandlebarsTemplateDelegate {
    return typeof template === "function";
  }

  getTemplateType(): string {
    return "handlebars";
  }
}

// ===============================================
// Simple Template Adapter（{{placeholder}}形式）
// ===============================================
export class SimpleTemplateAdapter implements TemplateAdapter {
  async loadTemplate(path: string): Promise<Result<unknown, DomainError>> {
    try {
      const content = await Deno.readTextFile(path);
      return { ok: true, data: content };
    } catch (error) {
      return {
        ok: false,
        error: { kind: "IOError", operation: "load", path },
      };
    }
  }

  renderTemplate(
    template: unknown,
    data: unknown,
  ): Result<string, DomainError> {
    if (typeof template !== "string") {
      return {
        ok: false,
        error: {
          kind: "ValidationFailed",
          field: "template",
          reason: "Template must be a string",
        },
      };
    }

    const dataResult = this.validateDataAsRecord(data);
    if (!dataResult.ok) {
      return dataResult;
    }

    let rendered = template;
    const placeholderRegex = /\{\{([^}]+)\}\}/g;

    rendered = rendered.replace(placeholderRegex, (match, key) => {
      const trimmedKey = key.trim();
      const value = dataResult.data[trimmedKey];
      return value !== undefined ? String(value) : match;
    });

    return { ok: true, data: rendered };
  }

  private validateDataAsRecord(
    data: unknown,
  ): Result<Record<string, unknown>, DomainError> {
    if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      return { ok: true, data: data as Record<string, unknown> };
    }
    return {
      ok: false,
      error: {
        kind: "ValidationFailed",
        field: "data",
        reason: "Data must be an object",
      },
    };
  }

  getTemplateType(): string {
    return "simple";
  }
}
```

## 3. Dependency Injection Container

### 3.1 DIコンテナ実装

```typescript
// ===============================================
// AdapterRegistry（アダプタ管理）
// ===============================================
export class AdapterRegistry {
  private schemaAdapters = new Map<string, SchemaAdapter>();
  private templateAdapters = new Map<string, TemplateAdapter>();

  registerSchemaAdapter(type: string, adapter: SchemaAdapter): void {
    this.schemaAdapters.set(type, adapter);
  }

  registerTemplateAdapter(type: string, adapter: TemplateAdapter): void {
    this.templateAdapters.set(type, adapter);
  }

  getSchemaAdapter(type: string): Result<SchemaAdapter, DomainError> {
    const adapter = this.schemaAdapters.get(type);
    if (!adapter) {
      return {
        ok: false,
        error: { kind: "SchemaNotFound", schemaId: type },
      };
    }
    return { ok: true, data: adapter };
  }

  getTemplateAdapter(type: string): Result<TemplateAdapter, DomainError> {
    const adapter = this.templateAdapters.get(type);
    if (!adapter) {
      return {
        ok: false,
        error: { kind: "TemplateNotFound", templateId: type },
      };
    }
    return { ok: true, data: adapter };
  }
}

// ===============================================
// ProcessingEngine（処理エンジン）
// ===============================================
export class ProcessingEngine {
  constructor(
    private readonly registry: AdapterRegistry,
  ) {}

  async process(
    config: PipelineConfig,
  ): Promise<Result<PipelineResult, DomainError>> {
    // Schemaアダプタ取得
    const schemaType = this.detectSchemaType(config.getSchemaContext());
    const schemaAdapterResult = this.registry.getSchemaAdapter(schemaType);
    if (!schemaAdapterResult.ok) {
      return schemaAdapterResult;
    }

    // Templateアダプタ取得
    const templateType = this.detectTemplateType(config.getTemplateContext());
    const templateAdapterResult = this.registry.getTemplateAdapter(
      templateType,
    );
    if (!templateAdapterResult.ok) {
      return templateAdapterResult;
    }

    // 処理実行
    return this.executeProcessing(
      config,
      schemaAdapterResult.data,
      templateAdapterResult.data,
    );
  }

  private detectSchemaType(context: SchemaContext): string {
    // 実装: コンテキストからスキーマタイプを判定
    return "zod"; // 例
  }

  private detectTemplateType(context: TemplateContext): string {
    // 実装: コンテキストからテンプレートタイプを判定
    return context.getFormat().getValue();
  }

  private async executeProcessing(
    config: PipelineConfig,
    schemaAdapter: SchemaAdapter,
    templateAdapter: TemplateAdapter,
  ): Promise<Result<PipelineResult, DomainError>> {
    // 実際の処理ロジック
    const startTime = Date.now();
    let processed = 0;
    let successful = 0;
    let failed = 0;
    const errors: ProcessingError[] = [];

    // ファイル処理ループ
    const files = await this.discoverFiles(config.getInputPattern());

    for (const file of files) {
      processed++;

      // データ抽出
      const dataResult = await this.extractData(file);
      if (!dataResult.ok) {
        failed++;
        errors.push({
          document: file,
          stage: "Extraction",
          error: dataResult.error,
          timestamp: new Date(),
        });
        continue;
      }

      // バリデーション
      const validationResult = schemaAdapter.validateData(
        dataResult.data,
        config.getSchemaContext().getSchema(),
      );
      if (!validationResult.ok || !validationResult.data.isValid) {
        failed++;
        errors.push({
          document: file,
          stage: "Validation",
          error: {
            kind: "ValidationFailed",
            field: "data",
            reason: "Schema validation failed",
          },
          timestamp: new Date(),
        });
        continue;
      }

      // テンプレート適用
      const renderResult = templateAdapter.renderTemplate(
        config.getTemplateContext().getTemplate(),
        validationResult.data.normalizedData,
      );
      if (!renderResult.ok) {
        failed++;
        errors.push({
          document: file,
          stage: "Mapping",
          error: renderResult.error,
          timestamp: new Date(),
        });
        continue;
      }

      // 出力
      const outputResult = await this.writeOutput(
        config.getOutputPath(),
        renderResult.data,
      );
      if (!outputResult.ok) {
        failed++;
        errors.push({
          document: file,
          stage: "Output",
          error: outputResult.error,
          timestamp: new Date(),
        });
        continue;
      }

      successful++;
    }

    const executionTime = Date.now() - startTime;
    return PipelineResult.create(
      processed,
      successful,
      failed,
      config.getOutputPath(),
      executionTime,
      errors,
    );
  }

  private async discoverFiles(pattern: string): Promise<string[]> {
    // グロブパターンでファイル検索
    return [];
  }

  private async extractData(
    file: string,
  ): Promise<Result<unknown, DomainError>> {
    // ファイルからデータ抽出
    return { ok: true, data: {} };
  }

  private async writeOutput(
    path: string,
    content: string,
  ): Promise<Result<void, DomainError>> {
    // ファイル出力
    return { ok: true, data: undefined };
  }
}
```

## 4. 初期化とBootstrap

```typescript
// ===============================================
// Application Bootstrap
// ===============================================
export class ApplicationBootstrap {
  static createDefaultRegistry(): AdapterRegistry {
    const registry = new AdapterRegistry();

    // デフォルトアダプタ登録
    registry.registerSchemaAdapter("zod", new ZodSchemaAdapter());
    registry.registerSchemaAdapter("json-schema", new JSONSchemaAdapter());

    registry.registerTemplateAdapter(
      "handlebars",
      new HandlebarsTemplateAdapter(),
    );
    registry.registerTemplateAdapter("simple", new SimpleTemplateAdapter());
    registry.registerTemplateAdapter("json", new SimpleTemplateAdapter());
    registry.registerTemplateAdapter("yaml", new SimpleTemplateAdapter());

    return registry;
  }

  static async createEngine(): Promise<ProcessingEngine> {
    const registry = this.createDefaultRegistry();
    return new ProcessingEngine(registry);
  }
}

// ===============================================
// 使用例
// ===============================================
async function main(): Promise<void> {
  const engine = await ApplicationBootstrap.createEngine();

  // Schema読み込み
  const schemaResult = await SchemaContext.create(
    "user-schema",
    await loadZodSchema("./schemas/user.ts"),
  );
  if (!schemaResult.ok) {
    console.error(schemaResult.error);
    return;
  }

  // Template読み込み
  const templateResult = await TemplateContext.create(
    "user-template",
    "User: {{name}}, Email: {{email}}",
    "simple",
  );
  if (!templateResult.ok) {
    console.error(templateResult.error);
    return;
  }

  // Pipeline設定
  const configResult = PipelineConfig.create(
    schemaResult.data,
    templateResult.data,
    "./data/*.json",
    "./output/users.txt",
  );
  if (!configResult.ok) {
    console.error(configResult.error);
    return;
  }

  // 処理実行
  const result = await engine.process(configResult.data);
  if (!result.ok) {
    console.error(result.error);
    return;
  }

  console.log(
    `処理完了: ${result.data.getSuccessCount()}/${result.data.getProcessedCount()} 成功`,
  );
}
```

## 5. 設計の特徴

1. **完全な依存性注入**: SchemaとTemplateの具体実装をコアドメインから分離
2. **アダプタパターン**: 異なるSchema/Template形式を統一インターフェースで扱う
3. **Result型の徹底**: すべての操作がResult型を返し、エラーを値として扱う
4. **不変性**: すべてのデータ構造は不変
5. **拡張性**: 新しいSchema/Template形式の追加が容易

この設計により、コアドメインロジックを変更することなく、新しいSchema形式やTemplate形式を追加できる。
