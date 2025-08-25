# ドメインアーキテクチャ設計書 - コアドメイン

## 設計原則

本設計は[全域性の原則](docs/development/totality.ja.md)に基づき、以下を実現します：

1. **全域性（Totality）**: すべての入力に対して定義された出力を保証
2. **型安全性**: Result型による明示的なエラーハンドリング
3. **不変性**: イミュータブルなデータ構造
4. **純粋性**: 副作用の分離

## 1. フロントマター抽出ドメイン

### 1.1 型定義

```typescript
// ========================================
// Value Objects
// ========================================

/** Markdownファイルパス - 不変値オブジェクト */
export class MarkdownFilePath {
  private constructor(private readonly value: string) {}

  static create(path: string): Result<MarkdownFilePath, PathError> {
    if (!path) {
      return {
        ok: false,
        error: { kind: "EmptyPath", message: "Path cannot be empty" },
      };
    }
    if (!path.endsWith(".md") && !path.endsWith(".markdown")) {
      return {
        ok: false,
        error: { kind: "InvalidExtension", message: "File must be markdown" },
      };
    }
    return { ok: true, data: new MarkdownFilePath(path) };
  }

  getValue(): string {
    return this.value;
  }
}

/** Markdownコンテンツ - 不変値オブジェクト */
export class MarkdownContent {
  private constructor(private readonly content: string) {}

  static create(content: string): Result<MarkdownContent, ContentError> {
    if (content === null || content === undefined) {
      return {
        ok: false,
        error: { kind: "NullContent", message: "Content cannot be null" },
      };
    }
    return { ok: true, data: new MarkdownContent(content) };
  }

  getValue(): string {
    return this.content;
  }

  hasFrontMatter(): boolean {
    return this.content.startsWith("---\n");
  }
}

/** フロントマターデータ - 不変値オブジェクト（成果B） */
export class FrontMatter {
  private constructor(
    private readonly rawYaml: string,
    private readonly parsed: Record<string, unknown>,
  ) {}

  static create(yaml: string): Result<FrontMatter, FrontMatterError> {
    if (!yaml || yaml.trim() === "") {
      return {
        ok: false,
        error: { kind: "EmptyFrontMatter", message: "FrontMatter is empty" },
      };
    }

    try {
      const parsed = parseYaml(yaml); // YAML解析関数
      if (typeof parsed !== "object" || parsed === null) {
        return {
          ok: false,
          error: { kind: "InvalidYaml", message: "YAML must be an object" },
        };
      }
      return {
        ok: true,
        data: new FrontMatter(yaml, parsed as Record<string, unknown>),
      };
    } catch (e) {
      return {
        ok: false,
        error: { kind: "ParseError", message: `YAML parse failed: ${e}` },
      };
    }
  }

  getRawYaml(): string {
    return this.rawYaml;
  }
  getParsed(): Readonly<Record<string, unknown>> {
    return this.parsed;
  }

  hasKey(key: string): boolean {
    return key in this.parsed;
  }

  getValue(key: string): unknown | undefined {
    return this.parsed[key];
  }
}

// ========================================
// Entities
// ========================================

/** Markdownドキュメントエンティティ */
export class MarkdownDocument {
  private constructor(
    private readonly id: DocumentId,
    private readonly path: MarkdownFilePath,
    private readonly content: MarkdownContent,
    private readonly frontMatter: FrontMatter | null,
    private readonly body: string,
  ) {}

  static create(
    path: MarkdownFilePath,
    content: MarkdownContent,
  ): Result<MarkdownDocument, DocumentError> {
    const extraction = extractFrontMatterAndBody(content.getValue());

    if (!extraction.ok) {
      return { ok: false, error: extraction.error };
    }

    const { frontMatterYaml, body } = extraction.data;

    let frontMatter: FrontMatter | null = null;
    if (frontMatterYaml) {
      const fmResult = FrontMatter.create(frontMatterYaml);
      if (!fmResult.ok) {
        return {
          ok: false,
          error: { kind: "FrontMatterError", message: fmResult.error.message },
        };
      }
      frontMatter = fmResult.data;
    }

    const id = DocumentId.generate(path.getValue());

    return {
      ok: true,
      data: new MarkdownDocument(id, path, content, frontMatter, body),
    };
  }

  getId(): DocumentId {
    return this.id;
  }
  getPath(): MarkdownFilePath {
    return this.path;
  }
  getFrontMatter(): FrontMatter | null {
    return this.frontMatter;
  }
  getBody(): string {
    return this.body;
  }

  hasFrontMatter(): boolean {
    return this.frontMatter !== null;
  }
}

// ========================================
// Domain Service
// ========================================

/** フロントマター抽出サービス - 純粋関数 */
export class FrontMatterExtractor {
  extract(document: MarkdownDocument): Result<FrontMatter, ExtractionError> {
    const frontMatter = document.getFrontMatter();

    if (!frontMatter) {
      return {
        ok: false,
        error: {
          kind: "NoFrontMatter",
          message:
            `Document ${document.getPath().getValue()} has no frontmatter`,
        },
      };
    }

    return { ok: true, data: frontMatter };
  }

  extractBatch(documents: MarkdownDocument[]): ExtractionResult[] {
    return documents.map((doc) => ({
      documentId: doc.getId(),
      path: doc.getPath(),
      result: this.extract(doc),
    }));
  }
}

// ========================================
// Repository Interface
// ========================================

export interface MarkdownDocumentRepository {
  findByPath(
    path: MarkdownFilePath,
  ): Promise<Result<MarkdownDocument, RepositoryError>>;
  findAll(
    directory: DirectoryPath,
  ): Promise<Result<MarkdownDocument[], RepositoryError>>;
  exists(path: MarkdownFilePath): Promise<boolean>;
}

// ========================================
// Domain Events
// ========================================

export class FrontMatterExtracted implements DomainEvent {
  constructor(
    public readonly documentId: DocumentId,
    public readonly documentPath: string,
    public readonly frontMatter: FrontMatter,
    public readonly extractedAt: Date = new Date(),
  ) {}

  getEventName(): string {
    return "FrontMatterExtracted";
  }
}

// ========================================
// Error Types
// ========================================

export type FrontMatterError =
  | { kind: "EmptyFrontMatter"; message: string }
  | { kind: "InvalidYaml"; message: string }
  | { kind: "ParseError"; message: string };

export type ExtractionError =
  | { kind: "NoFrontMatter"; message: string }
  | { kind: "ExtractionFailed"; message: string };

export type DocumentError =
  | { kind: "FrontMatterError"; message: string }
  | { kind: "InvalidDocument"; message: string };
```

## 2. TypeScript解析ドメイン

### 2.1 型定義

```typescript
// ========================================
// Value Objects
// ========================================

/** 解析結果のSchema - 不変値オブジェクト */
export class AnalysisSchema {
  private constructor(
    private readonly schema: object,
    private readonly version: string,
  ) {}

  static create(
    schema: unknown,
    version: string,
  ): Result<AnalysisSchema, SchemaError> {
    if (!schema || typeof schema !== "object") {
      return {
        ok: false,
        error: { kind: "InvalidSchema", message: "Schema must be an object" },
      };
    }

    if (!version || !isValidSemver(version)) {
      return {
        ok: false,
        error: { kind: "InvalidVersion", message: "Invalid schema version" },
      };
    }

    return { ok: true, data: new AnalysisSchema(schema as object, version) };
  }

  getSchema(): Readonly<object> {
    return this.schema;
  }
  getVersion(): string {
    return this.version;
  }

  validate(data: unknown): Result<void, ValidationError> {
    // JSON Schema検証ロジック
    return validateAgainstSchema(data, this.schema);
  }
}

/** プロンプト - 不変値オブジェクト */
export class Prompt {
  private constructor(
    private readonly template: string,
    private readonly variables: Map<string, string>,
  ) {}

  static create(template: string): Result<Prompt, PromptError> {
    if (!template || template.trim() === "") {
      return {
        ok: false,
        error: { kind: "EmptyPrompt", message: "Prompt cannot be empty" },
      };
    }

    const variables = extractVariables(template); // {{var}}形式の変数を抽出
    return { ok: true, data: new Prompt(template, variables) };
  }

  render(values: Record<string, string>): Result<string, RenderError> {
    let rendered = this.template;

    for (const [key, _] of this.variables) {
      if (!(key in values)) {
        return { ok: false, error: { kind: "MissingVariable", variable: key } };
      }
      rendered = rendered.replace(new RegExp(`{{${key}}}`, "g"), values[key]);
    }

    return { ok: true, data: rendered };
  }
}

/** 抽出された情報 - 不変値オブジェクト（成果C） */
export class ExtractedInfo {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly metadata: ExtractionMetadata,
  ) {}

  static create(
    rawData: unknown,
    metadata: ExtractionMetadata,
  ): Result<ExtractedInfo, ExtractionError> {
    if (!rawData || typeof rawData !== "object") {
      return {
        ok: false,
        error: {
          kind: "InvalidData",
          message: "Extracted data must be object",
        },
      };
    }

    return {
      ok: true,
      data: new ExtractedInfo(rawData as Record<string, unknown>, metadata),
    };
  }

  getData(): Readonly<Record<string, unknown>> {
    return this.data;
  }
  getMetadata(): ExtractionMetadata {
    return this.metadata;
  }
}

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
        error: { kind: "EmptyInput", message: "Template name cannot be empty" },
      };
    }

    if (!content || content.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Template content cannot be empty",
        },
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

/** 構造化データ - 不変値オブジェクト（成果D） */
export class StructuredData {
  private constructor(
    private readonly content: string, // 変換後テンプレート
    private readonly templateName: string,
    private readonly metadata: StructuringMetadata,
  ) {}

  static createFromAppliedTemplate(
    appliedContent: string,
    templateName: string,
    metadata: StructuringMetadata,
  ): Result<StructuredData, StructuringError> {
    if (!appliedContent || appliedContent.trim() === "") {
      return {
        ok: false,
        error: {
          kind: "EmptyContent",
          message: "Applied template content is empty",
        },
      };
    }

    return {
      ok: true,
      data: new StructuredData(appliedContent, templateName, metadata),
    };
  }

  getContent(): string {
    return this.content;
  }
  getTemplateName(): string {
    return this.templateName;
  }
  getMetadata(): StructuringMetadata {
    return this.metadata;
  }
}

// ========================================
// Aggregate Root
// ========================================

/** TypeScript解析オーケストレーター - 集約ルート */
export class TypeScriptAnalysisOrchestrator {
  constructor(
    private readonly schemaMapper: SchemaMapper,
    private readonly templateProcessor: TemplateProcessor
  ) {}

  /** 第1段階: 情報抽出（成果B → 成果C） */
  async extractInformation(
    frontMatter: FrontMatter,
    schema: AnalysisSchema,
  ): Promise<Result<ExtractedInfo, AnalysisError>> {
    // Schema展開とマッピング
    const mappingResult = await this.schemaMapper.mapFrontMatterToSchema(
      frontMatter.getParsed(),
      schema.getSchema()
    );

    if (!mappingResult.ok) {
      return {
        ok: false,
        error: {
          kind: "SchemaMappingError",
          message: mappingResult.error.message,
        },
      };
    }

    // 結果を成果Cとして生成
    const metadata: ExtractionMetadata = {
      extractedAt: new Date(),
      processingMethod: "TypeScript",
      schemaVersion: schema.getVersion(),
    };

    return ExtractedInfo.create(mappingResult.data, metadata);
  }

  /** 第2段階: テンプレート当て込み（成果C → 成果D） */
  async applyTemplate(
    extractedInfo: ExtractedInfo,
    schema: AnalysisSchema,
    template: Template,
  ): Promise<Result<StructuredData, AnalysisError>> {
    // TypeScriptでテンプレート処理
    const templateResult = await this.templateProcessor.process(
      extractedInfo.getData(),
      template.getContent(),
      schema.getSchema()
    );

    if (!templateResult.ok) {
      return {
        ok: false,
        error: {
          kind: "TemplateProcessingError",
          message: templateResult.error.message,
        },
      };
    }

    // AIが当て込んだテンプレート結果をそのまま成果Dとして使用
    const metadata: StructuringMetadata = {
      structuredAt: new Date(),
      promptUsed: "PromptB",
      templateName: template.getName(),
      appliedContent: analysisResult.data, // 変換後テンプレート
      sourceMetadata: extractedInfo.getMetadata(),
    };

    return StructuredData.createFromAppliedTemplate(
      analysisResult.data,
      template.getName(),
      metadata,
    );
  }

  /** 完全な2段階処理パイプライン */
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

    // 第2段階: テンプレート当て込み
    return this.applyTemplate(extractionResult.data, schema, template);
  }
}

// ========================================
// Domain Service Interface
// ========================================

/** AIプロバイダーインターフェース（反腐敗層） */
export interface SchemaMapper {
  mapFrontMatterToSchema(
    frontMatter: Record<string, unknown>,
    schema: object
  ): Promise<Result<Record<string, unknown>, MappingError>>;
}

export interface TemplateProcessor {
  process(
    data: Record<string, unknown>,
    template: string,
    schema: object
  ): Promise<Result<string, ProcessingError>>;
}

/** TypeScript Schemaマッパー実装 */
export class TypeScriptSchemaMapper implements SchemaMapper {
  async mapFrontMatterToSchema(
    frontMatter: Record<string, unknown>,
    schema: object
  ): Promise<Result<Record<string, unknown>, MappingError>> {
    // Schema展開とマッピングロジック
    // 詳細はdocs/architecture/schema_matching_architecture.ja.md参照
    return { ok: true, data: frontMatter };
  }
}

/** TypeScriptテンプレートプロセッサー実装 */
export class TypeScriptTemplateProcessor implements TemplateProcessor {
  async process(
    data: Record<string, unknown>,
    template: string,
    schema: object
  ): Promise<Result<string, ProcessingError>> {
    // テンプレート変数置換ロジック
    // {SchemaPath}形式の変数を置換
    return { ok: true, data: template };
  }
}

// ========================================
// Domain Events
// ========================================

export class InformationExtracted implements DomainEvent {
  constructor(
    public readonly documentId: DocumentId,
    public readonly extractedInfo: ExtractedInfo,
    public readonly extractedAt: Date = new Date(),
  ) {}

  getEventName(): string {
    return "InformationExtracted";
  }
}

export class DataStructured implements DomainEvent {
  constructor(
    public readonly documentId: DocumentId,
    public readonly structuredData: StructuredData,
    public readonly structuredAt: Date = new Date(),
  ) {}

  getEventName(): string {
    return "DataStructured";
  }
}

// ========================================
// Error Types
// ========================================

export type AnalysisError =
  | { kind: "PromptRenderError"; message: string }
  | { kind: "TypeScriptAnalysisError"; message: string }
  | { kind: "SchemaMappingError"; message: string }
  | { kind: "TemplateProcessingError"; message: string }
  | { kind: "ParseError"; message: string }
  | { kind: "SchemaValidationError"; message: string };
```

## 3. 共通型定義

### 3.1 Result型（全域性の基盤）

```typescript
// ========================================
// Result Type - 全域性の実現
// ========================================

export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; data: T } {
  return result.ok === true;
}

export function isError<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return result.ok === false;
}

export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => U,
): Result<U, E> {
  if (isOk(result)) {
    return { ok: true, data: fn(result.data) };
  }
  return result;
}

export function flatMapResult<T, U, E>(
  result: Result<T, E>,
  fn: (data: T) => Result<U, E>,
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.data);
  }
  return result;
}

// ========================================
// Domain Event Interface
// ========================================

export interface DomainEvent {
  getEventName(): string;
  occurredAt?: Date;
}

// ========================================
// Common Value Objects
// ========================================

export class DocumentId {
  private constructor(private readonly value: string) {}

  static generate(seed: string): DocumentId {
    const hash = createHash(seed + Date.now().toString());
    return new DocumentId(hash);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: DocumentId): boolean {
    return this.value === other.value;
  }
}

// ========================================
// Metadata Types
// ========================================

export interface ExtractionMetadata {
  extractedAt: Date;
  promptUsed: string;
  schemaVersion: string;
}

export interface StructuringMetadata {
  structuredAt: Date;
  promptUsed: string;
  templateName: string;
  appliedContent: string; // 変換後テンプレート内容
  sourceMetadata: ExtractionMetadata;
}
```
