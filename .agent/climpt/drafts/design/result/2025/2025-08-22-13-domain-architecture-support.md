# ドメインアーキテクチャ設計書 - サポートドメイン

## 1. Schema管理ドメイン

### 1.1 型定義

```typescript
// ========================================
// Value Objects
// ========================================

/** Schemaパス - 不変値オブジェクト */
export class SchemaPath {
  private constructor(private readonly path: string) {}
  
  static create(path: string): Result<SchemaPath, PathError> {
    if (!path) {
      return { ok: false, error: { kind: "EmptyPath", message: "Schema path cannot be empty" } };
    }
    
    if (!path.endsWith('.json') && !path.endsWith('.yaml') && !path.endsWith('.yml')) {
      return {
        ok: false,
        error: { kind: "InvalidExtension", message: "Schema must be JSON or YAML" }
      };
    }
    
    return { ok: true, data: new SchemaPath(path) };
  }
  
  getValue(): string { return this.path; }
  
  getExtension(): "json" | "yaml" {
    return this.path.endsWith('.json') ? "json" : "yaml";
  }
}

/** Schema定義 - 不変値オブジェクト */
export class SchemaDefinition {
  private constructor(
    private readonly definition: object,
    private readonly metadata: SchemaMetadata
  ) {}
  
  static create(
    definition: unknown,
    metadata: SchemaMetadata
  ): Result<SchemaDefinition, SchemaError> {
    if (!definition || typeof definition !== 'object') {
      return { ok: false, error: { kind: "InvalidDefinition", message: "Schema must be object" } };
    }
    
    // JSON Schema検証
    if (!isValidJsonSchema(definition)) {
      return { ok: false, error: { kind: "InvalidSchema", message: "Invalid JSON Schema" } };
    }
    
    return { ok: true, data: new SchemaDefinition(definition as object, metadata) };
  }
  
  getDefinition(): Readonly<object> { return this.definition; }
  getMetadata(): SchemaMetadata { return this.metadata; }
  
  validate(data: unknown): ValidationResult {
    return performJsonSchemaValidation(data, this.definition);
  }
}

// ========================================
// Entities
// ========================================

/** Schema エンティティ */
export class Schema {
  private constructor(
    private readonly id: SchemaId,
    private readonly name: string,
    private readonly version: SchemaVersion,
    private readonly definition: SchemaDefinition,
    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {}
  
  static create(
    name: string,
    version: string,
    definition: SchemaDefinition
  ): Result<Schema, SchemaError> {
    const versionResult = SchemaVersion.create(version);
    if (!versionResult.ok) {
      return { ok: false, error: versionResult.error };
    }
    
    const id = SchemaId.generate(name, version);
    const now = new Date();
    
    return {
      ok: true,
      data: new Schema(id, name, versionResult.data, definition, now, now)
    };
  }
  
  getId(): SchemaId { return this.id; }
  getName(): string { return this.name; }
  getVersion(): SchemaVersion { return this.version; }
  getDefinition(): SchemaDefinition { return this.definition; }
  
  isCompatibleWith(version: SchemaVersion): boolean {
    return this.version.isCompatibleWith(version);
  }
  
  validate(data: unknown): ValidationResult {
    return this.definition.validate(data);
  }
}

/** Schema Version - 不変値オブジェクト */
export class SchemaVersion {
  private constructor(
    private readonly major: number,
    private readonly minor: number,
    private readonly patch: number
  ) {}
  
  static create(version: string): Result<SchemaVersion, VersionError> {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      return { ok: false, error: { kind: "InvalidFormat", message: "Version must be X.Y.Z" } };
    }
    
    const [_, major, minor, patch] = match;
    return {
      ok: true,
      data: new SchemaVersion(parseInt(major), parseInt(minor), parseInt(patch))
    };
  }
  
  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
  
  isCompatibleWith(other: SchemaVersion): boolean {
    // 同じメジャーバージョンなら互換性あり
    return this.major === other.major;
  }
}

// ========================================
// Repository
// ========================================

/** Schema リポジトリ */
export class SchemaRepository {
  constructor(private readonly fileSystem: FileSystem) {}
  
  async load(path: SchemaPath): Promise<Result<Schema, RepositoryError>> {
    // ファイル読み込み
    const contentResult = await this.fileSystem.readFile(path.getValue());
    if (!contentResult.ok) {
      return { ok: false, error: { kind: "LoadError", message: contentResult.error.message } };
    }
    
    // パース
    let parsed: unknown;
    try {
      if (path.getExtension() === "json") {
        parsed = JSON.parse(contentResult.data);
      } else {
        parsed = parseYaml(contentResult.data);
      }
    } catch (e) {
      return { ok: false, error: { kind: "ParseError", message: `Failed to parse: ${e}` } };
    }
    
    // メタデータ抽出
    const metadata = extractSchemaMetadata(parsed);
    
    // SchemaDefinition作成
    const definitionResult = SchemaDefinition.create(parsed, metadata);
    if (!definitionResult.ok) {
      return { ok: false, error: { kind: "InvalidSchema", message: definitionResult.error.message } };
    }
    
    // Schema作成
    return Schema.create(metadata.name, metadata.version, definitionResult.data);
  }
  
  async save(schema: Schema, path: SchemaPath): Promise<Result<void, RepositoryError>> {
    const content = JSON.stringify(schema.getDefinition().getDefinition(), null, 2);
    return this.fileSystem.writeFile(path.getValue(), content);
  }
  
  async exists(path: SchemaPath): Promise<boolean> {
    return this.fileSystem.exists(path.getValue());
  }
}

// ========================================
// Domain Service
// ========================================

/** Schema検証サービス */
export class SchemaValidator {
  validate(data: unknown, schema: Schema): ValidationResult {
    return schema.validate(data);
  }
  
  validateBatch(dataList: unknown[], schema: Schema): ValidationResult[] {
    return dataList.map(data => this.validate(data, schema));
  }
}

// ========================================
// Domain Events
// ========================================

export class SchemaLoaded implements DomainEvent {
  constructor(
    public readonly schemaId: SchemaId,
    public readonly schemaName: string,
    public readonly version: string,
    public readonly loadedAt: Date = new Date()
  ) {}
  
  getEventName(): string { return "SchemaLoaded"; }
}

export class SchemaValidationFailed implements DomainEvent {
  constructor(
    public readonly schemaId: SchemaId,
    public readonly errors: ValidationError[],
    public readonly failedAt: Date = new Date()
  ) {}
  
  getEventName(): string { return "SchemaValidationFailed"; }
}
```

## 2. テンプレート管理ドメイン

### 2.1 型定義

```typescript
// ========================================
// Value Objects
// ========================================

/** テンプレートパス - 不変値オブジェクト */
export class TemplatePath {
  private constructor(private readonly path: string) {}
  
  static create(path: string): Result<TemplatePath, PathError> {
    if (!path) {
      return { ok: false, error: { kind: "EmptyPath", message: "Template path cannot be empty" } };
    }
    
    return { ok: true, data: new TemplatePath(path) };
  }
  
  getValue(): string { return this.path; }
  
  getExtension(): string {
    const parts = this.path.split('.');
    return parts[parts.length - 1] || '';
  }
}

/** テンプレート形式 - 不変値オブジェクト */
export class TemplateFormat {
  private constructor(
    private readonly format: "json" | "yaml" | "handlebars" | "custom",
    private readonly mimeType: string
  ) {}
  
  static create(format: string): Result<TemplateFormat, FormatError> {
    const formatMap: Record<string, string> = {
      "json": "application/json",
      "yaml": "application/yaml",
      "yml": "application/yaml",
      "hbs": "text/x-handlebars-template",
      "handlebars": "text/x-handlebars-template"
    };
    
    const normalized = format.toLowerCase();
    const mimeType = formatMap[normalized];
    
    if (!mimeType) {
      // カスタム形式として扱う
      return { ok: true, data: new TemplateFormat("custom", "text/plain") };
    }
    
    const formatType = normalized === "yml" ? "yaml" : 
                      normalized === "hbs" ? "handlebars" : 
                      normalized as any;
    
    return { ok: true, data: new TemplateFormat(formatType, mimeType) };
  }
  
  getFormat(): string { return this.format; }
  getMimeType(): string { return this.mimeType; }
  
  isStructured(): boolean {
    return this.format === "json" || this.format === "yaml";
  }
}

/** テンプレートコンテンツ - 不変値オブジェクト */
export class TemplateContent {
  private constructor(
    private readonly content: string,
    private readonly variables: Set<string>
  ) {}
  
  static create(content: string): Result<TemplateContent, ContentError> {
    if (!content) {
      return { ok: false, error: { kind: "EmptyContent", message: "Template cannot be empty" } };
    }
    
    const variables = extractTemplateVariables(content);
    return { ok: true, data: new TemplateContent(content, variables) };
  }
  
  getContent(): string { return this.content; }
  getVariables(): Set<string> { return new Set(this.variables); }
  
  hasVariable(name: string): boolean {
    return this.variables.has(name);
  }
}

// ========================================
// Entities
// ========================================

/** 解析テンプレート エンティティ */
export class AnalysisTemplate {
  private constructor(
    private readonly id: TemplateId,
    private readonly name: string,
    private readonly format: TemplateFormat,
    private readonly content: TemplateContent,
    private readonly metadata: TemplateMetadata,
    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {}
  
  static create(
    name: string,
    format: TemplateFormat,
    content: TemplateContent,
    metadata: TemplateMetadata
  ): Result<AnalysisTemplate, TemplateError> {
    const id = TemplateId.generate(name);
    const now = new Date();
    
    return {
      ok: true,
      data: new AnalysisTemplate(id, name, format, content, metadata, now, now)
    };
  }
  
  getId(): TemplateId { return this.id; }
  getName(): string { return this.name; }
  getFormat(): TemplateFormat { return this.format; }
  getContent(): string { return this.content.getContent(); }
  getMetadata(): TemplateMetadata { return this.metadata; }
  
  apply(data: Record<string, unknown>): Result<string, ApplicationError> {
    let result = this.content.getContent();
    
    // 変数置換
    for (const variable of this.content.getVariables()) {
      const value = data[variable];
      if (value === undefined) {
        return { ok: false, error: { kind: "MissingVariable", variable } };
      }
      
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      result = result.replace(new RegExp(`{{${variable}}}`, 'g'), stringValue);
    }
    
    return { ok: true, data: result };
  }
}

// ========================================
// Repository
// ========================================

/** テンプレート リポジトリ */
export class TemplateRepository {
  constructor(private readonly fileSystem: FileSystem) {}
  
  async load(path: TemplatePath): Promise<Result<AnalysisTemplate, RepositoryError>> {
    // ファイル読み込み
    const contentResult = await this.fileSystem.readFile(path.getValue());
    if (!contentResult.ok) {
      return { ok: false, error: { kind: "LoadError", message: contentResult.error.message } };
    }
    
    // 形式判定
    const extension = path.getExtension();
    const formatResult = TemplateFormat.create(extension);
    if (!formatResult.ok) {
      return { ok: false, error: { kind: "InvalidFormat", message: formatResult.error.message } };
    }
    
    // コンテンツ作成
    const templateContentResult = TemplateContent.create(contentResult.data);
    if (!templateContentResult.ok) {
      return { ok: false, error: { kind: "InvalidContent", message: templateContentResult.error.message } };
    }
    
    // メタデータ
    const metadata: TemplateMetadata = {
      path: path.getValue(),
      format: formatResult.data.getFormat(),
      size: contentResult.data.length
    };
    
    // テンプレート作成
    const name = extractFileName(path.getValue());
    return AnalysisTemplate.create(name, formatResult.data, templateContentResult.data, metadata);
  }
  
  async save(template: AnalysisTemplate, path: TemplatePath): Promise<Result<void, RepositoryError>> {
    return this.fileSystem.writeFile(path.getValue(), template.getContent());
  }
  
  async exists(path: TemplatePath): Promise<boolean> {
    return this.fileSystem.exists(path.getValue());
  }
}

// ========================================
// Domain Service
// ========================================

/** テンプレート適用サービス */
export class TemplateProcessor {
  process(
    data: StructuredData,
    template: AnalysisTemplate
  ): Result<string, ProcessingError> {
    return template.apply(data.getData());
  }
  
  processBatch(
    dataList: StructuredData[],
    template: AnalysisTemplate
  ): Result<string[], ProcessingError> {
    const results: string[] = [];
    
    for (const data of dataList) {
      const result = this.process(data, template);
      if (!result.ok) {
        return result;
      }
      results.push(result.data);
    }
    
    return { ok: true, data: results };
  }
}

// ========================================
// Domain Events
// ========================================

export class TemplateLoaded implements DomainEvent {
  constructor(
    public readonly templateId: TemplateId,
    public readonly templateName: string,
    public readonly format: string,
    public readonly loadedAt: Date = new Date()
  ) {}
  
  getEventName(): string { return "TemplateLoaded"; }
}

export class TemplateApplied implements DomainEvent {
  constructor(
    public readonly templateId: TemplateId,
    public readonly dataId: string,
    public readonly appliedAt: Date = new Date()
  ) {}
  
  getEventName(): string { return "TemplateApplied"; }
}
```

## 3. 結果統合ドメイン

### 3.1 型定義

```typescript
// ========================================
// Value Objects
// ========================================

/** 出力パス - 不変値オブジェクト */
export class OutputPath {
  private constructor(private readonly path: string) {}
  
  static create(path: string): Result<OutputPath, PathError> {
    if (!path) {
      return { ok: false, error: { kind: "EmptyPath", message: "Output path cannot be empty" } };
    }
    
    return { ok: true, data: new OutputPath(path) };
  }
  
  getValue(): string { return this.path; }
  
  getDirectory(): string {
    const parts = this.path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }
  
  getFileName(): string {
    const parts = this.path.split('/');
    return parts[parts.length - 1] || '';
  }
}

/** 統合メタデータ - 不変値オブジェクト */
export class IntegrationMetadata {
  private constructor(
    private readonly totalDocuments: number,
    private readonly processedDocuments: number,
    private readonly failedDocuments: number,
    private readonly startedAt: Date,
    private readonly completedAt: Date | null
  ) {}
  
  static create(totalDocuments: number): IntegrationMetadata {
    return new IntegrationMetadata(totalDocuments, 0, 0, new Date(), null);
  }
  
  incrementProcessed(): IntegrationMetadata {
    return new IntegrationMetadata(
      this.totalDocuments,
      this.processedDocuments + 1,
      this.failedDocuments,
      this.startedAt,
      this.completedAt
    );
  }
  
  incrementFailed(): IntegrationMetadata {
    return new IntegrationMetadata(
      this.totalDocuments,
      this.processedDocuments,
      this.failedDocuments + 1,
      this.startedAt,
      this.completedAt
    );
  }
  
  complete(): IntegrationMetadata {
    return new IntegrationMetadata(
      this.totalDocuments,
      this.processedDocuments,
      this.failedDocuments,
      this.startedAt,
      new Date()
    );
  }
  
  getStats(): IntegrationStats {
    return {
      total: this.totalDocuments,
      processed: this.processedDocuments,
      failed: this.failedDocuments,
      success: this.processedDocuments - this.failedDocuments,
      successRate: this.totalDocuments > 0 
        ? (this.processedDocuments - this.failedDocuments) / this.totalDocuments 
        : 0,
      duration: this.completedAt 
        ? this.completedAt.getTime() - this.startedAt.getTime() 
        : null
    };
  }
}

// ========================================
// Entities
// ========================================

/** 最終成果物Z - エンティティ */
export class FinalResult {
  private constructor(
    private readonly id: ResultId,
    private readonly results: Map<DocumentId, StructuredData>,
    private readonly metadata: IntegrationMetadata,
    private readonly format: OutputFormat
  ) {}
  
  static initialize(totalDocuments: number, format: OutputFormat): FinalResult {
    const id = ResultId.generate();
    const metadata = IntegrationMetadata.create(totalDocuments);
    return new FinalResult(id, new Map(), metadata, format);
  }
  
  integrate(documentId: DocumentId, data: StructuredData): FinalResult {
    const newResults = new Map(this.results);
    newResults.set(documentId, data);
    
    const newMetadata = this.metadata.incrementProcessed();
    
    return new FinalResult(this.id, newResults, newMetadata, this.format);
  }
  
  recordFailure(documentId: DocumentId): FinalResult {
    const newMetadata = this.metadata.incrementFailed();
    return new FinalResult(this.id, this.results, newMetadata, this.format);
  }
  
  complete(): FinalResult {
    const newMetadata = this.metadata.complete();
    return new FinalResult(this.id, this.results, newMetadata, this.format);
  }
  
  getId(): ResultId { return this.id; }
  getResults(): ReadonlyMap<DocumentId, StructuredData> { return this.results; }
  getMetadata(): IntegrationMetadata { return this.metadata; }
  getFormat(): OutputFormat { return this.format; }
  
  toOutput(): Result<string, SerializationError> {
    const data = Array.from(this.results.values()).map(sd => sd.getData());
    
    try {
      switch (this.format) {
        case "json":
          return { ok: true, data: JSON.stringify(data, null, 2) };
        case "yaml":
          return { ok: true, data: stringifyYaml(data) };
        default:
          return { ok: false, error: { kind: "UnsupportedFormat", format: this.format } };
      }
    } catch (e) {
      return { ok: false, error: { kind: "SerializationFailed", message: `${e}` } };
    }
  }
}

// ========================================
// Aggregate Root
// ========================================

/** 結果統合オーケストレーター - 集約ルート */
export class ResultAggregator {
  private currentResult: FinalResult | null = null;
  
  initialize(totalDocuments: number, format: OutputFormat = "json"): FinalResult {
    this.currentResult = FinalResult.initialize(totalDocuments, format);
    return this.currentResult;
  }
  
  integrate(documentId: DocumentId, data: StructuredData): Result<FinalResult, IntegrationError> {
    if (!this.currentResult) {
      return { ok: false, error: { kind: "NotInitialized", message: "Aggregator not initialized" } };
    }
    
    this.currentResult = this.currentResult.integrate(documentId, data);
    return { ok: true, data: this.currentResult };
  }
  
  recordFailure(documentId: DocumentId): Result<FinalResult, IntegrationError> {
    if (!this.currentResult) {
      return { ok: false, error: { kind: "NotInitialized", message: "Aggregator not initialized" } };
    }
    
    this.currentResult = this.currentResult.recordFailure(documentId);
    return { ok: true, data: this.currentResult };
  }
  
  finalize(): Result<FinalResult, IntegrationError> {
    if (!this.currentResult) {
      return { ok: false, error: { kind: "NotInitialized", message: "Aggregator not initialized" } };
    }
    
    this.currentResult = this.currentResult.complete();
    return { ok: true, data: this.currentResult };
  }
  
  async save(path: OutputPath, fileSystem: FileSystem): Promise<Result<void, SaveError>> {
    if (!this.currentResult) {
      return { ok: false, error: { kind: "NotInitialized", message: "No result to save" } };
    }
    
    const outputResult = this.currentResult.toOutput();
    if (!outputResult.ok) {
      return { ok: false, error: { kind: "SerializationError", message: outputResult.error.message } };
    }
    
    return fileSystem.writeFile(path.getValue(), outputResult.data);
  }
  
  getStats(): IntegrationStats | null {
    return this.currentResult?.getMetadata().getStats() || null;
  }
}

// ========================================
// Domain Events
// ========================================

export class ResultIntegrated implements DomainEvent {
  constructor(
    public readonly resultId: ResultId,
    public readonly documentId: DocumentId,
    public readonly integratedAt: Date = new Date()
  ) {}
  
  getEventName(): string { return "ResultIntegrated"; }
}

export class ResultFinalized implements DomainEvent {
  constructor(
    public readonly resultId: ResultId,
    public readonly stats: IntegrationStats,
    public readonly finalizedAt: Date = new Date()
  ) {}
  
  getEventName(): string { return "ResultFinalized"; }
}

export class ResultSaved implements DomainEvent {
  constructor(
    public readonly resultId: ResultId,
    public readonly outputPath: string,
    public readonly savedAt: Date = new Date()
  ) {}
  
  getEventName(): string { return "ResultSaved"; }
}

// ========================================
// Types
// ========================================

export type OutputFormat = "json" | "yaml";

export interface IntegrationStats {
  total: number;
  processed: number;
  failed: number;
  success: number;
  successRate: number;
  duration: number | null;
}

export interface TemplateMetadata {
  path: string;
  format: string;
  size: number;
}

export interface SchemaMetadata {
  name: string;
  version: string;
  description?: string;
}
```