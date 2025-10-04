# ドメインアーキテクチャ設計 - Frontmatterドメイン

## 概要

本書は、Markdownファイルからのフロントマター抽出・解析・検証を担うFrontmatterドメインのアーキテクチャを定義する。

## Frontmatterドメインモデル

### 1. 値オブジェクト

```typescript
import { Result, ValidationError } from "../shared/types";

/**
 * Markdownファイルパス
 */
export class MarkdownFilePath {
  private constructor(private readonly value: string) {}

  static create(path: string): Result<MarkdownFilePath, MarkdownPathError> {
    if (!path || path.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyPath", message: "Markdown path cannot be empty" },
      };
    }

    // Markdown拡張子チェック
    const validExtensions = [".md", ".markdown", ".mdown", ".mkd"];
    const hasValidExt = validExtensions.some((ext) =>
      path.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      return {
        ok: false,
        error: {
          kind: "InvalidExtension",
          path,
          validExtensions,
          message: `File must be markdown, got: ${path}`,
        },
      };
    }

    return { ok: true, data: new MarkdownFilePath(path) };
  }

  toString(): string {
    return this.value;
  }

  getFileName(): string {
    const parts = this.value.split("/");
    return parts[parts.length - 1];
  }

  getRelativePath(basePath: string): string {
    if (this.value.startsWith(basePath)) {
      return this.value.substring(basePath.length).replace(/^\//, "");
    }
    return this.value;
  }
}

/**
 * フロントマター形式
 */
export type FrontmatterFormat = "yaml" | "toml" | "json";

/**
 * フロントマター区切り文字パターン
 */
export class FrontmatterDelimiter {
  private constructor(
    private readonly format: FrontmatterFormat,
    private readonly startDelimiter: string,
    private readonly endDelimiter: string,
  ) {}

  static readonly YAML = new FrontmatterDelimiter("yaml", "---", "---");
  static readonly TOML = new FrontmatterDelimiter("toml", "+++", "+++");
  static readonly JSON = new FrontmatterDelimiter("json", "{", "}");

  static detect(content: string): Result<FrontmatterDelimiter, DetectionError> {
    const trimmed = content.trimStart();

    if (trimmed.startsWith("---")) {
      return { ok: true, data: FrontmatterDelimiter.YAML };
    }
    if (trimmed.startsWith("+++")) {
      return { ok: true, data: FrontmatterDelimiter.TOML };
    }
    if (trimmed.startsWith("{")) {
      return { ok: true, data: FrontmatterDelimiter.JSON };
    }

    return {
      ok: false,
      error: {
        kind: "NoFrontmatterDetected",
        content: trimmed.substring(0, 50),
        message: "No frontmatter delimiter detected",
      },
    };
  }

  getFormat(): FrontmatterFormat {
    return this.format;
  }
  getStartDelimiter(): string {
    return this.startDelimiter;
  }
  getEndDelimiter(): string {
    return this.endDelimiter;
  }
}

/**
 * 生のフロントマターコンテンツ
 */
export class RawFrontmatter {
  private constructor(
    private readonly content: string,
    private readonly format: FrontmatterFormat,
  ) {}

  static create(
    content: string,
    format: FrontmatterFormat,
  ): Result<RawFrontmatter, ValidationError> {
    if (!content || content.trim().length === 0) {
      return {
        ok: false,
        error: {
          kind: "EmptyInput",
          message: "Frontmatter content cannot be empty",
        },
      };
    }

    return { ok: true, data: new RawFrontmatter(content, format) };
  }

  getContent(): string {
    return this.content;
  }
  getFormat(): FrontmatterFormat {
    return this.format;
  }
}

/**
 * Schema変換統合 (yaml-schema-mapper)
 */

/**
 * FrontmatterData生成時のSchema変換プロセス
 *
 * 処理フロー:
 * 1. Raw YAML extraction (@std/front-matter)
 * 2. Schema transformation (yaml-schema-mapper)
 * 3. Create FrontmatterData with schema-compliant data
 */

/**
 * Schema変換統合の実装例
 *
 * @example
 * ```typescript
 * // 1. Raw YAML extraction
 * const rawYaml = extractYaml(markdownContent);
 *
 * // 2. Schema transformation (yaml-schema-mapper)
 * import { mapDataToSchema } from "sub_modules/yaml-schema-mapper/mod.ts";
 *
 * const transformResult = mapDataToSchema({
 *   schema: schemaDefinition,
 *   data: rawYaml.attrs,
 *   options: {
 *     coerceTypes: true,
 *     validateTypes: true,
 *     strict: false
 *   }
 * });
 *
 * if (!transformResult.isOk()) {
 *   return Result.error(new FrontmatterError("Schema transformation failed"));
 * }
 *
 * const { data, warnings, metadata } = transformResult.unwrap();
 *
 * // 3. Create FrontmatterData with schema-compliant data
 * const frontmatterData = FrontmatterData.create(data);
 * ```
 *
 * 統合ポイント:
 * - FrontmatterData.create() の前に yaml-schema-mapper を実行
 * - Schema準拠データのみを FrontmatterData として保持
 * - 警告（warnings）は別途ログ出力
 *
 * 変換の責任:
 * - yaml-schema-mapper: Property mapping, Type coercion, Schema validation
 * - FrontmatterData: Schema準拠データの保持と参照
 *
 * モジュール独立性:
 * - yaml-schema-mapper は Frontmatter ドメインに依存しない
 * - 汎用的な YAML → Schema 変換モジュールとして設計
 */
}

/**
 * パース済みフロントマターデータ
 */
export class ParsedFrontmatter {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly format: FrontmatterFormat,
    private readonly sourcePath: MarkdownFilePath,
  ) {}

  static create(
    data: unknown,
    format: FrontmatterFormat,
    sourcePath: MarkdownFilePath,
  ): Result<ParsedFrontmatter, ParseError> {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        ok: false,
        error: {
          kind: "InvalidDataType",
          expected: "object",
          actual: Array.isArray(data) ? "array" : typeof data,
          message: "Frontmatter must be an object",
        },
      };
    }

    return {
      ok: true,
      data: new ParsedFrontmatter(
        data as Record<string, unknown>,
        format,
        sourcePath,
      ),
    };
  }

  getData(): Record<string, unknown> {
    return { ...this.data };
  }
  getFormat(): FrontmatterFormat {
    return this.format;
  }
  getSourcePath(): MarkdownFilePath {
    return this.sourcePath;
  }

  get(key: string): unknown {
    return this.data[key];
  }

  has(key: string): boolean {
    return key in this.data;
  }

  getKeys(): string[] {
    return Object.keys(this.data);
  }
}

/**
 * 検証済みフロントマターデータ
 */
export class ValidatedFrontmatter {
  private constructor(
    private readonly data: Record<string, unknown>,
    private readonly schemaId: SchemaId,
    private readonly validatedAt: Date,
    private readonly sourcePath: MarkdownFilePath,
  ) {}

  static create(
    parsed: ParsedFrontmatter,
    schemaId: SchemaId,
    validationResult: ValidationResult,
  ): Result<ValidatedFrontmatter, ValidationError> {
    if (!validationResult.isValid) {
      return {
        ok: false,
        error: {
          kind: "ValidationFailed",
          errors: validationResult.errors,
          message: "Frontmatter validation failed",
        },
      };
    }

    return {
      ok: true,
      data: new ValidatedFrontmatter(
        parsed.getData(),
        schemaId,
        new Date(),
        parsed.getSourcePath(),
      ),
    };
  }

  getData(): Record<string, unknown> {
    return { ...this.data };
  }
  getSchemaId(): SchemaId {
    return this.schemaId;
  }
  getValidatedAt(): Date {
    return this.validatedAt;
  }
  getSourcePath(): MarkdownFilePath {
    return this.sourcePath;
  }
}
```

### 2. エンティティ

```typescript
/**
 * Markdownドキュメントの状態
 */
export type MarkdownDocumentState =
  | { kind: "Unprocessed"; path: MarkdownFilePath }
  | { kind: "Loading"; path: MarkdownFilePath }
  | { kind: "Loaded"; path: MarkdownFilePath; content: string }
  | {
    kind: "Extracted";
    path: MarkdownFilePath;
    content: string;
    raw: RawFrontmatter;
  }
  | { kind: "Parsed"; path: MarkdownFilePath; parsed: ParsedFrontmatter }
  | {
    kind: "Validated";
    path: MarkdownFilePath;
    validated: ValidatedFrontmatter;
  }
  | { kind: "Failed"; path: MarkdownFilePath; error: FrontmatterError };

/**
 * Markdownドキュメントエンティティ
 */
export class MarkdownDocument {
  private state: MarkdownDocumentState;

  private constructor(
    private readonly id: DocumentId,
    initialPath: MarkdownFilePath,
  ) {
    this.state = { kind: "Unprocessed", path: initialPath };
  }

  static create(id: DocumentId, path: MarkdownFilePath): MarkdownDocument {
    return new MarkdownDocument(id, path);
  }

  // 状態遷移メソッド
  load(content: string): Result<void, FrontmatterError> {
    switch (this.state.kind) {
      case "Unprocessed":
      case "Failed":
        this.state = {
          kind: "Loaded",
          path: this.state.path,
          content,
        };
        return { ok: true, data: undefined };
      default:
        return {
          ok: false,
          error: {
            kind: "InvalidStateTransition",
            from: this.state.kind,
            to: "Loaded",
            message: `Cannot load document in state: ${this.state.kind}`,
          },
        };
    }
  }

  setExtracted(raw: RawFrontmatter): Result<void, FrontmatterError> {
    if (this.state.kind !== "Loaded") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Extracted",
          message: `Cannot extract from state: ${this.state.kind}`,
        },
      };
    }

    this.state = {
      kind: "Extracted",
      path: this.state.path,
      content: this.state.content,
      raw,
    };

    return { ok: true, data: undefined };
  }

  setParsed(parsed: ParsedFrontmatter): Result<void, FrontmatterError> {
    if (this.state.kind !== "Extracted") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Parsed",
          message: `Cannot parse from state: ${this.state.kind}`,
        },
      };
    }

    this.state = {
      kind: "Parsed",
      path: this.state.path,
      parsed,
    };

    return { ok: true, data: undefined };
  }

  setValidated(
    validated: ValidatedFrontmatter,
  ): Result<void, FrontmatterError> {
    if (this.state.kind !== "Parsed") {
      return {
        ok: false,
        error: {
          kind: "InvalidStateTransition",
          from: this.state.kind,
          to: "Validated",
          message: `Cannot validate from state: ${this.state.kind}`,
        },
      };
    }

    this.state = {
      kind: "Validated",
      path: this.state.path,
      validated,
    };

    return { ok: true, data: undefined };
  }

  fail(error: FrontmatterError): void {
    this.state = {
      kind: "Failed",
      path: this.getPath(),
      error,
    };
  }

  // クエリメソッド
  getId(): DocumentId {
    return this.id;
  }

  getPath(): MarkdownFilePath {
    return this.state.path;
  }

  getState(): MarkdownDocumentState {
    return this.state;
  }

  isValidated(): boolean {
    return this.state.kind === "Validated";
  }

  getValidatedData(): Result<ValidatedFrontmatter, FrontmatterError> {
    if (this.state.kind !== "Validated") {
      return {
        ok: false,
        error: {
          kind: "NotValidated",
          state: this.state.kind,
          message:
            `Document is not validated, current state: ${this.state.kind}`,
        },
      };
    }

    return { ok: true, data: this.state.validated };
  }
}

/**
 * ドキュメントID
 */
export class DocumentId {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<DocumentId, ValidationError> {
    if (!value || value.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", message: "Document ID cannot be empty" },
      };
    }

    return { ok: true, data: new DocumentId(value) };
  }

  static fromPath(path: MarkdownFilePath): DocumentId {
    const id = path.toString()
      .replace(/[\/\\]/g, "_")
      .replace(/\.[^.]+$/, "");
    return new DocumentId(id);
  }

  equals(other: DocumentId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
```

### 3. ドメインサービス

```typescript
/**
 * フロントマター抽出サービス
 */
export class FrontmatterExtractor {
  extract(content: string): Result<RawFrontmatter, ExtractError> {
    // 区切り文字検出
    const delimiterResult = FrontmatterDelimiter.detect(content);
    if (!delimiterResult.ok) {
      return {
        ok: false,
        error: {
          kind: "ExtractionFailed",
          reason: "No frontmatter found",
          message: delimiterResult.error.message,
        },
      };
    }

    const delimiter = delimiterResult.data;
    const startDelim = delimiter.getStartDelimiter();
    const endDelim = delimiter.getEndDelimiter();

    // フロントマター部分の抽出
    let extractedContent: string;

    if (delimiter.getFormat() === "json") {
      // JSON形式の場合
      const jsonMatch = content.match(/^\s*(\{[\s\S]*?\})\s*\n/);
      if (!jsonMatch) {
        return {
          ok: false,
          error: {
            kind: "ExtractionFailed",
            reason: "Invalid JSON frontmatter",
            message: "Could not extract JSON frontmatter",
          },
        };
      }
      extractedContent = jsonMatch[1];
    } else {
      // YAML/TOML形式の場合
      const lines = content.split("\n");
      let inFrontmatter = false;
      let frontmatterLines: string[] = [];
      let delimiterCount = 0;

      for (const line of lines) {
        if (line.trim() === startDelim) {
          if (delimiterCount === 0) {
            inFrontmatter = true;
            delimiterCount++;
            continue;
          } else if (delimiterCount === 1) {
            break;
          }
        }

        if (inFrontmatter) {
          frontmatterLines.push(line);
        }
      }

      if (frontmatterLines.length === 0) {
        return {
          ok: false,
          error: {
            kind: "ExtractionFailed",
            reason: "Empty frontmatter",
            message: "Frontmatter section is empty",
          },
        };
      }

      extractedContent = frontmatterLines.join("\n");
    }

    return RawFrontmatter.create(extractedContent, delimiter.getFormat());
  }
}

/**
 * フロントマターパーサー
 */
export class FrontmatterParser {
  parse(raw: RawFrontmatter): Result<ParsedFrontmatter, ParseError> {
    const content = raw.getContent();
    const format = raw.getFormat();

    try {
      let parsed: unknown;

      switch (format) {
        case "yaml":
          // YAML parse implementation
          parsed = this.parseYAML(content);
          break;
        case "toml":
          // TOML parse implementation
          parsed = this.parseTOML(content);
          break;
        case "json":
          parsed = JSON.parse(content);
          break;
        default:
          return {
            ok: false,
            error: {
              kind: "UnsupportedFormat",
              format,
              message: `Unsupported format: ${format}`,
            },
          };
      }

      // ParsedFrontmatterの作成（sourcePathは後で設定）
      return {
        ok: true,
        data: parsed as any, // 実際はMarkdownFilePathと共に作成
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          kind: "ParseFailed",
          format,
          error: error instanceof Error ? error.message : String(error),
          message: `Failed to parse ${format} frontmatter`,
        },
      };
    }
  }

  private parseYAML(content: string): unknown {
    // YAML parsing implementation
    throw new Error("YAML parser must be provided by infrastructure");
  }

  private parseTOML(content: string): unknown {
    // TOML parsing implementation
    throw new Error("TOML parser must be provided by infrastructure");
  }
}

/**
 * フロントマター検証サービス
 */
export class FrontmatterValidator {
  validate(
    parsed: ParsedFrontmatter,
    schema: ResolvedSchema,
  ): Result<ValidationResult, ValidationError> {
    // JSON Schema validation implementation
    // This would use Ajv or similar in infrastructure layer
    throw new Error("Validator must be provided by infrastructure");
  }
}

/**
 * 検証結果
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: ValidationErrorDetail[];
  readonly warnings?: ValidationWarning[];
}

export interface ValidationErrorDetail {
  readonly path: string;
  readonly message: string;
  readonly keyword?: string;
  readonly params?: Record<string, unknown>;
}

export interface ValidationWarning {
  readonly path: string;
  readonly message: string;
}
```

### 4. リポジトリインターフェース

```typescript
/**
 * Markdownドキュメントリポジトリ
 */
export interface MarkdownDocumentRepository {
  load(
    path: MarkdownFilePath,
  ): Promise<Result<MarkdownDocument, FrontmatterError>>;
  save(document: MarkdownDocument): Promise<Result<void, FrontmatterError>>;
  findById(
    id: DocumentId,
  ): Promise<Result<MarkdownDocument | null, FrontmatterError>>;
  findByPattern(
    pattern: string,
  ): Promise<Result<MarkdownDocument[], FrontmatterError>>;
}
```

### 5. エラー型定義

```typescript
export type FrontmatterError =
  | MarkdownPathError
  | ExtractError
  | ParseError
  | ValidationError
  | StateError;

export type MarkdownPathError =
  | { kind: "EmptyPath"; message: string }
  | {
    kind: "InvalidExtension";
    path: string;
    validExtensions: string[];
    message: string;
  }
  | { kind: "FileNotFound"; path: string; message: string };

export type ExtractError =
  | { kind: "ExtractionFailed"; reason: string; message: string }
  | DetectionError;

export type DetectionError = {
  kind: "NoFrontmatterDetected";
  content: string;
  message: string;
};

export type ParseError =
  | {
    kind: "ParseFailed";
    format: FrontmatterFormat;
    error: string;
    message: string;
  }
  | { kind: "UnsupportedFormat"; format: string; message: string }
  | {
    kind: "InvalidDataType";
    expected: string;
    actual: string;
    message: string;
  };

export type StateError =
  | {
    kind: "InvalidStateTransition";
    from: string;
    to: string;
    message: string;
  }
  | { kind: "NotValidated"; state: string; message: string };
```
