# 共有型定義 - ドメイン間共通アーキテクチャ

## 概要

本ドキュメントは、3ドメインアーキテクチャにおいて全ドメインで共有される型定義、インターフェース、およびユーティリティを定義する。

## 3ドメインアーキテクチャにおける共有の原則

### ドメイン境界と共有型

```typescript
// 3つの独立したドメインの境界定義
interface DomainBoundaries {
  // フロントマター解析ドメイン
  frontmatter: {
    input: string[]; // Markdownファイルパス
    output: ExtractedData[]; // 抽出データ
    constraint: "外部から直接アクセス禁止";
  };

  // テンプレート管理ドメイン
  template: {
    input: TemplateDirective; // テンプレート指定
    output: Template; // テンプレートファイル
    constraint: "変数置換は行わない";
  };

  // データ処理指示ドメイン（隠蔽層）
  dataProcessing: {
    input: ExtractedData[]; // フロントマター解析結果
    output: ProcessedData; // 処理済みデータ
    constraint: "フロントマターデータへの直接アクセスを隠蔽";
  };
}
```

## Result型（全域性原則の基盤）

```typescript
/**
 * Result型 - 全域関数化の基盤
 * 全ての関数がこの型を返すことで部分関数を排除
 */
export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export namespace Result {
  export function ok<T>(data: T): Result<T, never> {
    return { ok: true, data };
  }

  export function error<E>(error: E): Result<never, E> {
    return { ok: false, error };
  }

  export function isOk<T, E>(
    result: Result<T, E>,
  ): result is { ok: true; data: T } {
    return result.ok;
  }

  export function isError<T, E>(
    result: Result<T, E>,
  ): result is { ok: false; error: E } {
    return !result.ok;
  }

  export function map<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => U,
  ): Result<U, E> {
    if (result.ok) {
      return { ok: true, data: fn(result.data) };
    }
    return result;
  }

  export function flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>,
  ): Result<U, E> {
    if (result.ok) {
      return fn(result.data);
    }
    return result;
  }

  export async function fromPromise<T, E = Error>(
    promise: Promise<T>,
    errorMapper?: (error: unknown) => E,
  ): Promise<Result<T, E>> {
    try {
      const data = await promise;
      return { ok: true, data };
    } catch (error) {
      const mappedError = errorMapper ? errorMapper(error) : (error as E);
      return { ok: false, error: mappedError };
    }
  }

  export function all<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const data: T[] = [];

    for (const result of results) {
      if (!result.ok) {
        return result;
      }
      data.push(result.data);
    }

    return { ok: true, data };
  }
}
```

## ドメイン間インターフェース

### データ処理指示ドメインのインターフェース（隠蔽層）

```typescript
/**
 * データ処理指示ドメインが提供する隠蔽層
 * フロントマターデータへの直接アクセスを防ぐ
 */
export interface DataProcessingInterface {
  // フロントマター解析結果を受け取る
  initialize(extractedData: ExtractedData[]): void;

  // Schema階層要求に応じて処理済データを返す
  callMethod(schemaPath: string): ProcessedData;

  // x-ディレクティブ処理
  applyDirectives(directives: ProcessingDirective[]): void;
}

/**
 * 処理ディレクティブ
 */
export interface ProcessingDirective {
  type:
    | "x-flatten-arrays"
    | "x-jmespath-filter"
    | "x-derived-from"
    | "x-derived-unique";
  value: unknown;
  path: string;
}

/**
 * 抽出データ（フロントマター解析ドメインの出力）
 */
export interface ExtractedData {
  source: string; // ソースファイルパス
  data: Record<string, unknown>; // 抽出されたデータ
  frontmatterPart?: string; // x-frontmatter-part指定階層
}

/**
 * 処理済みデータ（データ処理指示ドメインの出力）
 */
export interface ProcessedData {
  value: unknown;
  path: string;
  metadata?: DataMetadata;
}

export interface DataMetadata {
  derived?: boolean;
  unique?: boolean;
  filtered?: boolean;
  flattened?: boolean;
}
```

### テンプレート管理ドメインのインターフェース

```typescript
/**
 * テンプレート指定
 */
export interface TemplateDirective {
  mainTemplate?: string; // x-template
  itemsTemplate?: string; // x-template-items
  format?: string; // x-template-format
}

/**
 * テンプレート
 */
export interface Template {
  content: string;
  format: "json" | "yaml" | "md" | "xml";
  variables: TemplateVariable[];
}

/**
 * テンプレート変数
 */
export interface TemplateVariable {
  name: string;
  path: string;
  isItems?: boolean; // {@items}変数かどうか
}
```

## 共通エラー型

### ドメイン固有エラー

```typescript
/**
 * フロントマター解析エラー
 */
export type FrontmatterError =
  | { kind: "FileNotFound"; path: string; message: string }
  | { kind: "InvalidYaml"; content: string; message: string }
  | { kind: "MissingFrontmatter"; file: string; message: string }
  | { kind: "ExtractionFailed"; reason: string; message: string };

/**
 * テンプレート管理エラー
 */
export type TemplateError =
  | { kind: "TemplateNotFound"; name: string; message: string }
  | { kind: "InvalidFormat"; format: string; message: string }
  | { kind: "MissingVariable"; variable: string; message: string };

/**
 * データ処理エラー
 */
export type ProcessingError =
  | { kind: "InvalidDirective"; directive: string; message: string }
  | { kind: "PathNotFound"; path: string; message: string }
  | { kind: "ProcessingFailed"; reason: string; message: string };

/**
 * Schema統括エラー
 */
export type SchemaError =
  | { kind: "CircularReference"; refs: string[]; message: string }
  | { kind: "MaxDepthExceeded"; depth: number; message: string }
  | {
    kind: "InvalidStateTransition";
    from: string;
    to: string;
    message: string;
  }
  | { kind: "DecompositionFailed"; reason: string; message: string };
```

### 共通バリデーションエラー

```typescript
export type ValidationError =
  | { kind: "EmptyInput"; message: string }
  | { kind: "PatternMismatch"; value: string; pattern: string; message: string }
  | { kind: "InvalidType"; expected: string; actual: string; message: string }
  | { kind: "RequiredFieldMissing"; field: string; message: string };
```

## ドメイン境界ポート

```typescript
/**
 * ドメイン間の境界を定義するポート
 */
export interface DomainPort<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput, DomainError>>;
}

/**
 * フロントマター解析ポート
 */
export interface FrontmatterPort extends DomainPort<string[], ExtractedData[]> {
  extract(files: string[]): Promise<Result<ExtractedData[], FrontmatterError>>;
}

/**
 * テンプレート管理ポート
 */
export interface TemplatePort extends DomainPort<TemplateDirective, Template> {
  loadTemplate(
    directive: TemplateDirective,
  ): Promise<Result<Template, TemplateError>>;
}

/**
 * データ処理指示ポート（隠蔽層）
 */
export interface DataProcessingPort {
  initialize(data: ExtractedData[]): void;
  callMethod(path: string): ProcessedData;
  applyDirective(directive: ProcessingDirective): Result<void, ProcessingError>;
}

/**
 * ドメインエラーの基底型
 */
export interface DomainError {
  readonly kind: string;
  readonly message: string;
  readonly details?: unknown;
}
```

## 共通値オブジェクト

```typescript
/**
 * DocumentId - 全ドメインで使用
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

  static fromPath(path: string): DocumentId {
    const id = path
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

/**
 * SchemaId - Schema統括ドメインで使用
 */
export class SchemaId {
  private constructor(private readonly value: string) {}

  static create(id: string): Result<SchemaId, ValidationError> {
    if (!id || id.trim().length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", message: "Schema ID cannot be empty" },
      };
    }

    const pattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!pattern.test(id)) {
      return {
        ok: false,
        error: {
          kind: "PatternMismatch",
          value: id,
          pattern: pattern.source,
          message: "Invalid Schema ID format",
        },
      };
    }

    return { ok: true, data: new SchemaId(id) };
  }

  equals(other: SchemaId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
```

## インフラストラクチャーアダプター契約

```typescript
/**
 * ファイルシステムアダプター
 */
export interface FileSystemAdapter {
  readFile(path: string): Promise<Result<string, FileSystemError>>;
  writeFile(
    path: string,
    content: string,
  ): Promise<Result<void, FileSystemError>>;
  exists(path: string): Promise<Result<boolean, FileSystemError>>;
  listFiles(pattern: string): Promise<Result<string[], FileSystemError>>;
}

/**
 * YAMLパーサーアダプター
 */
export interface YAMLParserAdapter {
  parse<T = unknown>(yaml: string): Result<T, ParseError>;
  stringify(value: unknown): Result<string, StringifyError>;
}

/**
 * JSONパーサーアダプター
 */
export interface JSONParserAdapter {
  parse<T = unknown>(json: string): Result<T, ParseError>;
  stringify(value: unknown, pretty?: boolean): Result<string, StringifyError>;
}

export type FileSystemError =
  | { kind: "FileNotFound"; path: string; message: string }
  | { kind: "ReadError"; path: string; error: string; message: string }
  | { kind: "WriteError"; path: string; error: string; message: string };

export type ParseError =
  | { kind: "ParseFailed"; input: string; error: string; message: string }
  | { kind: "InvalidSyntax"; line?: number; column?: number; message: string };

export type StringifyError =
  | { kind: "StringifyFailed"; error: string; message: string }
  | { kind: "CircularReference"; message: string };
```

## 重要な設計原則

### 1. データアクセスの隠蔽

flow.ja.mdの原則：

> 「1.フロントマター解析の構造」が直接参照されることはなく、「3.解析結果データの処理指示」によって隠蔽されている

### 2. ドメインの独立性

- 各ドメインは他のドメインの実装詳細に依存しない
- インターフェースを通じてのみ相互作用
- 処理順序は宣言的に決定

### 3. 全域性の保証

- すべての関数はResult型を返す
- 部分関数の排除
- エラーの明示的な処理

## まとめ

この共有型定義により、3ドメインアーキテクチャにおいて以下を実現：

1. **型安全性**: Result型による全域関数化
2. **ドメイン分離**: 明確な境界とインターフェース
3. **データ隠蔽**: データ処理指示ドメインによるアクセス制御
4. **疎結合**: ポートインターフェースによる境界定義
5. **拡張性**: アダプター契約による実装の差し替え可能性
