# 共有型定義

## Result型（全域性原則の基盤）

```typescript
export type Result<T, E> =
  | { ok: true; data: T }
  | { ok: false; error: E };
```

## 共通エラー型

````typescript
export type ValidationError =
  | { kind: "EmptyInput"; message: string }
  | { kind: "PatternMismatch"; value: string; pattern: string; message: string }
  | {
    kind: "InvalidFormat";
    value: string;
    expectedFormat: string;
    message: string;
  }
  | { kind: "ValidationFailed"; errors: any[]; message: string };

## Schema拡張プロパティ型定義

アプリケーション特有のSchema拡張プロパティの型定義。

```typescript
/**
 * Schema拡張プロパティ
 */
export interface SchemaExtensions {
  /**
   * 使用するテンプレートファイル名
   */
  "x-template"?: string;
  
  /**
   * フロントマター処理の対象配列フラグ
   */
  "x-frontmatter-part"?: boolean;
  
  /**
   * 派生フィールドのソース式
   * 例: "commands[].c1" - commandsの各要素のc1プロパティから値を収集
   */
  "x-derived-from"?: string;
  
  /**
   * 派生フィールドの値を一意化するフラグ
   */
  "x-derived-unique"?: boolean;
}

/**
 * 拡張プロパティ付きJSONSchema
 */
export interface ExtendedSchema extends Record<string, unknown>, SchemaExtensions {
  $schema?: string;
  type?: string;
  properties?: Record<string, ExtendedSchemaProperty>;
  items?: ExtendedSchemaProperty;
  $ref?: string;
}

/**
 * 拡張プロパティ付きSchemaプロパティ
 */
export interface ExtendedSchemaProperty extends Record<string, unknown>, SchemaExtensions {
  type?: string;
  properties?: Record<string, ExtendedSchemaProperty>;
  items?: ExtendedSchemaProperty;
  $ref?: string;
}
````
