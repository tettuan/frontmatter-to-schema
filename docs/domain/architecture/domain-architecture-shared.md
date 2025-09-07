# ドメインアーキテクチャ設計 - 共有型定義

## 概要

本書は、全ドメインで共有される型定義、インターフェース、およびユーティリティを定義する。

## 共有型定義

### 1. Result型（全域性原則の基盤）

```typescript
/**
 * Result型 - 全域関数化の基盤
 * 全ての関数がこの型を返すことで部分関数を排除
 */
export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/**
 * Result型のユーティリティ関数
 */
export namespace Result {
  export function ok<T>(data: T): Result<T, never> {
    return { ok: true, data };
  }
  
  export function error<E>(error: E): Result<never, E> {
    return { ok: false, error };
  }
  
  export function isOk<T, E>(result: Result<T, E>): result is { ok: true; data: T } {
    return result.ok;
  }
  
  export function isError<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
    return !result.ok;
  }
  
  export function map<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => U
  ): Result<U, E> {
    if (result.ok) {
      return { ok: true, data: fn(result.data) };
    }
    return result;
  }
  
  export function flatMap<T, U, E>(
    result: Result<T, E>,
    fn: (value: T) => Result<U, E>
  ): Result<U, E> {
    if (result.ok) {
      return fn(result.data);
    }
    return result;
  }
  
  export function mapError<T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => F
  ): Result<T, F> {
    if (!result.ok) {
      return { ok: false, error: fn(result.error) };
    }
    return result;
  }
  
  export async function fromPromise<T, E = Error>(
    promise: Promise<T>,
    errorMapper?: (error: unknown) => E
  ): Promise<Result<T, E>> {
    try {
      const data = await promise;
      return { ok: true, data };
    } catch (error) {
      const mappedError = errorMapper 
        ? errorMapper(error)
        : (error as E);
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
  
  export function allSettled<T, E>(
    results: Result<T, E>[]
  ): { successes: T[]; failures: E[] } {
    const successes: T[] = [];
    const failures: E[] = [];
    
    for (const result of results) {
      if (result.ok) {
        successes.push(result.data);
      } else {
        failures.push(result.error);
      }
    }
    
    return { successes, failures };
  }
}
```

### 2. 共通エラー型

```typescript
/**
 * 基本的なバリデーションエラー
 */
export type ValidationError =
  | { kind: "EmptyInput"; message: string }
  | { kind: "PatternMismatch"; value: string; pattern: string; message: string }
  | { kind: "OutOfRange"; value: unknown; min?: number; max?: number; message: string }
  | { kind: "InvalidFormat"; value: string; expectedFormat: string; message: string }
  | { kind: "TooLong"; value: string; maxLength: number; message: string }
  | { kind: "TooShort"; value: string; minLength: number; message: string }
  | { kind: "InvalidType"; expected: string; actual: string; message: string }
  | { kind: "RequiredFieldMissing"; field: string; message: string }
  | { kind: "ValidationFailed"; errors: any[]; message: string };

/**
 * ファイルシステムエラー
 */
export type FileSystemError =
  | { kind: "FileNotFound"; path: string; message: string }
  | { kind: "DirectoryNotFound"; path: string; message: string }
  | { kind: "PermissionDenied"; path: string; message: string }
  | { kind: "ReadError"; path: string; error: string; message: string }
  | { kind: "WriteError"; path: string; error: string; message: string }
  | { kind: "DeleteError"; path: string; error: string; message: string };

/**
 * エラーヘルパー関数
 */
export namespace ErrorHelper {
  export function createValidationError(
    kind: ValidationError['kind'],
    details: Omit<ValidationError, 'kind'>
  ): ValidationError {
    return { kind, ...details } as ValidationError;
  }
  
  export function getErrorMessage(error: { message: string }): string {
    return error.message;
  }
  
  export function isValidationError(error: unknown): error is ValidationError {
    return typeof error === 'object' && 
           error !== null && 
           'kind' in error &&
           'message' in error;
  }
}
```

### 3. ドメインイベント

```typescript
/**
 * ドメインイベントの基底インターフェース
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly occurredAt: Date;
  readonly metadata?: EventMetadata;
}

/**
 * イベントメタデータ
 */
export interface EventMetadata {
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly userId?: string;
  readonly version?: number;
}

/**
 * イベントパブリッシャーインターフェース
 */
export interface EventPublisher {
  publish(event: DomainEvent): Promise<Result<void, PublishError>>;
  publishBatch(events: DomainEvent[]): Promise<Result<void, PublishError>>;
}

/**
 * イベントサブスクライバーインターフェース
 */
export interface EventSubscriber {
  subscribe(
    eventType: string,
    handler: EventHandler
  ): Result<SubscriptionId, SubscribeError>;
  
  unsubscribe(id: SubscriptionId): Result<void, UnsubscribeError>;
}

/**
 * イベントハンドラー
 */
export type EventHandler = (event: DomainEvent) => Promise<void>;

/**
 * サブスクリプションID
 */
export class SubscriptionId {
  private constructor(private readonly value: string) {}
  
  static create(): SubscriptionId {
    return new SubscriptionId(
      `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`
    );
  }
  
  toString(): string { return this.value; }
}

/**
 * イベント関連エラー
 */
export type EventError =
  | PublishError
  | SubscribeError
  | UnsubscribeError;

export type PublishError =
  | { kind: "PublishFailed"; reason: string; message: string }
  | { kind: "EventTooLarge"; size: number; maxSize: number; message: string };

export type SubscribeError =
  | { kind: "SubscribeFailed"; reason: string; message: string }
  | { kind: "InvalidEventType"; eventType: string; message: string };

export type UnsubscribeError =
  | { kind: "UnsubscribeFailed"; reason: string; message: string }
  | { kind: "SubscriptionNotFound"; id: string; message: string };
```

### 4. 共通値オブジェクト

```typescript
/**
 * タイムスタンプ
 */
export class Timestamp {
  private constructor(private readonly value: Date) {}
  
  static now(): Timestamp {
    return new Timestamp(new Date());
  }
  
  static from(date: Date | string | number): Result<Timestamp, ValidationError> {
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return {
          ok: false,
          error: {
            kind: "InvalidFormat",
            value: String(date),
            expectedFormat: "Valid date format",
            message: "Invalid date format"
          }
        };
      }
      return { ok: true, data: new Timestamp(d) };
    } catch {
      return {
        ok: false,
        error: {
          kind: "InvalidFormat",
          value: String(date),
          expectedFormat: "Valid date format",
          message: "Failed to parse date"
        }
      };
    }
  }
  
  toDate(): Date { return new Date(this.value); }
  toISOString(): string { return this.value.toISOString(); }
  valueOf(): number { return this.value.valueOf(); }
  
  isBefore(other: Timestamp): boolean {
    return this.value < other.value;
  }
  
  isAfter(other: Timestamp): boolean {
    return this.value > other.value;
  }
  
  equals(other: Timestamp): boolean {
    return this.value.getTime() === other.value.getTime();
  }
}

/**
 * UUID
 */
export class UUID {
  private constructor(private readonly value: string) {}
  
  static create(): UUID {
    // 簡易UUID v4生成
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    return new UUID(uuid);
  }
  
  static from(value: string): Result<UUID, ValidationError> {
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!pattern.test(value)) {
      return {
        ok: false,
        error: {
          kind: "PatternMismatch",
          value,
          pattern: pattern.source,
          message: "Invalid UUID format"
        }
      };
    }
    return { ok: true, data: new UUID(value.toLowerCase()) };
  }
  
  toString(): string { return this.value; }
  
  equals(other: UUID): boolean {
    return this.value === other.value;
  }
}

/**
 * NonEmptyString
 */
export class NonEmptyString {
  private constructor(private readonly value: string) {}
  
  static create(
    value: string,
    options?: {
      maxLength?: number;
      pattern?: RegExp;
      trim?: boolean;
    }
  ): Result<NonEmptyString, ValidationError> {
    const trimmed = options?.trim ? value.trim() : value;
    
    if (!trimmed || trimmed.length === 0) {
      return {
        ok: false,
        error: { kind: "EmptyInput", message: "String cannot be empty" }
      };
    }
    
    if (options?.maxLength && trimmed.length > options.maxLength) {
      return {
        ok: false,
        error: {
          kind: "TooLong",
          value: trimmed,
          maxLength: options.maxLength,
          message: `String exceeds maximum length of ${options.maxLength}`
        }
      };
    }
    
    if (options?.pattern && !options.pattern.test(trimmed)) {
      return {
        ok: false,
        error: {
          kind: "PatternMismatch",
          value: trimmed,
          pattern: options.pattern.source,
          message: "String does not match required pattern"
        }
      };
    }
    
    return { ok: true, data: new NonEmptyString(trimmed) };
  }
  
  toString(): string { return this.value; }
  length(): number { return this.value.length; }
  
  equals(other: NonEmptyString): boolean {
    return this.value === other.value;
  }
}
```

### 5. ドメイン境界ポート

```typescript
/**
 * ドメイン間の境界を定義するポート
 */
export interface DomainPort<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput, DomainError>>;
}

/**
 * クエリポート
 */
export interface QueryPort<TQuery, TResult> {
  query(query: TQuery): Promise<Result<TResult, QueryError>>;
}

/**
 * コマンドポート
 */
export interface CommandPort<TCommand, TResult = void> {
  execute(command: TCommand): Promise<Result<TResult, CommandError>>;
}

/**
 * ドメインエラーの基底型
 */
export interface DomainError {
  readonly kind: string;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * クエリエラー
 */
export type QueryError =
  | { kind: "NotFound"; query: unknown; message: string }
  | { kind: "Unauthorized"; message: string }
  | { kind: "QueryFailed"; reason: string; message: string };

/**
 * コマンドエラー
 */
export type CommandError =
  | { kind: "InvalidCommand"; command: unknown; message: string }
  | { kind: "Unauthorized"; message: string }
  | { kind: "CommandFailed"; reason: string; message: string }
  | { kind: "ConcurrencyConflict"; message: string };
```

### 6. ユーティリティ型

```typescript
/**
 * Readonly深層適用
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Partial深層適用
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Required深層適用
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
};

/**
 * Discriminated Unionのヘルパー型
 */
export type DiscriminatedUnion<K extends string, T extends Record<K, string>> = T;

/**
 * タグ付きユニオンの抽出
 */
export type ExtractUnion<T, K extends string, V extends string> = 
  T extends { [key in K]: V } ? T : never;

/**
 * 非null/undefined型
 */
export type NonNullable<T> = T extends null | undefined ? never : T;

/**
 * Promise展開型
 */
export type Awaited<T> = T extends Promise<infer U> ? U : T;

/**
 * 関数の引数型抽出
 */
export type Parameters<T extends (...args: any) => any> = 
  T extends (...args: infer P) => any ? P : never;

/**
 * 関数の戻り値型抽出
 */
export type ReturnType<T extends (...args: any) => any> = 
  T extends (...args: any) => infer R ? R : any;
```

### 7. インフラストラクチャーアダプター契約

```typescript
/**
 * ファイルシステムアダプター
 */
export interface FileSystemAdapter {
  readFile(path: string): Promise<Result<string, FileSystemError>>;
  writeFile(path: string, content: string): Promise<Result<void, FileSystemError>>;
  exists(path: string): Promise<Result<boolean, FileSystemError>>;
  listFiles(pattern: string): Promise<Result<string[], FileSystemError>>;
  deleteFile(path: string): Promise<Result<void, FileSystemError>>;
}

/**
 * JSONパーサーアダプター
 */
export interface JSONParserAdapter {
  parse<T = unknown>(json: string): Result<T, ParseError>;
  stringify(value: unknown, pretty?: boolean): Result<string, StringifyError>;
}

/**
 * YAMLパーサーアダプター
 */
export interface YAMLParserAdapter {
  parse<T = unknown>(yaml: string): Result<T, ParseError>;
  stringify(value: unknown): Result<string, StringifyError>;
}

/**
 * TOMLパーサーアダプター
 */
export interface TOMLParserAdapter {
  parse<T = unknown>(toml: string): Result<T, ParseError>;
  stringify(value: unknown): Result<string, StringifyError>;
}

/**
 * パースエラー
 */
export type ParseError =
  | { kind: "ParseFailed"; input: string; error: string; message: string }
  | { kind: "InvalidSyntax"; line?: number; column?: number; message: string };

/**
 * 文字列化エラー
 */
export type StringifyError =
  | { kind: "StringifyFailed"; error: string; message: string }
  | { kind: "CircularReference"; message: string }
  | { kind: "UnsupportedType"; type: string; message: string };
```

## まとめ

この共有型定義により、全ドメインで以下を実現：

1. **型安全性**: Result型による全域関数化
2. **一貫性**: 共通のエラー型とユーティリティ
3. **疎結合**: ポートインターフェースによる境界定義
4. **拡張性**: アダプター契約による実装の差し替え可能性
5. **保守性**: 共通型の一元管理

これらの共有定義を基盤として、各ドメインが独立して進化しながらも、システム全体の整合性を保つことができる。